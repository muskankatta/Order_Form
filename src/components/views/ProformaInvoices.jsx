import { useState, useEffect, useCallback, Fragment } from 'react';
import { db } from '../../firebase.js';
import { collection, getDocs, updateDoc, addDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, Btn, Toast } from '../ui/index.jsx';
import { useToast } from '../../hooks/useToast.js';
import { fmtDate } from '../../utils/dates.js';
import { SERVICES } from '../../constants/formOptions.js';
import { REVOPS_USERS, FINANCE_USERS } from '../../constants/users.js';
import { CHANNELS as CH } from '../../utils/slack.js';
import { entityKeyOf, getEntity, ENTITY_OPTIONS } from '../../constants/entities.js';

const NAVY = '#1B2B4B';
const FEE_TYPES     = ['Setup Fee','One Time Fee','Subscription Fee'];
const SAC_MAP       = {'Setup Fee':'998314','One Time Fee':'998314','Subscription Fee':'998599'};
const BOLTIC        = import.meta.env.VITE_BOLTIC_SLACK_URL||'';
const PAYMENT_MODES = ['NEFT','RTGS','Cheque','Wire Transfer','Online / UPI','Other'];

const getSAC   = ft => SAC_MAP[ft]||'998314';
const symOf    = cur => ({USD:'$',AED:'AED ',GBP:'£',EUR:'€',SGD:'SGD ',SAR:'SAR ',QAR:'QAR ',OMR:'OMR ',KWD:'KWD '}[cur]||(cur?cur+' ':'₹'));
const fmtAmt   = (n,cur)=>symOf(cur)+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const pctOf    = (col,tot)=>tot>0?Math.min(100,Math.round((col/tot)*100)):0;
const entityOf = of=>entityKeyOf(of);
const isIndia  = of=>(of?.country||'').toLowerCase()==='india';
const fixedTax = of=>entityOf(of)==='fynd'&&isIndia(of);
function getCurrentFY(){const n=new Date();const y=n.getMonth()>=3?n.getFullYear()+1:n.getFullYear();return String(y).slice(-2);}

async function genPINumber(ent){
  const fy=getCurrentFY();const re=ent==='yavi'?/^PI-YT-(\d{5})-FY/:ent==='fynduk'?/^PI-UK-(\d{5})-FY/:/^PI-A(\d{5})-FY/;
  const snap=await getDocs(collection(db,'proforma_invoices'));
  let max=0;snap.forEach(d=>{const m=(d.data().pi_number||'').match(re);if(m)max=Math.max(max,parseInt(m[1]));});
  const n=String(max+1).padStart(5,'0');
  return ent==='yavi'?`PI-YT-${n}-FY${fy}`:ent==='fynduk'?`PI-UK-${n}-FY${fy}`:`PI-A${n}-FY${fy}`;
}

