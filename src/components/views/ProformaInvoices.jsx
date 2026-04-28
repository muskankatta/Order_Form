import { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebase.js';
import { collection, getDocs, updateDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext.jsx';
import { Card, Btn, Lbl, TA, Toast } from '../ui/index.jsx';
import { useToast } from '../../hooks/useToast.js';
import { fmtDate } from '../../utils/dates.js';

import { SERVICES } from '../../constants/formOptions.js';

const NAVY = '#1B2B4B';
const T    = '#00C3B5';

const FEE_TYPES = ['Setup Fee', 'One Time Fee', 'Subscription Fee'];
const SAC_MAP   = { 'Setup Fee':'998314', 'One Time Fee':'998314', 'Subscription Fee':'998599' };
const CH        = { India:'C0AQTCE3PNY', Global:'C08CBBNRAKZ', 'AI/SaaS':'C0978TZNGM8' };
const BOLTIC    = import.meta.env.VITE_BOLTIC_SLACK_URL || '';

const getSAC    = ft => SAC_MAP[ft] || '998314';
const symOf     = cur => cur==='USD'?'$':cur==='AED'?'AED\u00A0':'\u20B9';
const fmtAmt    = (n,cur) => symOf(cur)+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const entityOf  = of => { const n=of?.of_number||''; return (n.startsWith('OFYT')||n.startsWith('OF-YT-'))?'yavi':'fynd'; };
const isIndia   = of => of?.sales_team==='India'||(of?.country||'').toLowerCase()==='india';
const fixedTax  = of => entityOf(of)==='fynd'&&isIndia(of);
const subtot    = items => items.reduce((s,li)=>s+((parseFloat(li.qty)||0)*(parseFloat(li.rate)||0)),0);

function getCurrentFY() {
  const n=new Date(); const y=n.getMonth()>=3?n.getFullYear()+1:n.getFullYear();
  return String(y).slice(-2);
}

async function genPINumber(ent) {
  const fy = getCurrentFY();
  const re = ent==='yavi'?/^PI-YT-(\d{5})-FY/:/^PI-A(\d{5})-FY/;
  const snap = await getDocs(collection(db,'proforma_invoices'));
  let max = 0;
  snap.forEach(d=>{ const m=(d.data().pi_number||'').match(re); if(m) max=Math.max(max,parseInt(m[1])); });
  const n = String(max+1).padStart(5,'0');
  return ent==='yavi'?`PI-YT-${n}-FY${fy}`:`PI-A${n}-FY${fy}`;
}

async function notifyPI(pi, event) {
  if (!BOLTIC) return null;
  try {
    const ch = CH[pi.sales_team]||CH['India'];
    const msgs = {
      submitted: `🧾 *Proforma Invoice Raised* — *${pi.pi_number}*\n*Customer:* ${pi.customer_name}  |  *OF:* ${pi.of_number}\n*By:* ${pi.created_by_name}  |  *Amount:* ${fmtAmt(pi.grand_total,pi.currency)}\n⏳ Awaiting RevOps Approval`,
      cancelled: `🚫 *Proforma Invoice Cancelled* — *${pi.pi_number}*\n*Customer:* ${pi.customer_name}  |  *OF:* ${pi.of_number}\n*Cancelled by:* ${pi.revops_reviewer}\n*Reason:* ${pi.revops_comment||'Not specified'}`,
      approved:  `✅ *Proforma Invoice Approved* — *${pi.pi_number}*\n*Customer:* ${pi.customer_name}  |  *Amount:* ${fmtAmt(pi.grand_total,pi.currency)}\n*Approved by:* ${pi.revops_reviewer}\n📥 Sales Rep can now download the PI PDF`,
      rejected:  `❌ *Proforma Invoice Rejected* — *${pi.pi_number}*\n*Customer:* ${pi.customer_name}  |  *OF:* ${pi.of_number}\n*Rejected by:* ${pi.revops_reviewer}\n*Reason:* ${pi.revops_comment||'Not specified'}`,
    };
    const body = { channel:ch, text:msgs[event]||'' };
    if (pi.slack_thread_ts) body.thread_ts = pi.slack_thread_ts;
    const res  = await fetch(BOLTIC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const raw  = await res.text();
    if (raw) { try { const d=JSON.parse(raw); if(event==='submitted'&&d.result?.ts) return d.result.ts; } catch(_){} }
  } catch(e) { console.warn('PI Slack notify failed:',e); }
  return null;
}

// ── status pill colours ──
const STATUS_STYLE = {
  submitted: { background:'#fef3c7', color:'#92400e' },
  approved:  { background:'#d1fae5', color:'#065f46' },
  rejected:  { background:'#fee2e2', color:'#991b1b' },
  cancelled: { background:'#f1f5f9', color:'#64748b' },
};
const STATUS_LABEL = { submitted:'Pending Approval', approved:'Approved', rejected:'Rejected', cancelled:'Cancelled' };

function PIPill({ status }) {
  return (
    <span style={{ ...STATUS_STYLE[status], display:'inline-block', padding:'2px 10px',
      borderRadius:'9999px', fontSize:'11px', fontWeight:600 }}>
      {STATUS_LABEL[status]||status}
    </span>
  );
}

// ── blank line item ──
function blank() { return { service:'', fee_type:'', description:'', qty:1, rate:0 }; }

// ══════════════════════════════════════════════════════════════════
// PI PDF PRINT
// ══════════════════════════════════════════════════════════════════
function printPI(pi) {
  const isYavi  = pi.entity==='yavi';
  const inIndia = pi.sales_team==='India'||(pi.country||'').toLowerCase()==='india';
  const cur     = pi.currency||'INR';
  const f       = n => symOf(cur)+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const invDate = pi.revops_reviewed_at ? fmtDate(pi.revops_reviewed_at.toDate ? pi.revops_reviewed_at.toDate().toISOString().split('T')[0] : pi.revops_reviewed_at) : fmtDate(pi.created_at?.toDate?.()?.toISOString?.()?.split?.('T')?.[0]||'');
  const taxLbl  = `${pi.tax_type||'GST'} @${pi.tax_rate||0}%`;

  const hdr = isYavi
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr>
        <td style="width:45%;vertical-align:middle"><div style="font-size:22px;font-weight:900;color:#1e293b;letter-spacing:-1px">YAVI</div></td>
        <td style="width:55%;text-align:right;font-size:11px;line-height:1.65;color:#334155">
          <strong style="font-size:12px;color:#1e293b">Yavi Technologies FZCO</strong><br/>
          B1, Office 129, Dubai CommerCity,<br/>117th St &ndash; Umm Ramool, Dubai<br/>
          VAT: 104789269800003 &nbsp;|&nbsp; LICENSE: 50455
        </td></tr></table>`
    : `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr>
        <td style="width:45%;vertical-align:middle"><div style="font-size:26px;font-weight:900;color:#ee4d37;letter-spacing:-1px">fynd</div></td>
        <td style="width:55%;text-align:right;font-size:11px;line-height:1.65;color:#334155">
          <strong style="font-size:12px;color:#1e293b">Shopsense Retail Technologies Ltd.</strong><br/>
          1st Floor Wework Vijay Diamond, Opp. SBI Branch,<br/>
          Cross Road B, Ajit Nagar, Kondivita,<br/>Andheri East, Mumbai &ndash; 400093<br/>
          MOB: +91 9321 938 025 &nbsp;|&nbsp; CIN: U52100MH2012PLC236314<br/>
          GSTIN: 27AALCA0442L1ZM &nbsp;|&nbsp; PAN: AALCA0442L
        </td></tr></table>`;

  const liRows = (pi.line_items||[]).map(li =>
    `<tr>
      <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top">
        <div style="color:#1e293b">${[li.fee_type,li.description].filter(Boolean).join(' \u2014 ')}</div>
        <div style="color:#94a3b8;font-size:10px;margin-top:2px">${li.service||''}</div>
      </td>
      <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${li.sac_code||getSAC(li.fee_type)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${li.qty}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:right">${f(li.rate)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600">${f(li.total)}</td>
    </tr>`
  ).join('');

  const bankBlk = (!isYavi && inIndia)
    ? `<p style="font-weight:700;margin:0 0 6px;font-size:11.5px;text-decoration:underline">Bank Details for NEFT / RTGS:</p>
       <p style="margin:0;font-size:11px;line-height:1.9;color:#334155">
         Beneficiary Name: <strong>Shopsense Retail Technologies Ltd</strong><br/>
         Account No: 643805051548<br/>IFSC code: ICIC0006438<br/>
         Bank Name: ICICI Bank<br/>Branch: Sakinaka, Andheri (E), Mumbai, Maharashtra 400072
       </p>`
    : `<p style="margin:0;font-size:11px;color:#334155"><strong>Bank Details:</strong> Please contact your Fynd Point of Contact (POC) for bank details.</p>`;

  const payable = isYavi ? 'Yavi Technologies FZCO' : 'Shopsense Retail Technologies Limited';
  const rcm     = (!isYavi && inIndia) ? `<li style="margin-bottom:4px">Reverse Charge Mechanism (RCM): No</li>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#1e293b;padding:36px 44px}</style>
    </head><body>
    <div style="max-width:760px;margin:0 auto">
      ${hdr}
      <hr style="border:none;border-top:2.5px solid #1e293b;margin:0 0 18px"/>
      <h2 style="text-align:center;font-size:17px;font-weight:bold;letter-spacing:3px;margin:0 0 22px">PROFORMA INVOICE</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-collapse:collapse;margin-bottom:18px">
        <tr>
          <td style="padding:13px 16px;border:1px solid #e2e8f0;width:50%;vertical-align:top;font-size:11px;line-height:1.8">
            <strong style="display:block;margin-bottom:4px;font-size:12px">Proforma Invoice Details</strong>
            <span style="color:#64748b">Invoice Date&nbsp;&nbsp;: </span>${invDate}<br/>
            <span style="color:#64748b">Invoice Number: </span><strong>${pi.pi_number}</strong>
          </td>
          <td style="padding:13px 16px;border:1px solid #e2e8f0;width:50%;vertical-align:top;font-size:11px;line-height:1.8">
            <strong style="display:block;margin-bottom:4px;font-size:12px">Bill To</strong>
            <strong>${pi.customer_name}</strong><br/>${pi.billing_address||''}
            ${pi.gstin ? `<br/><span style="color:#64748b">GSTIN: </span>${pi.gstin}` : ''}
            ${pi.pan   ? `<br/><span style="color:#64748b">PAN: </span>${pi.pan}`   : ''}
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;margin-bottom:18px">
        <thead><tr style="background:#f8fafc">
          <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;font-weight:700;font-size:11px">Description</th>
          <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;font-weight:700;font-size:11px">SAC Code</th>
          <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;font-weight:700;font-size:11px">Qty</th>
          <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:right;font-weight:700;font-size:11px">Rate (${cur})</th>
          <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:right;font-weight:700;font-size:11px">Total Amount (${cur})</th>
        </tr></thead>
        <tbody>${liRows}</tbody>
        <tfoot>
          <tr><td colspan="4" style="padding:9px 12px;text-align:right;font-weight:600;border-top:1px solid #e2e8f0">Total Value before Tax</td>
              <td style="padding:9px 12px;text-align:right;font-weight:700;border-top:1px solid #e2e8f0">${f(pi.subtotal)}</td></tr>
          <tr><td colspan="4" style="padding:9px 12px;text-align:right;font-weight:600">${taxLbl}</td>
              <td style="padding:9px 12px;text-align:right;font-weight:700">${f(pi.tax_amount)}</td></tr>
          <tr style="background:#f8fafc">
            <td colspan="4" style="padding:11px 12px;text-align:right;font-weight:700;font-size:13px;border-top:2px solid #cbd5e1">Grand Total</td>
            <td style="padding:11px 12px;text-align:right;font-weight:800;font-size:14px;border-top:2px solid #cbd5e1">${f(pi.grand_total)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-bottom:18px">
        <p style="font-weight:700;margin:0 0 8px;font-size:12px">Terms and Conditions</p>
        <ol style="margin:0;padding-left:18px;font-size:11px;line-height:1.9;color:#334155">
          <li style="margin-bottom:4px">All Cheques/Drafts payable in the name of <strong>${payable}</strong></li>
          <li style="margin-bottom:4px">Payments to be made within 15 days of receipt of this Proforma Invoice</li>
          ${rcm}
          <li style="margin-bottom:4px">The above-mentioned fees shall be non-refundable.</li>
        </ol>
      </div>
      <div style="margin-bottom:24px">${bankBlk}</div>
      <div style="border-top:1px solid #e2e8f0;padding-top:14px;text-align:center;color:#94a3b8;font-size:10px;font-style:italic">
        This is a system-generated document and does not require a signature.
      </div>
    </div></body></html>`;

  const w = window.open('','_blank','width=900,height=700');
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(()=>w.print(),400);
}

// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════
export default function ProformaInvoices() {
  const { user } = useAuth();
  const { toast, show, hide } = useToast();
  const [pis,      setPIs]      = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selPI,    setSelPI]    = useState(null);   // PI being viewed in detail panel
  const [showModal,setShowModal]= useState(null);   // { piId, action }
  const [cmt,      setCmt]      = useState('');

  const canApprove = user?.role==='revops'||user?.isUniversal;
  const canDownload = user?.role==='sales'||user?.role==='finance'||user?.isUniversal||user?.role==='revops';

  // ── load ──
  const loadPIs = useCallback(async () => {
    setLoading(true);
    try {
      let snap;
      try   { snap = await db.collection('proforma_invoices').orderBy('created_at','desc').get(); }
      catch { snap = await db.collection('proforma_invoices').get(); }
      const all = [];
      snap.forEach(d => all.push({ id:d.id, ...d.data() }));
      setPIs(user?.role==='sales'
        ? all.filter(p=>p.created_by_email===user.email)
        : all);
    } catch(e) { console.error('loadPIs',e); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(()=>{ loadPIs(); }, [loadPIs]);

  // ── approve ──
  const doApprove = async () => {
    try {
      await updateDoc(doc(db,'proforma_invoices',showModal.piId),{
        status:'approved',
        revops_reviewer: user.name||user.email,
        revops_comment: cmt,
        revops_reviewed_at: serverTimestamp(),
      });
      await loadPIs();
      const pi = pis.find(p=>p.id===showModal.piId);
      if (pi) { const updated={...pi,status:'approved',revops_reviewer:user.name||user.email,revops_comment:cmt}; await notifyPI(updated,'approved'); }
      if (selPI?.id===showModal.piId) setSelPI(prev=>({...prev,status:'approved',revops_reviewer:user.name||user.email,revops_comment:cmt}));
      setShowModal(null); setCmt('');
      show('PI Approved ✓');
    } catch(e) { show('Error: '+e.message,'error'); }
  };

  // ── reject ──
  const doReject = async () => {
    if (!cmt.trim()) { alert('Rejection reason is required.'); return; }
    try {
      await updateDoc(doc(db,'proforma_invoices',showModal.piId),{
        status:'rejected',
        revops_reviewer: user.name||user.email,
        revops_comment: cmt,
        revops_reviewed_at: serverTimestamp(),
      });
      await loadPIs();
      const pi = pis.find(p=>p.id===showModal.piId);
      if (pi) { const updated={...pi,status:'rejected',revops_reviewer:user.name||user.email,revops_comment:cmt}; await notifyPI(updated,'rejected'); }
      if (selPI?.id===showModal.piId) setSelPI(prev=>({...prev,status:'rejected',revops_reviewer:user.name||user.email,revops_comment:cmt}));
      setShowModal(null); setCmt('');
      show('PI Rejected');
    } catch(e) { show('Error: '+e.message,'error'); }
  };

  const doCancel = async () => {
    if (!cmt.trim()) { alert('Please provide a reason for cancellation.'); return; }
    try {
      await updateDoc(doc(db,'proforma_invoices',showModal.piId),{
        status:'cancelled',
        revops_reviewer: user.name||user.email,
        revops_comment: cmt,
        revops_reviewed_at: serverTimestamp(),
      });
      await loadPIs();
      const pi = pis.find(p=>p.id===showModal.piId);
      if (pi) { const updated={...pi,status:'cancelled',revops_reviewer:user.name||user.email,revops_comment:cmt}; await notifyPI(updated,'cancelled'); }
      if (selPI?.id===showModal.piId) setSelPI(prev=>({...prev,status:'cancelled',revops_reviewer:user.name||user.email,revops_comment:cmt}));
      setShowModal(null); setCmt('');
      show('PI Cancelled');
    } catch(e) { show('Error: '+e.message,'error'); }
  };

  const pending   = pis.filter(p=>p.status==='submitted').length;
  const approved  = pis.filter(p=>p.status==='approved').length;
  const rejected  = pis.filter(p=>p.status==='rejected').length;
  const cancelled = pis.filter(p=>p.status==='cancelled').length;

  // ── DETAIL PANEL ──
  const DetailPanel = ({ pi }) => (
    <Card className="mt-4 p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <span className="font-mono font-bold text-lg" style={{color:NAVY}}>{pi.pi_number}</span>
            <PIPill status={pi.status}/>
            <span style={{background:'#f1f5f9',color:'#475569',display:'inline-block',padding:'2px 10px',borderRadius:'9999px',fontSize:'11px',fontWeight:600}}>
              {pi.entity==='yavi'?'Yavi':'Fynd'}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-700">{pi.customer_name}</p>
          <p className="text-xs text-slate-400 mt-0.5">OF: {pi.of_number} · Created by {pi.created_by_name}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canDownload && pi.status==='approved' && (
            <Btn variant="success" size="sm" onClick={()=>printPI(pi)}>📥 Download PDF</Btn>
          )}
          {canApprove && pi.status==='submitted' && (
            <>
              <Btn variant="success" size="sm" onClick={()=>{setShowModal({piId:pi.id,action:'approve'});setCmt('');}}>✓ Approve</Btn>
              <Btn variant="danger"  size="sm" onClick={()=>{setShowModal({piId:pi.id,action:'reject'});setCmt('');}}>✕ Reject</Btn>
            </>
          )}
          {canApprove && ['submitted','approved'].includes(pi.status) && (
            <Btn variant="ghost" size="sm"
              style={{color:'#64748b',borderColor:'#e2e8f0'}}
              onClick={()=>{setShowModal({piId:pi.id,action:'cancel'});setCmt('');}}>
              🚫 Cancel PI
            </Btn>
          )}
          <Btn variant="ghost" size="sm" onClick={()=>setSelPI(null)}>✕ Close</Btn>
        </div>
      </div>

      {/* Customer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          ['Customer',    pi.customer_name],
          ['GSTIN',       pi.gstin||'—'],
          ['PAN',         pi.pan||'—'],
          ['Billing Addr',pi.billing_address||'—'],
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
              <td colSpan={5} className="px-4 py-2 text-right text-slate-400">{pi.tax_type||'GST'} @ {pi.tax_rate||0}%</td>
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
        <div className="bg-slate-50 rounded-xl p-4 text-xs space-y-1.5">
          <div className="font-semibold text-slate-500 uppercase tracking-wide mb-2">Review Details</div>
          <div className="flex gap-2"><span className="text-slate-400 w-28">Reviewed by</span><span className="font-medium">{pi.revops_reviewer}</span></div>
          {pi.revops_comment && <div className="flex gap-2"><span className="text-slate-400 w-28">Comment</span><span className="font-medium">{pi.revops_comment}</span></div>}
        </div>
      )}
    </Card>
  );

  // ── RENDER ──
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{color:NAVY}}>Proforma Invoices</h2>
          <p className="text-sm text-slate-400 mt-0.5">All PIs raised across approved Order Forms</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          ['Pending Approval', pending,   '#fef3c7','#92400e'],
          ['Approved',         approved,  '#d1fae5','#065f46'],
          ['Rejected',         rejected,  '#fee2e2','#991b1b'],
          ['Cancelled',        cancelled, '#f1f5f9','#64748b'],
        ].map(([lbl,val,bg,fg])=>(
          <Card key={lbl} className="p-4" style={{borderColor:bg}}>
            <div className="text-2xl font-bold" style={{color:fg}}>{val}</div>
            <div className="text-xs text-slate-500 mt-0.5">{lbl}</div>
          </Card>
        ))}
      </div>

      {/* Table */}
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
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Reviewed By</th>
                </tr>
              </thead>
              <tbody>
                {pis.map(pi=>(
                  <tr key={pi.id}
                    onClick={()=>setSelPI(selPI?.id===pi.id?null:pi)}
                    className="border-t border-slate-100 cursor-pointer transition-colors"
                    style={selPI?.id===pi.id?{background:'#f0fdf4'}:{}}
                    onMouseEnter={e=>{ if(selPI?.id!==pi.id) e.currentTarget.style.background='#f8fafc'; }}
                    onMouseLeave={e=>{ if(selPI?.id!==pi.id) e.currentTarget.style.background=''; }}>
                    <td className="px-4 py-3.5 font-mono text-xs font-bold text-slate-700">{pi.pi_number||'—'}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 max-w-[160px] truncate">{pi.customer_name||'—'}</td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-400">{pi.of_number||'—'}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">{pi.created_by_name||'—'}</td>
                    <td className="px-4 py-3.5 text-xs font-semibold">{fmtAmt(pi.grand_total,pi.currency)}</td>
                    <td className="px-4 py-3.5"><PIPill status={pi.status}/></td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{pi.revops_reviewer||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail panel */}
      {selPI && <DetailPanel pi={selPI}/>}

      {/* Approve / Reject / Cancel modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="shadow-2xl w-full max-w-md p-6">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">
                {showModal.action==='approve'?'✅':showModal.action==='cancel'?'🚫':'❌'}
              </div>
              <div className="text-lg font-bold text-slate-800 mb-1">
                {showModal.action==='approve'?'Approve Proforma Invoice?':showModal.action==='cancel'?'Cancel Proforma Invoice?':'Reject Proforma Invoice?'}
              </div>
              <div className="text-sm text-slate-400">
                {showModal.action==='approve'
                  ? 'Sales Rep will be able to download the PDF.'
                  : showModal.action==='cancel'
                  ? 'This PI will be marked as Cancelled. The record is kept for audit purposes.'
                  : 'Sales Rep will be notified with the reason.'}
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {showModal.action==='approve'?'Comments (optional)':'Reason *'}
              </label>
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