async function notifyPI(pi,event){
  if(!BOLTIC)return null;
  try{
    const ch=CH[pi.sales_team]||CH['India'];
    const salesTag  = pi.sales_rep_slack_id   ? `<@${pi.sales_rep_slack_id}>` : null;
    const revopsTag = pi.revops_reviewer_slack_id ? `<@${pi.revops_reviewer_slack_id}>` : pi.revops_reviewer;
    const approverLabel = pi.is_standalone ? 'Finance' : 'RevOps';
    const financeTags = (pi.finance_approvers_slack_ids||[]).filter(Boolean).map(id=>`<@${id}>`).join(' ');
    const ofLine = pi.of_number ? `  |  *OF:* ${pi.of_number}` : '  |  _No OF (direct PI)_';
    const msgs={
      submitted:`🧾 *Proforma Invoice Raised* — *${pi.pi_number}*\n*Customer:* ${pi.customer_name}${ofLine}\n*By:* ${pi.created_by_name}  |  *Amount:* ${fmtAmt(pi.grand_total,pi.currency)}\n⏳ Awaiting ${approverLabel} Approval${pi.is_standalone&&financeTags?`\n*Finance:* ${financeTags}`:''}`,
      cancelled:`🚫 *Proforma Invoice Cancelled* — *${pi.pi_number}*\n*Customer:* ${pi.customer_name}  |  *OF:* ${pi.of_number}\n*Cancelled by:* ${revopsTag}${salesTag?`  |  *Sales Rep:* ${salesTag}`:''}\n*Reason:* ${pi.revops_comment||'Not specified'}`,
      approved: `✅ *Proforma Invoice Approved* — *${pi.pi_number}*\n*Customer:* ${pi.customer_name}  |  *Amount:* ${fmtAmt(pi.grand_total,pi.currency)}\n*Approved by:* ${revopsTag}${salesTag?`  |  *Sales Rep:* ${salesTag}`:''}\n📥 Download the PDF from the OF Platform`,
      rejected: `❌ *Proforma Invoice Rejected* — *${pi.pi_number}*\n*Customer:* ${pi.customer_name}  |  *OF:* ${pi.of_number}\n*Rejected by:* ${revopsTag}${salesTag?`  |  *Sales Rep:* ${salesTag}`:''}\n*Reason:* ${pi.revops_comment||'Not specified'}`,
    };
    const body={channel:ch,text:msgs[event]||''};if(pi.slack_thread_ts)body.thread_ts=pi.slack_thread_ts;
    const res=await fetch(BOLTIC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const raw=await res.text();
    if(raw){try{const d=JSON.parse(raw);if(event==='submitted'&&d.result?.ts)return d.result.ts;}catch(_){}}
  }catch(e){console.warn('PI Slack failed:',e);}
  return null;
}

const STATUS_STYLE={submitted:{background:'#fef3c7',color:'#92400e'},approved:{background:'#d1fae5',color:'#065f46'},rejected:{background:'#fee2e2',color:'#991b1b'},cancelled:{background:'#f1f5f9',color:'#64748b'},fully_collected:{background:'#dcfce7',color:'#14532d'}};
const STATUS_LABEL={submitted:'Pending Approval',approved:'Approved',rejected:'Rejected',cancelled:'Cancelled',fully_collected:'Fully Collected'};
function PIPill({status}){return <span style={{...STATUS_STYLE[status],display:'inline-block',padding:'2px 10px',borderRadius:'9999px',fontSize:'11px',fontWeight:600}}>{STATUS_LABEL[status]||status}</span>;}

// PDF print function
function printPI(pi){
  const ent=entityKeyOf(pi);const entCfg=getEntity(ent);
  const isYavi=ent==='yavi';const isUK=ent==='fynduk';
  const inIndia=(pi.country||'').toLowerCase()==='india';
  const fyndIndia=(ent==='fynd')&&inIndia;
  const cur=pi.currency||'INR';const f=n=>symOf(cur)+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const invDate=pi.revops_reviewed_at?fmtDate(pi.revops_reviewed_at.toDate?pi.revops_reviewed_at.toDate().toISOString().split('T')[0]:pi.revops_reviewed_at):fmtDate(pi.created_at?.toDate?.()?.toISOString?.()?.split?.('T')?.[0]||'');
  const taxLbl=pi.tax_rate>0?`${pi.tax_type||'GST'} @${pi.tax_rate}%`:null;
  const YAVI_SRC='data:image/png;base64,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';
  const UK_BRAND='data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2ZXJzaW9uPSIxLjEiIHZpZXdCb3g9IjAgMCA1MjAgNTAwIj4KICA8IS0tIEdlbmVyYXRvcjogQWRvYmUgSWxsdXN0cmF0b3IgMjkuNS4xLCBTVkcgRXhwb3J0IFBsdWctSW4gLiBTVkcgVmVyc2lvbjogMi4xLjAgQnVpbGQgMTQxKSAgLS0+CiAgPHBhdGggZD0iTTQ4My4xNyw2Ni4zbC02MC4yLTUwLjAxYy0yNi4xMS0yMS43LTYzLjk5LTIxLjctOTAuMDksMGwtNzIuODMsNjAuNDktNzIuNzctNjAuNDljLTI2LjExLTIxLjctNjMuOTMtMjEuNzMtOTAuMDYtLjA2bC02MC4zNSw1MC4wN0MxNC4wMSw4NS4yNy44LDExMy40My44LDE0My4xNXYxMjQuNTVjMCwyOS42NiwxMy4xOSw1Ny43OSwzNiw3Ni43NWwxNTkuMzYsMTMyLjQ5YzM3LDMwLjc1LDkwLjY4LDMwLjc1LDEyNy42NSwwbDE1OS4zNi0xMzIuNDljMjIuODMtMTguOTgsMzYuMDMtNDcuMTMsMzYuMDMtNzYuODF2LTEyNC41NGMwLTI5LjY2LTEzLjIxLTU3LjgyLTM2LjAzLTc2Ljc5Wk00NzIuMjIsMjU5LjQxYzAsMjAuOTQtOS4zNCw0MC44Mi0yNS40Myw1NC4yMWwtMTQxLjc0LDExNy44NGMtMjYuMTEsMjEuNy02My45OSwyMS43LTkwLjEyLDBsLTE0MS43NC0xMTcuODRjLTE2LjA5LTEzLjM5LTI1LjQtMzMuMjctMjUuNC01NC4yMXYtMTA4YzAtMjAuOTcsOS4zNC00MC44NSwyNS40OS01NC4yNGw0Mi43LTM1LjQxYzE1LjI0LTEyLjY2LDM3LjMyLTEyLjYzLDUyLjUzLjAzbDU0Ljc5LDQ1LjU1LTc5Ljk2LDY2LjM5Yy0xOS43NiwxNi40NC0xOS43OSw0Ni43OC0uMDMsNjMuMjJsOTAuMjQsNzUuMmMxNS4yNCwxMi42OSwzNy4zNSwxMi43Miw1Mi41OS4wM2w5MC41LTc1LjIzYzE5Ljc2LTE2LjQ0LDE5Ljc2LTQ2Ljc4LDAtNjMuMjJsLTQzLjk0LTM2LjUyYy0yLjE4LTEuODEtNS4zMy0xLjgxLTcuNTEsMGwtMjcuNTcsMjIuOWMtMi44MywyLjM1LTIuODMsNi42OSwwLDkuMDNsMzIuNjgsMjcuMTdjNS42Nyw0LjcsNS42NywxMy4zNiwwLDE4LjA2bC02Mi45LDUyLjMzYy00LjM4LDMuNjEtMTAuNjksMy42MS0xNS4wNC0uMDNsLTYyLjcyLTUyLjI3Yy01LjY0LTQuNy01LjY0LTEzLjM2LjAzLTE4LjA2bDUwLjc3LTQyLjE3LDEyLjEtMTAuMDQsNDQuMjUtMzYuNzYsMzUuMTUtMjkuMTksMTkuNy0xNi4zOWMxNS4yNC0xMi42NiwzNy4zMi0xMi42Niw1Mi41MywwbDQyLjYxLDM1LjM4YzE2LjA5LDEzLjM5LDI1LjQzLDMzLjI0LDI1LjQzLDU0LjIxdjEwOC4wM1oiLz4KPC9zdmc+';
  const ukHdr=`<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr><td style="width:45%;vertical-align:middle"><img src="${UK_BRAND}" style="height:46px;display:block" alt="Fynd"/></td><td style="width:55%;text-align:right;font-size:11px;line-height:1.65;color:#334155"><strong style="font-size:12px;color:#1e293b">Shopsense Retail Technologies (UK) Limited</strong><br/>Company No. 1704410<br/>10 John Street, London WC1N 2EB<br/>Email: compliance@gofynd.com  |  VRN: 517184686</td></tr></table>`;
  const hdr=isUK?ukHdr:isYavi
    ?`<div style="margin-bottom:14px"><img src="${YAVI_SRC}" alt="Yavi" style="width:100%;max-height:90px;object-fit:contain;object-position:left"/></div>`
    :`<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr><td style="width:45%;vertical-align:middle"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1480 500" style="height:40px;display:block"><path d="M486.63,66.3l-60.2-50.01c-26.11-21.7-63.99-21.7-90.09,0l-72.83,60.49-72.77-60.49c-26.11-21.7-63.93-21.73-90.06-.06l-60.35,50.07C17.46,85.27,4.25,113.43,4.25,143.15v124.55c0,29.66,13.19,57.79,36,76.75l159.36,132.49c37,30.75,90.68,30.75,127.65,0l159.36-132.49c22.83-18.98,36.03-47.13,36.03-76.81v-124.54c0-29.66-13.21-57.82-36.03-76.79ZM475.67,259.41c0,20.94-9.34,40.82-25.43,54.21l-141.74,117.84c-26.11,21.7-63.99,21.7-90.12,0l-141.74-117.84c-16.09-13.39-25.4-33.27-25.4-54.21v-108c0-20.97,9.34-40.85,25.49-54.24l42.7-35.41c15.24-12.66,37.32-12.63,52.53.03l54.79,45.55-79.96,66.39c-19.76,16.44-19.79,46.78-.03,63.22l90.24,75.2c15.24,12.69,37.35,12.72,52.59.03l90.5-75.23c19.76-16.44,19.76-46.78,0-63.22l-43.94-36.52c-2.18-1.81-5.33-1.81-7.51,0l-27.57,22.9c-2.83,2.35-2.83,6.69,0,9.03l32.68,27.17c5.67,4.7,5.67,13.36,0,18.06l-62.9,52.33c-4.38,3.61-10.69,3.61-15.04-.03l-62.72-52.27c-5.64-4.7-5.64-13.36.03-18.06l50.77-42.17,12.1-10.04,44.25-36.76,35.15-29.19,19.7-16.39c15.24-12.66,37.32-12.66,52.53,0l42.61,35.38c16.09,13.39,25.43,33.24,25.43,54.21v108.03Z"/><g><path d="M707.33,52.27h113c2.89,0,5.23,2.34,5.23,5.23v34.2c0,2.89-2.34,5.23-5.23,5.23h-106.41c-22.39,0-40.55,18.15-40.55,40.55v36.15c0,2.89,2.34,5.23,5.23,5.23h117.67c2.89,0,5.23,2.34,5.23,5.23v31.72c0,2.89-2.34,5.23-5.23,5.23h-117.67c-2.89,0-5.23,2.34-5.23,5.23v120.64c0,2.89-2.34,5.23-5.23,5.23h-36.68c-2.89,0-5.23-2.34-5.23-5.23v-213.55c0-44.79,36.31-81.1,81.1-81.1Z"/><path d="M1219.88,150.75c-13.51-12.13-31.99-18.2-55.42-18.2-.64,0-1.28.01-1.92.03-.62-.01-1.24-.03-1.87-.03-22.97,0-43.83,9.05-59.2,23.78-1.66,1.59-4.42.42-4.42-1.88v-10.88c0-2.89-2.34-5.23-5.23-5.23h-34.2c-2.89,0-5.23,2.34-5.23,5.23v203.35c0,2.89,2.34,5.23,5.23,5.23h36.68c2.89,0,5.23-2.34,5.23-5.23v-120.91c0-7.72,1.24-15.02,3.72-21.92,2.48-6.89,5.93-12.89,10.34-17.99,4.41-5.1,9.78-9.1,16.13-11.99,6.34-2.89,13.51-4.34,21.51-4.34,14.06,0,24.4,3.79,31.02,11.37,6.62,7.59,10.2,19.79,10.75,36.6v129.18c0,2.89,2.34,5.23,5.23,5.23h36.68c2.89,0,5.23-2.34,5.23-5.23v-141.58c0-24.26-6.76-42.46-20.26-54.59Z"/><path d="M1017.79,143.51v227.99c0,44.8-36.31,81.11-81.09,81.11h-90.01c-2.89,0-5.24-2.35-5.24-5.24v-34.19c0-2.89,2.35-5.24,5.24-5.24h83.41c22.4,0,43.02-18.59,43.02-40.99v-30.86c0-2.32-2.78-3.54-4.47-1.93-15.37,14.69-36.21,23.73-59.15,23.73-.63,0-1.25-.01-1.88-.03-.63.01-1.27.03-1.9.03-23.43,0-41.91-6.06-55.43-18.19-13.51-12.15-20.27-30.33-20.27-54.6v-141.59c0-2.88,2.35-5.23,5.24-5.23h36.68c2.89,0,5.23,2.35,5.23,5.23v129.19c.56,16.81,4.14,29.02,10.76,36.59,6.62,7.59,16.96,11.37,31.02,11.37,7.99,0,15.17-1.45,21.5-4.34,6.34-2.89,11.73-6.89,16.13-11.99,4.41-5.11,7.86-11.1,10.34-17.99,2.48-6.9,3.72-14.21,3.72-21.93v-120.91c0-2.88,2.35-5.23,5.23-5.23h36.69c2.88,0,5.23,2.35,5.23,5.23Z"/><path d="M1428.61,57.51v97.02c0,2.3-2.75,3.48-4.41,1.89-7.86-7.55-17.16-13.6-27.44-17.73-.34-.16-.7-.33-1.1-.49-23.44-9.76-53.14-4.57-53.14-4.57v.02c-6.73,1.03-13.4,2.79-20,5.32-11.17,4.28-21.09,10.96-29.78,20.06-8.68,9.1-15.65,20.68-20.89,34.74-5.24,14.06-7.86,30.75-7.86,50.04,0,15.99,2.07,30.95,6.2,44.87,4.14,13.93,10.34,25.99,18.61,36.19,8.27,10.2,18.67,18.27,31.22,24.19,12.54,5.93,27.22,8.89,44.04,8.89.43,0,.85-.03,1.28-.03.69.02,1.38.03,2.07.03,22.98,0,43.85-9.06,59.22-23.8,1.66-1.6,4.42-.43,4.42,1.88v10.9c0,2.89,2.34,5.23,5.23,5.23h34.2c2.89,0,5.23-2.34,5.23-5.23V57.51c0-2.89-2.34-5.23-5.23-5.23h-36.68c-2.89,0-5.23,2.34-5.23,5.23ZM1325.42,297.98c-4.83-6.89-8.41-14.75-10.75-23.57-2.35-8.82-3.52-17.78-3.52-26.88,0-9.65,1.03-19.09,3.1-28.33,2.07-9.23,5.51-17.51,10.34-24.81,4.82-7.3,11.02-13.23,18.61-17.78,7.58-4.55,16.89-6.82,27.92-6.82,18.2,0,32.6,6.62,43.22,19.85,10.61,13.23,15.92,31.71,15.92,55.42,0,9.38-1.18,18.55-3.52,27.5-2.35,8.96-5.93,17.03-10.75,24.19-4.83,7.17-11.03,12.96-18.61,17.37-7.59,4.41-16.61,6.62-27.09,6.62s-19.02-2.07-26.47-6.2c-7.44-4.14-13.58-9.65-18.4-16.54Z"/></g></svg></td><td style="width:55%;text-align:right;font-size:11px;line-height:1.65;color:#334155"><strong style="font-size:12px;color:#1e293b">Shopsense Retail Technologies Ltd.</strong><br/>1st Floor Wework Vijay Diamond, Opp. SBI Branch,<br/>Cross Road B, Ajit Nagar, Kondivita,<br/>Andheri East, Mumbai - 400093<br/>MOB: +91 9321 938 025  |  CIN: U52100MH2012PLC236314<br/>GSTIN: 27AALCA0442L1ZM  |  PAN: AALCA0442L</td></tr></table>`;
  const liRows=(pi.line_items||[]).map(li=>`<tr><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top"><div style="color:#1e293b">${[li.fee_type,li.description].filter(Boolean).join(' — ')}</div><div style="color:#94a3b8;font-size:10px;margin-top:2px">${li.service||''}</div></td><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${li.sac_code||getSAC(li.fee_type)}</td><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${li.qty}</td><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:right">${f(li.rate)}</td><td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">${f(li.total)}</td></tr>`).join('');
  const bankBlk=fyndIndia?`<p style="font-weight:700;margin:0 0 6px;font-size:11.5px;text-decoration:underline">Bank Details for NEFT / RTGS:</p><p style="margin:0;font-size:11px;line-height:1.9;color:#334155">Beneficiary Name: <strong>Shopsense Retail Technologies Ltd</strong><br/>Account No: 643805051548<br/>IFSC code: ICIC0006438<br/>Bank Name: ICICI Bank<br/>Branch: Sakinaka, Andheri (E), Mumbai, Maharashtra 400072</p>`:`<p style="margin:0;font-size:11px;color:#334155"><strong>Bank Details:</strong> Please contact your Fynd POC for bank details.</p>`;
  const payable=entCfg.legalName;
  const rcm=fyndIndia?`<li style="margin-bottom:4px">Reverse Charge Mechanism (RCM): No</li>`:'';
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${pi.pi_number} — ${pi.customer_name}</title><style>*{margin:0;padding:0;box-sizing:border-box}@page{margin:0}body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;padding:36px 44px}@media print{body{padding:28px 36px}}</style></head><body><div style="max-width:760px;margin:0 auto">${hdr}<hr style="border:none;border-top:2.5px solid #1e293b;margin:0 0 18px"/><h2 style="text-align:center;font-size:17px;font-weight:bold;letter-spacing:3px;margin:0 0 22px">PROFORMA INVOICE</h2><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-collapse:collapse;margin-bottom:18px"><tr><td style="padding:13px 16px;border:1px solid #e2e8f0;width:50%;vertical-align:top;font-size:11px;line-height:1.8"><strong style="display:block;margin-bottom:4px;font-size:12px">Proforma Invoice Details</strong><span style="color:#64748b">Invoice Date  : </span>${invDate}<br/><span style="color:#64748b">Invoice Number: </span><strong>${pi.pi_number}</strong></td><td style="padding:13px 16px;border:1px solid #e2e8f0;width:50%;vertical-align:top;font-size:11px;line-height:1.8"><strong style="display:block;margin-bottom:4px;font-size:12px">Bill To</strong><strong>${pi.customer_name}</strong><br/>${pi.billing_address||''}${pi.gstin?`<br/><span style="color:#64748b">GSTIN: </span>${pi.gstin}`:''}${pi.pan?`<br/><span style="color:#64748b">PAN: </span>${pi.pan}`:''}${pi.tax_number?`<br/><span style="color:#64748b">Tax / VAT: </span>${pi.tax_number}`:''}</td></tr></table><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;margin-bottom:18px"><thead><tr style="background:#f8fafc"><th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;font-weight:700;font-size:11px">Description</th><th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;font-weight:700;font-size:11px">SAC Code</th><th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;font-weight:700;font-size:11px">Qty</th><th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:right;font-weight:700;font-size:11px">Rate (${cur})</th><th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:right;font-weight:700;font-size:11px">Total (${cur})</th></tr></thead><tbody>${liRows}</tbody><tfoot><tr><td colspan="4" style="padding:9px 12px;text-align:right;font-weight:600;border-top:1px solid #e2e8f0">Total Value before Tax</td><td style="padding:9px 12px;text-align:right;font-weight:700;border-top:1px solid #e2e8f0">${f(pi.subtotal)}</td></tr>${taxLbl?`<tr><td colspan="4" style="padding:9px 12px;text-align:right;font-weight:600">${taxLbl}</td><td style="padding:9px 12px;text-align:right;font-weight:700">${f(pi.tax_amount)}</td></tr>`:''}<tr style="background:#f8fafc"><td colspan="4" style="padding:11px 12px;text-align:right;font-weight:700;font-size:13px;border-top:2px solid #cbd5e1">Grand Total</td><td style="padding:11px 12px;text-align:right;font-weight:800;font-size:14px;border-top:2px solid #cbd5e1">${f(pi.grand_total)}</td></tr></tfoot></table><div style="margin-bottom:18px"><p style="font-weight:700;margin:0 0 8px;font-size:12px">Terms and Conditions</p><ol style="margin:0;padding-left:18px;font-size:11px;line-height:1.9;color:#334155"><li style="margin-bottom:4px">All Cheques/Drafts payable in the name of <strong>${payable}</strong></li><li style="margin-bottom:4px">Payments to be made within 15 days of receipt of this Proforma Invoice</li>${rcm}<li style="margin-bottom:4px">The above-mentioned fees shall be non-refundable.</li></ol></div><div style="margin-bottom:24px">${bankBlk}</div><div style="border-top:1px solid #e2e8f0;padding-top:14px;text-align:center;color:#94a3b8;font-size:10px;font-style:italic">This is a system-generated document and does not require a signature.</div></div></body></html>`;
  const w=window.open('','_blank','width=900,height=700');w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),400);
}

// ─────────────────────────────────────────────────────────────────
// COLLECTION FORM — Add new collection entry
// ─────────────────────────────────────────────────────────────────
function CollectionForm({ pi, onSave, onCancel }) {
  const [entry, setEntry]   = useState({ amount:'', tds_pct:'', tds_amount:'', date:'', payment_reference:'', mode:'NEFT', notes:'' });
  const [saving, setSaving] = useState(false);

  const collected    = pi.total_collected || 0;
  const entryAmt     = parseFloat(entry.amount) || 0;
  const tdsAmt       = parseFloat(entry.tds_amount) || 0;
  const totalEntry   = entryAmt + tdsAmt;   // Collection Amount (Money in Bank) + TDS Amount
  const afterColl    = collected + entryAmt; // only actual money received counts toward collected
  const willFull     = entryAmt > 0 && afterColl >= (pi.grand_total || 0);
  const stillLeft    = Math.max(0, (pi.grand_total || 0) - afterColl);

  const handleSave = async () => {
    if (!entry.amount || parseFloat(entry.amount) <= 0) { alert('Enter a valid Collection Amount.'); return; }
    if (!entry.date) { alert('Enter the date of receipt.'); return; }
    if (!entry.payment_reference.trim()) { alert('Enter a payment reference / UTR number.'); return; }
    setSaving(true);
    try { await onSave({ ...entry, tds_pct: parseFloat(entry.tds_pct) || 0, tds_amount: tdsAmt, total: totalEntry }); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Record New Collection</div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">

        {/* Collection Amount (Money in Bank) */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Collection Amount – Money in Bank ({pi.currency}) *</label>
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
            <span className="px-2 text-slate-400 text-xs shrink-0">{symOf(pi.currency)}</span>
            <input type="number" min="0.01" step="0.01" value={entry.amount}
              onChange={e => setEntry(v => ({...v, amount: e.target.value}))}
              placeholder="0.00"
              className="flex-1 pr-3 py-2 text-xs focus:outline-none bg-white"/>
          </div>
        </div>

        {/* TDS % */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">TDS %</label>
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
            <input type="number" min="0" max="100" step="0.01" value={entry.tds_pct}
              onChange={e => setEntry(v => ({...v, tds_pct: e.target.value}))}
              placeholder="0"
              className="flex-1 pl-3 py-2 text-xs focus:outline-none bg-white"/>
            <span className="px-2 text-slate-400 text-xs shrink-0">%</span>
          </div>
        </div>

        {/* TDS Amount — manual input */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">TDS Amount ({pi.currency})</label>
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
            <span className="px-2 text-slate-400 text-xs shrink-0">{symOf(pi.currency)}</span>
            <input type="number" min="0" step="0.01" value={entry.tds_amount}
              onChange={e => setEntry(v => ({...v, tds_amount: e.target.value}))}
              placeholder="0.00"
              className="flex-1 pr-3 py-2 text-xs focus:outline-none bg-white"/>
          </div>
        </div>

        {/* Total (Collection + TDS) — read-only display */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Total (Collection + TDS)</label>
          <div className="flex items-center border border-slate-100 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-800 font-bold h-[34px]">
            {totalEntry > 0 ? fmtAmt(totalEntry, pi.currency) : <span className="text-slate-400">—</span>}
          </div>
        </div>

        {/* Date of Receipt */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date of Receipt *</label>
          <input type="date" value={entry.date}
            onChange={e => setEntry(v => ({...v, date: e.target.value}))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"/>
        </div>

        {/* Payment Mode */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode *</label>
          <select value={entry.mode}
            onChange={e => setEntry(v => ({...v, mode: e.target.value}))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-400">
            {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Payment Reference */}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Payment Reference / UTR *</label>
          <input type="text" value={entry.payment_reference}
            onChange={e => setEntry(v => ({...v, payment_reference: e.target.value}))}
            placeholder="e.g. UTR123456789 or CHQ001234"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"/>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
          <input type="text" value={entry.notes}
            onChange={e => setEntry(v => ({...v, notes: e.target.value}))}
            placeholder="Any additional notes"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-400"/>
        </div>
      </div>

      {/* Running total preview */}
      <div className="mb-3 p-2 rounded-lg text-xs"
           style={{background:'#eff6ff',border:'1px solid #dbeafe',color:'#1d4ed8',minHeight:'28px'}}>
        {entryAmt > 0
          ? willFull
            ? <span>After this entry: <strong>{fmtAmt(afterColl,pi.currency)}</strong> collected → <span className="font-semibold text-green-700">Fully Collected 🎉</span></span>
            : <span>After this entry: <strong>{fmtAmt(afterColl,pi.currency)}</strong> collected · <span className="text-slate-500">{fmtAmt(stillLeft,pi.currency)} remaining</span></span>
          : <span className="text-slate-400">Enter an amount to see the running total.</span>}
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="text-xs font-semibold px-4 py-1.5 rounded-lg text-white"
          style={{background: saving ? '#94a3b8' : '#16a34a'}}>
          {saving ? 'Saving…' : '✓ Save Collection'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EDIT COLLECTION MODAL — for Universal User
// ─────────────────────────────────────────────────────────────────
function EditCollectionModal({ pi, collection: col, onSave, onCancel }) {
  const [entry, setEntry] = useState({
    amount:            String(col.amount || ''),
    tds_pct:           String(col.tds_pct || ''),
    tds_amount:        String(col.tds_amount || ''),
    date:              col.date || '',
    payment_reference: col.payment_reference || '',
    mode:              col.mode || 'NEFT',
    notes:             col.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const entryAmt   = parseFloat(entry.amount) || 0;
  const tdsAmt     = parseFloat(entry.tds_amount) || 0;
  const totalEntry = entryAmt + tdsAmt;

  const handleSave = async () => {
    if (!entry.amount || parseFloat(entry.amount) <= 0) { alert('Enter a valid Collection Amount.'); return; }
    if (!entry.date) { alert('Enter the date of receipt.'); return; }
    if (!entry.payment_reference.trim()) { alert('Enter a payment reference / UTR number.'); return; }
    setSaving(true);
    try { await onSave({ ...entry, amount: entryAmt, tds_pct: parseFloat(entry.tds_pct) || 0, tds_amount: tdsAmt, total: totalEntry }); }
    finally { setSaving(false); }
  };

  const fld = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-400';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="font-bold text-sm text-slate-800">Edit Collection Entry</div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Collection Amount – Money in Bank ({pi.currency}) *</label>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
              <span className="px-2 text-slate-400 text-xs shrink-0">{symOf(pi.currency)}</span>
              <input type="number" min="0.01" step="0.01" value={entry.amount}
                onChange={e => setEntry(v => ({...v, amount: e.target.value}))}
                className="flex-1 pr-3 py-2 text-xs focus:outline-none bg-white"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">TDS %</label>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
              <input type="number" min="0" max="100" step="0.01" value={entry.tds_pct}
                onChange={e => setEntry(v => ({...v, tds_pct: e.target.value}))}
                placeholder="0"
                className="flex-1 pl-3 py-2 text-xs focus:outline-none bg-white"/>
              <span className="px-2 text-slate-400 text-xs shrink-0">%</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">TDS Amount ({pi.currency})</label>
            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
              <span className="px-2 text-slate-400 text-xs shrink-0">{symOf(pi.currency)}</span>
              <input type="number" min="0" step="0.01" value={entry.tds_amount}
                onChange={e => setEntry(v => ({...v, tds_amount: e.target.value}))}
                placeholder="0.00"
                className="flex-1 pr-3 py-2 text-xs focus:outline-none bg-white"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Total (Collection + TDS)</label>
            <div className="flex items-center border border-slate-100 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-800 font-bold h-[34px]">
              {totalEntry > 0 ? fmtAmt(totalEntry, pi.currency) : <span className="text-slate-400">—</span>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date of Receipt *</label>
            <input type="date" value={entry.date}
              onChange={e => setEntry(v => ({...v, date: e.target.value}))}
              className={fld}/>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Mode *</label>
            <select value={entry.mode}
              onChange={e => setEntry(v => ({...v, mode: e.target.value}))}
              className={fld}>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Payment Reference / UTR *</label>
            <input type="text" value={entry.payment_reference}
              onChange={e => setEntry(v => ({...v, payment_reference: e.target.value}))}
              className={fld}/>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
            <input type="text" value={entry.notes}
              onChange={e => setEntry(v => ({...v, notes: e.target.value}))}
              className={fld}/>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg text-white"
            style={{background: saving ? '#94a3b8' : '#2563eb'}}>
            {saving ? 'Saving…' : '✓ Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DETAIL PANEL
// ─────────────────────────────────────────────────────────────────
function DetailPanel({ pi, canDownload, canApprove, canRecord, canEdit, setSelPI, setShowModal, setCmt, showCollForm, setShowCollForm, doAddCollection, doEditCollection, doDeleteCollection }) {
  const collected  = pi.total_collected || 0;
  const progress   = pctOf(collected, pi.grand_total);
  const remaining  = Math.max(0, (pi.grand_total || 0) - collected);
  const canAddColl = canRecord && ['approved','fully_collected'].includes(pi.status);

  const [editingCol, setEditingCol] = useState(null);

  return (
    <Card className="p-6 shadow-none border-slate-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="font-mono font-bold text-lg" style={{color:'#1B2B4B'}}>{pi.pi_number}</span>
            <PIPill status={pi.status}/>
            <span style={{background:'#f1f5f9',color:'#475569',display:'inline-block',padding:'2px 10px',borderRadius:'9999px',fontSize:'11px',fontWeight:600}}>
              {getEntity(entityKeyOf(pi)).short}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-700">{pi.customer_name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{pi.of_number ? <>OF: <span className="font-mono">{pi.of_number}</span> · </> : ''}Created by {pi.created_by_name}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canDownload && (pi.status==='approved'||pi.status==='fully_collected') && (
            <Btn variant="success" size="sm" onClick={()=>printPI(pi)}>Download PDF</Btn>
          )}
          {canApprove && pi.status==='submitted' && (
            <>
              <Btn variant="success" size="sm" onClick={()=>{setShowModal({piId:pi.id,action:'approve'});setCmt('');}}>Approve</Btn>
              <Btn variant="danger"  size="sm" onClick={()=>{setShowModal({piId:pi.id,action:'reject'});setCmt('');}}>Reject</Btn>
            </>
          )}
          {canApprove && ['submitted','approved'].includes(pi.status) && (
            <Btn variant="ghost" size="sm" style={{color:'#64748b'}}
              onClick={()=>{setShowModal({piId:pi.id,action:'cancel'});setCmt('');}}>
              🚫 Cancel PI
            </Btn>
          )}
          <Btn variant="ghost" size="sm" onClick={()=>{setSelPI(null);setShowCollForm(false);}}>Close</Btn>
        </div>
      </div>

      {/* Customer tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          ['Customer',  pi.customer_name],
          ...(pi.gstin       ? [['GSTIN',    pi.gstin]]      : []),
          ...(pi.pan         ? [['PAN',       pi.pan]]        : []),
          ...(pi.tax_number  ? [['Tax / VAT', pi.tax_number]] : []),
          ['Address',   pi.billing_address||'—'],
        ].map(([k,v])=>(
          <div key={k} className="bg-slate-50 rounded-xl p-3">
            <div className="text-xs text-slate-400 mb-1">{k}</div>
            <div className="text-xs font-semibold text-slate-700 truncate">{v}</div>
          </div>
        ))}
      </div>

      {/* Line items */}
      <div className="overflow-x-auto rounded-xl border border-slate-100 mb-4">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr className="text-slate-400 uppercase tracking-wide text-left">
              <th className="px-4 py-3 font-semibold">Service</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold text-center">SAC</th>
              <th className="px-4 py-3 font-semibold text-center">Qty</th>
              <th className="px-4 py-3 font-semibold text-right">Rate</th>
              <th className="px-4 py-3 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(pi.line_items||[]).map((li,i)=>(
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-600">{li.service||'—'}</td>
                <td className="px-4 py-3 text-slate-600">{[li.fee_type,li.description].filter(Boolean).join(' — ')||'—'}</td>
                <td className="px-4 py-3 font-mono text-slate-400 text-center">{li.sac_code||getSAC(li.fee_type)}</td>
                <td className="px-4 py-3 text-center">{li.qty}</td>
                <td className="px-4 py-3 text-right">{fmtAmt(li.rate,pi.currency)}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmtAmt(li.total,pi.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 text-xs">
            <tr className="border-t border-slate-200">
              <td colSpan={5} className="px-4 py-3 text-right font-medium text-slate-600">Total Before Tax</td>
              <td className="px-4 py-3 text-right font-semibold">{fmtAmt(pi.subtotal,pi.currency)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-slate-400">{pi.tax_rate>0?`${pi.tax_type||'GST'} @ ${pi.tax_rate}%`:'No Tax'}</td>
              <td className="px-4 py-2 text-right">{fmtAmt(pi.tax_amount,pi.currency)}</td>
            </tr>
            <tr className="border-t-2 border-slate-300">
              <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-800">Grand Total</td>
              <td className="px-4 py-3 text-right font-bold text-sm text-slate-800">{fmtAmt(pi.grand_total,pi.currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Review details */}
      {pi.revops_reviewer && (
        <div className="bg-slate-50 rounded-xl p-4 text-xs space-y-1.5 mb-4">
          <div className="font-semibold text-slate-500 uppercase tracking-wide mb-2">Review Details</div>
          <div className="flex gap-2"><span className="text-slate-400 w-28">Reviewed by</span><span className="font-medium">{pi.revops_reviewer}</span></div>
          {pi.revops_comment && <div className="flex gap-2"><span className="text-slate-400 w-28">Comment</span><span className="font-medium">{pi.revops_comment}</span></div>}
        </div>
      )}

      {/* Collections section */}
      {['approved','fully_collected'].includes(pi.status) && (
        <div className="border-t border-slate-100 pt-5">
          <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-0.5">Collections</div>
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-green-700">{fmtAmt(collected,pi.currency)}</span> collected of {fmtAmt(pi.grand_total,pi.currency)}
                {remaining > 0
                  ? <span className="ml-2 text-amber-600 font-medium">· {fmtAmt(remaining,pi.currency)} remaining</span>
                  : <span className="ml-2 text-green-600 font-medium">· Fully collected ✓</span>}
              </div>
            </div>
            {canAddColl && (
              <button onClick={()=>setShowCollForm(v=>!v)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                style={{background:showCollForm?'#f1f5f9':'#d1fae5',color:showCollForm?'#475569':'#065f46'}}>
                {showCollForm
                  ? <span style={{display:'flex',alignItems:'center',gap:'4px'}}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
                      Cancel
                    </span>
                  : '+ Record Collection'}
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-2.5 bg-slate-100 rounded-full mb-4 overflow-hidden">
            <div style={{width:`${progress}%`,background:progress>=100?'#16a34a':'#2563eb',height:'100%',borderRadius:'9999px',transition:'width 0.4s ease'}}/>
          </div>

          {/* History table */}
          {(pi.collections||[]).length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-100 mb-4">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-slate-400 uppercase tracking-wide text-left">
                    <th className="px-3 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Collection Amount<br/><span className="normal-case font-normal text-slate-300">(Money in Bank)</span></th>
                    <th className="px-3 py-2.5 font-semibold">TDS %</th>
                    <th className="px-3 py-2.5 font-semibold">TDS Amount</th>
                    <th className="px-3 py-2.5 font-semibold">Total<br/><span className="normal-case font-normal text-slate-300">(Coll. + TDS)</span></th>
                    <th className="px-3 py-2.5 font-semibold">Mode</th>
                    <th className="px-3 py-2.5 font-semibold">Reference / UTR</th>
                    <th className="px-3 py-2.5 font-semibold">Notes</th>
                    <th className="px-3 py-2.5 font-semibold">Recorded By</th>
                    {canEdit && <th className="px-3 py-2.5 font-semibold text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...(pi.collections||[])].sort((a,b)=>new Date(b.date)-new Date(a.date)).map((c,i)=>(
                    <tr key={c.id||i} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{fmtDate(c.date)}</td>
                      <td className="px-3 py-2.5 font-semibold text-green-700">{fmtAmt(c.amount,pi.currency)}</td>
                      <td className="px-3 py-2.5 text-slate-500">{c.tds_pct != null && c.tds_pct !== '' ? `${c.tds_pct}%` : '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{c.tds_amount != null && c.tds_amount > 0 ? fmtAmt(c.tds_amount,pi.currency) : '—'}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700">
                        {c.total != null && c.total > 0 ? fmtAmt(c.total,pi.currency) : fmtAmt(c.amount,pi.currency)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{c.mode}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">{c.payment_reference}</td>
                      <td className="px-3 py-2.5 text-slate-400">{c.notes||'—'}</td>
                      <td className="px-3 py-2.5 text-slate-400">{c.recorded_by_name}</td>
                      {canEdit && (
                        <td className="px-3 py-2.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => setEditingCol(c)}
                            className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 mr-1">
                            ✏ Edit
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete this collection entry of ${fmtAmt(c.amount,pi.currency)} dated ${fmtDate(c.date)}?\n\nThis cannot be undone.`)) {
                                doDeleteCollection(c.id||i);
                              }
                            }}
                            className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50">
                            🗑 Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-2.5 font-semibold text-slate-600">Total collected</td>
                    <td className="px-3 py-2.5 font-bold text-green-700">{fmtAmt(collected,pi.currency)}</td>
                    <td colSpan={canEdit ? 8 : 7}/>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Add collection form */}
          {showCollForm && canAddColl && (
            <CollectionForm
              pi={pi}
              onSave={async (entry) => { await doAddCollection(entry); setShowCollForm(false); }}
              onCancel={() => setShowCollForm(false)}
            />
          )}

          {(pi.collections||[]).length === 0 && !showCollForm && (
            <div className="text-center text-xs text-slate-400 py-4">
              No collections recorded yet.
              {canAddColl && <span className="ml-1">Click <strong>+ Record Collection</strong> to add one.</span>}
            </div>
          )}
        </div>
      )}

      {/* Edit Collection Modal */}
      {editingCol && (
        <EditCollectionModal
          pi={pi}
          collection={editingCol}
          onSave={async (updated) => {
            await doEditCollection(editingCol.id || editingCol, updated);
            setEditingCol(null);
          }}
          onCancel={() => setEditingCol(null)}
        />
      )}
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════
// CREATE PI MODAL
// ═════════════════════════════════════════════════════════════════
function CreatePIModal({ user, onClose, onCreated }) {
  const blankLine = () => ({ service:'', service_custom:'', fee_type:'', description:'', qty:1, rate:0 });
  const [np, setNp] = useState({
    entity:'fynd', country:'', customer_name:'', billing_address:'',
    gstin:'', pan:'', tax_number:'', currency:'INR',
    tax_type:'', tax_rate:0,
    line_items:[ blankLine() ],
    finance_approvers:[],
  });
  const [saving, setSaving] = useState(false);
  const [errs, setErrs] = useState([]);

  const u = (k,v) => setNp(p=>({...p,[k]:v}));
  const setLine = (i,k,v) => setNp(p=>({...p,line_items:p.line_items.map((li,idx)=>idx===i?{...li,[k]:(k==='qty'||k==='rate')?(parseFloat(v)||0):v}:li)}));
  const addLine = () => setNp(p=>({...p,line_items:[...p.line_items,blankLine()]}));
  const rmLine  = i => setNp(p=>({...p,line_items:p.line_items.filter((_,idx)=>idx!==i)}));

  const handleEntity = v => { const cfg=getEntity(v); setNp(p=>({...p,entity:v,currency:cfg.defaultCurrency||p.currency})); };

  const isIndia   = np.country.trim().toLowerCase()==='india';
  const fixedGST  = np.entity==='fynd' && isIndia;
  const taxRate   = fixedGST ? 18 : (Number(np.tax_rate)||0);
  const subtotal  = np.line_items.reduce((s,li)=>s + (parseFloat(li.qty)||0)*(parseFloat(li.rate)||0), 0);
  const taxAmount = subtotal * taxRate/100;
  const grand     = subtotal + taxAmount;
  const svcName   = li => li.service==='__other__' ? (li.service_custom||'').trim() : li.service;

  const submit = async () => {
    const e = [];
    if (!np.entity)                 e.push('Entity is required');
    if (!np.country.trim())         e.push('Country is required');
    if (!np.customer_name.trim())   e.push('Customer legal name is required');
    if (!np.billing_address.trim()) e.push('Address is required');
    if (isIndia) { if (!np.pan.trim()) e.push('PAN is required for India'); }
    else         { if (!np.tax_number.trim()) e.push('Tax / VAT number is required'); }
    const goodLines = np.line_items.filter(li => svcName(li) && li.fee_type && (parseFloat(li.rate)||0)>0);
    if (!goodLines.length) e.push('Add at least one complete line (Service + Fee Type + Rate)');
    if (!np.finance_approvers.length) e.push('Select at least one Finance approver');
    setErrs(e);
    if (e.length) return;

    setSaving(true);
    try {
      const piNum = await genPINumber(np.entity);
      const line_items = goodLines.map(li => ({
        service: svcName(li), fee_type: li.fee_type, description: li.description||'',
        sac_code: SAC_MAP[li.fee_type]||'998314',
        qty: parseFloat(li.qty)||1, rate: parseFloat(li.rate)||0,
        total: (parseFloat(li.qty)||1)*(parseFloat(li.rate)||0),
      }));
      const sub = line_items.reduce((s,li)=>s+li.total,0);
      const tr  = taxRate, ta = sub*tr/100;
      const docData = {
        pi_number:piNum, entity:np.entity, is_standalone:true,
        of_id:'', of_number:'',
        status:'submitted',
        customer_name:np.customer_name.trim(), billing_address:np.billing_address.trim(),
        gstin:np.gstin.trim(), pan:np.pan.trim(), tax_number:np.tax_number.trim(),
        country:np.country.trim(), sales_team:'',
        currency:np.currency, line_items,
        subtotal:sub, tax_type: fixedGST?'GST':(np.tax_type||''), tax_rate:tr, tax_amount:ta, grand_total:sub+ta,
        created_by_name:user?.name||'', created_by_email:user?.email||'',
        sales_rep_email:'', sales_rep_name:'', sales_rep_slack_id:'',
        finance_approvers: np.finance_approvers,
        finance_approvers_names: np.finance_approvers.map(em=>(FINANCE_USERS.find(u=>u.email===em)||{}).name||em),
        finance_approvers_slack_ids: np.finance_approvers.map(em=>(FINANCE_USERS.find(u=>u.email===em)||{}).slack||''),
        revops_reviewer:'', revops_comment:'', revops_reviewed_at:null,
        created_at: serverTimestamp(), slack_thread_ts:null,
      };
      const ref = await addDoc(collection(db,'proforma_invoices'), docData);
      const ts  = await notifyPI({...docData, id:ref.id}, 'submitted');
      if (ts) await updateDoc(doc(db,'proforma_invoices',ref.id), { slack_thread_ts: ts });
      onCreated();
      onClose();
    } catch(err) { console.error('create PI', err); setErrs(['Failed to create PI — '+(err?.message||'unknown error')]); }
    finally { setSaving(false); }
  };

  const fld = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300';
  const lbl = 'block text-[11px] font-bold uppercase tracking-widest mb-1 text-slate-400';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <Card className="shadow-2xl w-full max-w-3xl p-6 my-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold" style={{color:NAVY}}>New Proforma Invoice</h3>
            <p className="text-xs text-slate-400 mt-0.5">For a customer without an Order Form. Routes to Finance for approval.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        {errs.length>0 && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {errs.map((x,i)=><div key={i}>• {x}</div>)}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={lbl}>Issuing Entity <span className="text-red-400">*</span></label>
            <select value={np.entity} onChange={e=>handleEntity(e.target.value)} className={fld+' cursor-pointer'}>
              {ENTITY_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Country <span className="text-red-400">*</span></label>
            <input value={np.country} onChange={e=>u('country',e.target.value)} placeholder="e.g. India, UAE, United Kingdom" className={fld}/>
          </div>
        </div>

        <div className="mb-4">
          <label className={lbl}>Customer Legal Name <span className="text-red-400">*</span></label>
          <input value={np.customer_name} onChange={e=>u('customer_name',e.target.value)} placeholder="Full registered legal name" className={fld}/>
        </div>

        <div className="mb-4">
          <label className={lbl}>Billing Address <span className="text-red-400">*</span></label>
          <textarea value={np.billing_address} onChange={e=>u('billing_address',e.target.value)} rows={2} placeholder="Registered billing address" className={fld+' resize-none'}/>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          {isIndia ? (
            <>
              <div>
                <label className={lbl}>GSTIN <span className="text-slate-300">(optional)</span></label>
                <input value={np.gstin} onChange={e=>u('gstin',e.target.value)} placeholder="27AADCB2230M1ZT" className={fld+' font-mono'}/>
              </div>
              <div>
                <label className={lbl}>PAN <span className="text-red-400">*</span></label>
                <input value={np.pan} onChange={e=>u('pan',e.target.value)} placeholder="AADCB2230M" className={fld+' font-mono'}/>
              </div>
            </>
          ) : (
            <div className="col-span-2">
              <label className={lbl}>Tax / VAT Number <span className="text-red-400">*</span></label>
              <input value={np.tax_number} onChange={e=>u('tax_number',e.target.value)} placeholder="Local tax / VAT registration number" className={fld+' font-mono'}/>
            </div>
          )}
        </div>

        <div className="mb-2 flex items-center justify-between">
          <label className={lbl+' mb-0'}>Line Items</label>
          <span className="text-xs text-slate-400">Currency: <strong>{np.currency}</strong></span>
        </div>
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-4">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left font-semibold">Service</th>
                <th className="px-2 py-2 text-left font-semibold">Fee Type</th>
                <th className="px-2 py-2 text-center font-semibold" style={{width:70}}>SAC</th>
                <th className="px-2 py-2 text-right font-semibold" style={{width:55}}>Qty</th>
                <th className="px-2 py-2 text-right font-semibold" style={{width:100}}>Rate</th>
                <th className="px-2 py-2 text-left font-semibold">Description</th>
                <th style={{width:32}}></th>
              </tr>
            </thead>
            <tbody>
              {np.line_items.map((li,i)=>(
                <tr key={i} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-2">
                    <select value={li.service} onChange={e=>setLine(i,'service',e.target.value)} className={fld+' cursor-pointer'}>
                      <option value="">Service…</option>
                      {SERVICES.map(s=><option key={s} value={s}>{s}</option>)}
                      <option value="__other__">Others (custom)…</option>
                    </select>
                    {li.service==='__other__' && (
                      <input value={li.service_custom} onChange={e=>setLine(i,'service_custom',e.target.value)} placeholder="Custom service name *" className={fld+' mt-1'}/>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <select value={li.fee_type} onChange={e=>setLine(i,'fee_type',e.target.value)} className={fld+' cursor-pointer'}>
                      <option value="">Fee Type…</option>
                      {FEE_TYPES.map(f=><option key={f} value={f}>{f}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-slate-500">{li.fee_type?(SAC_MAP[li.fee_type]||'—'):'—'}</td>
                  <td className="px-2 py-2"><input type="number" min="0" value={li.qty} onChange={e=>setLine(i,'qty',e.target.value)} className={fld+' text-right'}/></td>
                  <td className="px-2 py-2"><input type="number" min="0" value={li.rate} onChange={e=>setLine(i,'rate',e.target.value)} className={fld+' text-right'}/></td>
                  <td className="px-2 py-2"><input value={li.description} onChange={e=>setLine(i,'description',e.target.value)} placeholder="Optional" className={fld}/></td>
                  <td className="px-2 py-2 text-center">
                    {np.line_items.length>1 && <button onClick={()=>rmLine(i)} className="text-slate-300 hover:text-red-500">✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addLine} className="text-xs font-semibold text-teal-600 hover:text-teal-700 mb-5">+ Add line item</button>

        <div className="flex justify-end mb-5">
          <div className="w-64 text-sm">
            <div className="flex justify-between py-1"><span className="text-slate-500">Subtotal</span><span className="font-mono">{fmtAmt(subtotal,np.currency)}</span></div>
            {fixedGST ? (
              <div className="flex justify-between py-1"><span className="text-slate-500">GST (18%)</span><span className="font-mono">{fmtAmt(taxAmount,np.currency)}</span></div>
            ) : (
              <div className="flex items-center justify-between py-1 gap-2">
                <input value={np.tax_type} onChange={e=>u('tax_type',e.target.value)} placeholder="Tax label" className="border border-slate-200 rounded px-2 py-1 text-xs w-24"/>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" value={np.tax_rate} onChange={e=>u('tax_rate',e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs w-14 text-right"/>
                  <span className="text-slate-400 text-xs">%</span>
                </div>
              </div>
            )}
            <div className="flex justify-between py-2 border-t border-slate-200 mt-1 font-bold" style={{color:NAVY}}><span>Grand Total</span><span className="font-mono">{fmtAmt(grand,np.currency)}</span></div>
          </div>
        </div>

        <div className="mb-5">
          <label className={lbl}>Finance Approver(s) <span className="text-red-400">*</span></label>
          <div className="flex flex-wrap gap-2">
            {FINANCE_USERS.map(fu=>{
              const on = np.finance_approvers.includes(fu.email);
              return (
                <button key={fu.email} type="button"
                  onClick={()=>u('finance_approvers', on?np.finance_approvers.filter(x=>x!==fu.email):[...np.finance_approvers,fu.email])}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                  style={on?{background:NAVY,color:'#fff',borderColor:NAVY}:{background:'#f8fafc',color:'#64748b',borderColor:'#e2e8f0'}}>
                  {fu.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="success" onClick={submit} disabled={saving}>{saving?'Creating…':'Create PI'}</Btn>
        </div>
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════
export default function ProformaInvoices() {
  const { user } = useAuth();
  const { toast, show, hide } = useToast();

  const [pis,          setPIs]          = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selPI,        setSelPI]        = useState(null);
  const [showModal,    setShowModal]    = useState(null);
  const [cmt,          setCmt]          = useState('');
  const [showCollForm, setShowCollForm] = useState(false);
  const [q,            setQ]            = useState('');
  const [showCreate,   setShowCreate]   = useState(false);

  const canCreatePI = user?.role==='revops' || user?.role==='finance' || user?.isUniversal;
  const canApprove  = user?.role==='revops' || user?.isUniversal;
  const canRecord   = user?.role==='revops' || user?.role==='finance' || user?.isUniversal;
  const canDownload = user?.role==='sales'  || user?.role==='finance' || user?.isUniversal || user?.role==='revops';
  const canEdit     = !!user?.isUniversal;  // only Universal User can edit/delete collection entries

  const isPIOwner = pi => !!user?.email && (pi?.created_by_email===user.email || pi?.sales_rep_email===user.email);

  const loadPIs = useCallback(async () => {
    if (!db) { setLoading(false); return; }
    setLoading(true);
    try {
      let snap;
      try   { snap = await getDocs(query(collection(db,'proforma_invoices'),orderBy('created_at','desc'))); }
      catch { snap = await getDocs(collection(db,'proforma_invoices')); }
      const all = []; snap.forEach(d => all.push({id:d.id,...d.data()}));
      setPIs(user?.role==='sales' ? all.filter(p=>p.created_by_email===user.email||p.sales_rep_email===user.email) : all);
    } catch(e) { console.error('loadPIs',e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { loadPIs(); }, [loadPIs]);

  const doApprove = async () => {
    try {
      await updateDoc(doc(db,'proforma_invoices',showModal.piId),{status:'approved',revops_reviewer:user.name||user.email,revops_comment:cmt,revops_reviewed_at:serverTimestamp()});
      await loadPIs();
      const pi=pis.find(p=>p.id===showModal.piId);
      if(pi){ const rSlack=REVOPS_USERS.find(u=>u.email===user.email)?.slack||null; await notifyPI({...pi,status:'approved',revops_reviewer:user.name||user.email,revops_reviewer_slack_id:rSlack,revops_comment:cmt},'approved'); }
      if(selPI?.id===showModal.piId) setSelPI(p=>({...p,status:'approved',revops_reviewer:user.name||user.email,revops_comment:cmt}));
      setShowModal(null); setCmt(''); show('PI Approved ✓');
    } catch(e) { show('Error: '+e.message,'error'); }
  };

  const doReject = async () => {
    if(!cmt.trim()){alert('Rejection reason is required.');return;}
    try {
      await updateDoc(doc(db,'proforma_invoices',showModal.piId),{status:'rejected',revops_reviewer:user.name||user.email,revops_comment:cmt,revops_reviewed_at:serverTimestamp()});
      await loadPIs();
      const pi=pis.find(p=>p.id===showModal.piId);
      if(pi){ const rSlack=REVOPS_USERS.find(u=>u.email===user.email)?.slack||null; await notifyPI({...pi,status:'rejected',revops_reviewer:user.name||user.email,revops_reviewer_slack_id:rSlack,revops_comment:cmt},'rejected'); }
      if(selPI?.id===showModal.piId) setSelPI(p=>({...p,status:'rejected',revops_reviewer:user.name||user.email,revops_comment:cmt}));
      setShowModal(null); setCmt(''); show('PI Rejected');
    } catch(e) { show('Error: '+e.message,'error'); }
  };

  const doCancel = async () => {
    if(!cmt.trim()){alert('Please provide a reason for cancellation.');return;}
    try {
      await updateDoc(doc(db,'proforma_invoices',showModal.piId),{status:'cancelled',revops_reviewer:user.name||user.email,revops_comment:cmt,revops_reviewed_at:serverTimestamp()});
      await loadPIs();
      const pi=pis.find(p=>p.id===showModal.piId);
      if(pi){ const rSlack=REVOPS_USERS.find(u=>u.email===user.email)?.slack||null; await notifyPI({...pi,status:'cancelled',revops_reviewer:user.name||user.email,revops_reviewer_slack_id:rSlack,revops_comment:cmt},'cancelled'); }
      if(selPI?.id===showModal.piId) setSelPI(p=>({...p,status:'cancelled',revops_reviewer:user.name||user.email,revops_comment:cmt}));
      setShowModal(null); setCmt(''); show('PI Cancelled');
    } catch(e) { show('Error: '+e.message,'error'); }
  };

  const doAddCollection = useCallback(async (entry) => {
    if (!selPI) return;
    const pi       = selPI;
    const existing = pi.collections || [];
    const newEntry = {
      id: Date.now().toString(),
      amount:            parseFloat(entry.amount),
      tds_pct:           parseFloat(entry.tds_pct) || 0,
      tds_amount:        parseFloat(entry.tds_amount) || 0,
      total:             parseFloat(entry.total) || parseFloat(entry.amount),
      date:              entry.date,
      payment_reference: entry.payment_reference.trim(),
      mode:              entry.mode,
      notes:             entry.notes.trim(),
      recorded_by_name:  user.name || user.email,
      recorded_by_email: user.email,
      recorded_at:       new Date().toISOString(),
    };
    const updated        = [...existing, newEntry];
    const totalCollected = updated.reduce((s,c) => s + (parseFloat(c.amount)||0), 0);
    const isFullyPaid    = totalCollected >= (pi.grand_total || 0);
    await updateDoc(doc(db,'proforma_invoices',pi.id),{
      collections:     updated,
      total_collected: totalCollected,
      ...(isFullyPaid && pi.status !== 'fully_collected' ? {status:'fully_collected'} : {}),
    });
    await loadPIs();
    const newStatus = isFullyPaid ? 'fully_collected' : pi.status;
    setSelPI({...pi, collections:updated, total_collected:totalCollected, status:newStatus});
    show(isFullyPaid ? '🎉 Fully collected! PI marked as Fully Collected.' : '✓ Collection recorded.');
  }, [selPI, user, loadPIs, show]);

  // Edit a collection entry (Universal User only)
  const doEditCollection = useCallback(async (colId, updatedFields) => {
    if (!selPI) return;
    const pi = selPI;
    const updated = (pi.collections || []).map(c => {
      const matchId = c.id != null ? c.id === colId : false;
      if (!matchId) return c;
      return {
        ...c,
        amount:            parseFloat(updatedFields.amount),
        tds_pct:           parseFloat(updatedFields.tds_pct) || 0,
        tds_amount:        parseFloat(updatedFields.tds_amount) || 0,
        total:             parseFloat(updatedFields.total) || parseFloat(updatedFields.amount),
        date:              updatedFields.date,
        payment_reference: updatedFields.payment_reference.trim(),
        mode:              updatedFields.mode,
        notes:             updatedFields.notes.trim(),
        edited_by_name:    user.name || user.email,
        edited_at:         new Date().toISOString(),
      };
    });
    const totalCollected = updated.reduce((s,c) => s + (parseFloat(c.amount)||0), 0);
    const isFullyPaid    = totalCollected >= (pi.grand_total || 0);
    const newStatus      = isFullyPaid ? 'fully_collected' : (pi.status === 'fully_collected' ? 'approved' : pi.status);
    await updateDoc(doc(db,'proforma_invoices',pi.id), {
      collections:     updated,
      total_collected: totalCollected,
      status:          newStatus,
    });
    await loadPIs();
    setSelPI({...pi, collections:updated, total_collected:totalCollected, status:newStatus});
    show('✓ Collection entry updated.');
  }, [selPI, user, loadPIs, show]);

  // Delete a collection entry (Universal User only)
  const doDeleteCollection = useCallback(async (colId) => {
    if (!selPI) return;
    const pi      = selPI;
    const updated = (pi.collections || []).filter(c => c.id !== colId);
    const totalCollected = updated.reduce((s,c) => s + (parseFloat(c.amount)||0), 0);
    const isFullyPaid    = totalCollected >= (pi.grand_total || 0);
    const newStatus      = isFullyPaid ? 'fully_collected' : (pi.status === 'fully_collected' ? 'approved' : pi.status);
    await updateDoc(doc(db,'proforma_invoices',pi.id), {
      collections:     updated,
      total_collected: totalCollected,
      status:          newStatus,
    });
    await loadPIs();
    setSelPI({...pi, collections:updated, total_collected:totalCollected, status:newStatus});
    show('Collection entry deleted.');
  }, [selPI, loadPIs, show]);

  const pending        = pis.filter(p=>p.status==='submitted').length;
  const approved       = pis.filter(p=>p.status==='approved').length;
  const rejected       = pis.filter(p=>p.status==='rejected').length;
  const cancelled      = pis.filter(p=>p.status==='cancelled').length;
  const fullyCollected = pis.filter(p=>p.status==='fully_collected').length;

  const ql = q.trim().toLowerCase();
  const shownPis = ql
    ? pis.filter(p => [p.pi_number, p.customer_name, p.of_number, p.created_by_name, p.status]
        .some(v => String(v||'').toLowerCase().includes(ql)))
    : pis;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{color:NAVY}}>Proforma Invoices</h2>
          <p className="text-sm text-slate-400 mt-0.5">All Proforma Invoices — OF-linked and direct (no-OF)</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
            <input value={q} onChange={e=>setQ(e.target.value)}
              placeholder="Search PI #, customer, OF #, creator, status…"
              className="w-72 pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-200"/>
            {q && (
              <button onClick={()=>setQ('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
            )}
          </div>
          {canCreatePI && (
            <Btn variant="primary" onClick={()=>setShowCreate(true)}>+ New PI</Btn>
          )}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          ['Pending Approval', pending,        '#fef3c7','#92400e'],
          ['Approved',         approved,       '#d1fae5','#065f46'],
          ['Rejected',         rejected,       '#fee2e2','#991b1b'],
          ['Cancelled',        cancelled,      '#f1f5f9','#64748b'],
          ['Fully Collected',  fullyCollected, '#dcfce7','#14532d'],
        ].map(([lbl,val,bg,fg])=>(
          <Card key={lbl} className="p-4" style={{borderColor:bg}}>
            <div className="text-2xl font-bold" style={{color:fg}}>{val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{lbl}</div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm">Loading…</div>
        ) : !pis.length ? (
          <div className="p-16 text-center">
            <div className="text-5xl mb-3">🧾</div>
            <div className="text-slate-600 font-semibold">No Proforma Invoices yet</div>
            <div className="text-slate-400 text-sm mt-1">PIs are raised from the Order Form detail page</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-3 font-semibold">PI Number</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">OF Number</th>
                  <th className="px-4 py-3 font-semibold">Created By</th>
                  <th className="px-4 py-3 font-semibold">Grand Total</th>
                  <th className="px-4 py-3 font-semibold">Collected</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Reviewed By</th>
                </tr>
              </thead>
              <tbody>
                {shownPis.length===0 ? (
                  <tr><td colSpan={8} className="p-10 text-center text-slate-400 text-sm">No PIs match "{q}".</td></tr>
                ) : shownPis.map(pi=>(
                  <Fragment key={pi.id}>
                    <tr
                      onClick={()=>{ setSelPI(selPI?.id===pi.id?null:pi); setShowCollForm(false); }}
                      className="border-t border-slate-100 cursor-pointer transition-colors"
                      style={selPI?.id===pi.id?{background:'#f0fdf4'}:{}}
                      onMouseEnter={e=>{ if(selPI?.id!==pi.id) e.currentTarget.style.background='#f8fafc'; }}
                      onMouseLeave={e=>{ if(selPI?.id!==pi.id) e.currentTarget.style.background=''; }}>
                      <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-700">
                        <span className="inline-block w-3 mr-1.5 text-slate-400">{selPI?.id===pi.id?'▾':'▸'}</span>
                        {pi.pi_number||'—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600 max-w-[160px] truncate">{pi.customer_name||'—'}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-400">{pi.of_number||'—'}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{pi.created_by_name||'—'}</td>
                      <td className="px-4 py-3.5 text-xs font-semibold">{fmtAmt(pi.grand_total,pi.currency)}</td>
                      <td className="px-4 py-3.5 text-xs">
                        {(pi.total_collected||0)>0
                          ? <span className="text-green-700 font-semibold">{fmtAmt(pi.total_collected,pi.currency)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5"><PIPill status={pi.status}/></td>
                      <td className="px-4 py-3.5 text-xs text-slate-400">{pi.revops_reviewer||'—'}</td>
                    </tr>
                    {selPI?.id===pi.id && (
                      <tr>
                        <td colSpan={8} className="bg-slate-50 border-t border-slate-100" style={{padding:0}}>
                          <div className="px-4 pb-4 pt-2">
                            <DetailPanel
                              pi={selPI}
                              canDownload={canDownload || isPIOwner(selPI)}
                              canApprove={selPI?.is_standalone ? (user?.role==='finance'||user?.isUniversal) : canApprove}
                              canRecord={canRecord}
                              canEdit={canEdit}
                              setSelPI={setSelPI}
                              setShowModal={setShowModal}
                              setCmt={setCmt}
                              showCollForm={showCollForm}
                              setShowCollForm={setShowCollForm}
                              doAddCollection={doAddCollection}
                              doEditCollection={doEditCollection}
                              doDeleteCollection={doDeleteCollection}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showCreate && (
        <CreatePIModal
          user={user}
          onClose={()=>setShowCreate(false)}
          onCreated={()=>{ loadPIs(); show('Proforma Invoice created ✓ — routed to Finance for approval.'); }}
        />
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="shadow-2xl w-full max-w-md p-6">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">{showModal.action==='approve'?'\u2705':showModal.action==='cancel'?'🚫':'\u274C'}</div>
              <div className="text-lg font-bold text-slate-800 mb-1">
                {showModal.action==='approve'?'Approve Proforma Invoice?':showModal.action==='cancel'?'Cancel Proforma Invoice?':'Reject Proforma Invoice?'}
              </div>
              <div className="text-sm text-slate-400">
                {showModal.action==='approve'?'Sales Rep will be able to download the PDF.':showModal.action==='cancel'?'This PI will be marked as Cancelled. The record is kept for audit purposes.':'Sales Rep will be notified with the reason.'}
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">{showModal.action==='approve'?'Comments (optional)':'Reason *'}</label>
              <textarea value={cmt} onChange={e=>setCmt(e.target.value)} rows={3}
                placeholder={showModal.action==='approve'?'Any notes…':'Please provide a reason…'}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"/>
            </div>
            <div className="flex gap-3">
              <Btn variant="ghost" onClick={()=>{setShowModal(null);setCmt('');}}>Close</Btn>
              <Btn
                variant={showModal.action==='approve'?'success':showModal.action==='cancel'?'ghost':'danger'}
                style={showModal.action==='cancel'?{background:'#475569',color:'#fff',borderRadius:'10px',padding:'8px 18px',fontSize:'14px',fontWeight:600}:{}}
                onClick={showModal.action==='approve'?doApprove:showModal.action==='cancel'?doCancel:doReject}>
                {showModal.action==='approve'?'Confirm Approval':showModal.action==='cancel'?'Confirm Cancellation':'Confirm Rejection'}
              </Btn>
            </div>
          </Card>
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}
