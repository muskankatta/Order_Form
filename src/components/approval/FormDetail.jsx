import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase.js';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { Card, Btn, StatusPill, Lbl, TA, MultiSelect, Toast } from '../ui/index.jsx';
import StepClient from '../form/steps/StepClient.jsx';
import StepCommercial from '../form/steps/StepCommercial.jsx';
import StepFees from '../form/steps/StepFees.jsx';
import { StepTerms, StepSignatory } from '../form/steps/StepTermsSignatory.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { FINANCE_USERS, REVOPS_USERS } from '../../constants/users.js';
import { fmtDate, fmtShort } from '../../utils/dates.js';
import { openPDF } from '../../utils/pdf.js';
import { useToast } from '../../hooks/useToast.js';
import { SERVICES as PI_SERVICES_FALLBACK_IMPORT } from '../../constants/formOptions.js';

const NAVY='#1B2B4B'; const T='#00C3B5';
const TABS = [{id:'client',lbl:'Client'},{id:'commercial',lbl:'Commercial'},{id:'fees',lbl:'Fees'},{id:'terms',lbl:'Terms'},{id:'signatory',lbl:'Signatory'}];

// ── PI helpers ───────────────────────────────────────────────────────────────
const PI_SERVICES_FALLBACK = PI_SERVICES_FALLBACK_IMPORT || [
  'Fynd Store OS','Fynd OMS','Fynd Commerce','Fynd Marketplace',
  'Kaily (CoPilot)','Boltic','Pixelbin','GlamAR','ratl.ai',
  'Gauze','Fynd Managed Logistics','Fynd WMS','Other',
];
const PI_FEE_TYPES = ['Setup Fee','One Time Fee','Subscription Fee'];
const PI_SAC = {'Setup Fee':'998314','One Time Fee':'998314','Subscription Fee':'998599'};
const getSAC  = ft => PI_SAC[ft]||'998314';
const symOf = cur => ({ USD:'$', AED:'AED ', GBP:'£', EUR:'€', SGD:'SGD ', SAR:'SAR ', QAR:'QAR ', OMR:'OMR ', KWD:'KWD ' }[cur] || (cur ? cur+' ' : '₹'));
const fmtAmt  = (n,cur) => symOf(cur)+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const entityOf= of => { const n=of?.of_number||''; return (n.startsWith('OFYT')||n.startsWith('OF-YT-'))?'yavi':'fynd'; };
const isIndia = of => of?.sales_team==='India'||(of?.country||'').toLowerCase()==='india';
const fixedTax= of => entityOf(of)==='fynd'&&isIndia(of);
const subtot  = items => items.reduce((s,li)=>s+((parseFloat(li.qty)||0)*(parseFloat(li.rate)||0)),0);
const blankLI = () => ({service:'',fee_type:'',description:'',qty:1,rate:0});

const BOLTIC  = import.meta.env.VITE_BOLTIC_SLACK_URL||'';
const CH      = {India:'C0AQTCE3PNY',Global:'C08CBBNRAKZ','AI/SaaS':'C0978TZNGM8'};

function getCurrentFY(){const n=new Date();const y=n.getMonth()>=3?n.getFullYear()+1:n.getFullYear();return String(y).slice(-2);}

async function genPINum(ent){
  const fy=getCurrentFY();
  const re=ent==='yavi'?/^PI-YT-(\d{5})-FY/:/^PI-A(\d{5})-FY/;
  const snap=await getDocs(collection(db,'proforma_invoices'));
  let max=0; snap.forEach(d=>{const m=(d.data().pi_number||'').match(re);if(m)max=Math.max(max,parseInt(m[1]));});
  const n=String(max+1).padStart(5,'0');
  return ent==='yavi'?`PI-YT-${n}-FY${fy}`:`PI-A${n}-FY${fy}`;
}

const PI_PLATFORM_URL = 'https://muskankatta.github.io/Order_Form/#/proforma-invoices';

async function slackPI(pi,event){
  if(!BOLTIC) return null;
  try{
    const ch=CH[pi.sales_team]||CH['India'];
    const primarySlack = pi.revops_approvers_slack_ids?.[0];
    const revopsTag = primarySlack
      ? `*Assigned to:* <@${primarySlack}>`
      : pi.revops_approvers_names?.[0]
        ? `*Assigned to:* ${pi.revops_approvers_names[0]}` : '';
    const msgs={
      submitted:`🧾 *Proforma Invoice Raised* — *${pi.pi_number}*\n*Customer:* ${pi.customer_name}  |  *OF:* ${pi.of_number}\n*By:* ${pi.created_by_name}  |  *Amount:* ${fmtAmt(pi.grand_total,pi.currency)}${revopsTag?'\n'+revopsTag:''}\n⏳ Awaiting RevOps Approval\n🔗 <${PI_PLATFORM_URL}|Review on OF Platform>`,
    };
    const body={channel:ch,text:msgs[event]||''};
    if(pi.slack_thread_ts) body.thread_ts=pi.slack_thread_ts;
    const res=await fetch(BOLTIC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const raw=await res.text();
    if(raw){try{const d=JSON.parse(raw);if(event==='submitted'&&d.result?.ts)return d.result.ts;}catch(_){}}
  }catch(e){console.warn('PI slack:',e);}
  return null;
}

const PI_STATUS_STYLE={submitted:{bg:'#fef3c7',fg:'#92400e'},approved:{bg:'#d1fae5',fg:'#065f46'},rejected:{bg:'#fee2e2',fg:'#991b1b'},cancelled:{bg:'#f1f5f9',fg:'#64748b'}};
const PI_STATUS_LBL={submitted:'Pending Approval',approved:'Approved',rejected:'Rejected',cancelled:'Cancelled'};
function PIPill({status}){
  const s=PI_STATUS_STYLE[status]||{bg:'#f1f5f9',fg:'#475569'};
  return <span style={{background:s.bg,color:s.fg,display:'inline-block',padding:'2px 10px',borderRadius:'9999px',fontSize:'11px',fontWeight:600}}>{PI_STATUS_LBL[status]||status}</span>;
}

// ── Inline PI Create Form ─────────────────────────────────────────────────────
function PICreateForm({ form, user, onSubmitted }) {
  const [items,       setItems]       = useState([blankLI()]);
  const [taxType,     setTaxType]     = useState('');
  const [taxRate,     setTaxRate]     = useState('');
  const [piRevops,    setPiRevops]    = useState([]);
  const [submitting,  setSub]         = useState(false);
  const fixed = fixedTax(form);
  const cur   = form.committed_currency||'INR';
  // Only show services present in this OF; fall back to master list if none
  const ofServices = (form.services_fees||[]).map(s=>s.name).filter(Boolean);
  const availableServices = ofServices.length > 0 ? ofServices : PI_SERVICES_FALLBACK;
  const sub   = subtot(items);
  const tr    = fixed ? 18 : (parseFloat(taxRate)||0);
  const ta    = sub * tr / 100;
  const grand = sub + ta;

  const updItem = (i,field,val) => {
    if(field==='qty'||field==='rate') val=parseFloat(val)||0;
    setItems(prev=>prev.map((li,idx)=>idx===i?{...li,[field]:val}:li));
  };

  const handleSubmit = async () => {
    if(!items.some(li=>li.service&&li.fee_type&&parseFloat(li.rate)>0)){
      alert('Fill at least one complete line item (Service + Fee Type + Rate).');
      return;
    }
    if(!piRevops.length){ alert('Please select at least one RevOps reviewer.'); return; }
    setSub(true);
    try {
      const ent=entityOf(form);
      const piNum=await genPINum(ent);
      const lineItems=items.map(li=>({
        service:li.service, fee_type:li.fee_type, description:li.description,
        sac_code:getSAC(li.fee_type), qty:parseFloat(li.qty)||1,
        rate:parseFloat(li.rate)||0,
        total:(parseFloat(li.qty)||1)*(parseFloat(li.rate)||0),
      }));
      const docData={
        pi_number:piNum, entity:ent,
        of_id:form.id, of_number:form.of_number||'',
        status:'submitted',
        customer_name:form.customer_name||'', billing_address:form.billing_address||'',
        gstin:form.gstin||'', pan:form.pan||'',
        country:form.country||'', sales_team:form.sales_team||'',
        currency:cur, line_items:lineItems,
        subtotal:sub,
        tax_type:fixed?'GST':(taxType||''),
        tax_rate:tr, tax_amount:ta, grand_total:grand,
        created_by_name:user.name||'', created_by_email:user.email,
        sales_rep_slack_id:form.slack_id||'',
        created_at:serverTimestamp(),
        revops_approvers: piRevops,
        revops_approvers_names: piRevops.map(e=>(REVOPS_USERS.find(u=>u.email===e)||{}).name||e),
        revops_approvers_slack_ids: piRevops.map(e=>(REVOPS_USERS.find(u=>u.email===e)||{}).slack||''),
        revops_reviewer:'', revops_comment:'', revops_reviewed_at:null, slack_thread_ts:null,
      };
      const ref=await addDoc(collection(db,'proforma_invoices'),docData);
      const ts=await slackPI({...docData,id:ref.id},'submitted');
      if(ts) await updateDoc(doc(db,'proforma_invoices',ref.id),{slack_thread_ts:ts});
      onSubmitted(piNum);
    } catch(e){
      alert('Error creating PI: '+e.message);
    } finally { setSub(false); }
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Customer info pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[['Customer',form.customer_name||'—'],['Entity',entityOf(form)==='yavi'?'Yavi':'Fynd'],['Currency',cur],['GSTIN/Tax',form.gstin||form.pan||'—']].map(([k,v])=>(
          <div key={k} className="bg-slate-50 rounded-xl p-3">
            <div className="text-xs text-slate-400 mb-1">{k}</div>
            <div className="text-xs font-semibold text-slate-700 truncate">{v}</div>
          </div>
        ))}
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Line Items</span>
          <button onClick={()=>setItems(p=>[...p,blankLI()])}
            className="text-xs font-semibold px-3 py-1 rounded-lg"
            style={{background:'#eff6ff',color:'#1d4ed8'}}>+ Add Row</button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-xs" style={{borderCollapse:'collapse'}}>
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-400 uppercase tracking-wide">
                <th className="px-3 py-2.5 font-semibold" style={{minWidth:140}}>Service</th>
                <th className="px-3 py-2.5 font-semibold" style={{minWidth:180}}>Fee Type &amp; Notes</th>
                <th className="px-3 py-2.5 font-semibold text-center" style={{minWidth:60}}>SAC</th>
                <th className="px-3 py-2.5 font-semibold text-center" style={{minWidth:56}}>Qty</th>
                <th className="px-3 py-2.5 font-semibold" style={{minWidth:100}}>Rate ({cur})</th>
                <th className="px-3 py-2.5 font-semibold text-right" style={{minWidth:90}}>Total</th>
                <th className="px-3 py-2.5" style={{minWidth:32}}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((li,i)=>(
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-2 py-2">
                    <select value={li.service} onChange={e=>updItem(i,'service',e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-teal-400">
                      <option value="">Service…</option>
                      {availableServices.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select value={li.fee_type} onChange={e=>updItem(i,'fee_type',e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white mb-1 focus:outline-none focus:ring-1 focus:ring-teal-400">
                      <option value="">Fee Type…</option>
                      {PI_FEE_TYPES.map(f=><option key={f} value={f}>{f}</option>)}
                    </select>
                    <input type="text" value={li.description} placeholder="Notes (optional)"
                      onChange={e=>updItem(i,'description',e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"/>
                  </td>
                  <td className="px-2 py-2 text-center font-mono text-slate-500">{getSAC(li.fee_type)||'—'}</td>
                  <td className="px-2 py-2">
                    <input type="number" value={li.qty} min={1}
                      onChange={e=>updItem(i,'qty',e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-teal-400"/>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 shrink-0">{symOf(cur)}</span>
                      <input type="number" value={li.rate} min={0}
                        onChange={e=>updItem(i,'rate',e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"/>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right font-semibold text-slate-700">
                    {symOf(cur)}{((parseFloat(li.qty)||0)*(parseFloat(li.rate)||0)).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button disabled={items.length===1} onClick={()=>setItems(p=>p.filter((_,idx)=>idx!==i))}
                      className="text-slate-300 hover:text-red-500 disabled:opacity-30 px-1">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax + Totals */}
      <div className="ml-auto max-w-xs space-y-2">
        <div className="flex justify-between py-2 text-sm">
          <span className="text-slate-500">Total Before Tax</span>
          <span className="font-semibold">{fmtAmt(sub,cur)}</span>
        </div>
        {fixed ? (
          <div className="flex justify-between py-2 border-t border-slate-100 text-sm">
            <span className="text-slate-500">GST @ 18%</span>
            <span className="font-semibold">{fmtAmt(ta,cur)}</span>
          </div>
        ) : (
          <div className="border-t border-slate-100 pt-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tax Type</label>
                <input type="text" value={taxType} onChange={e=>setTaxType(e.target.value)}
                  placeholder="e.g. VAT, GST"
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"/>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rate (%)</label>
                <input type="number" value={taxRate} onChange={e=>setTaxRate(e.target.value)}
                  placeholder="0" min={0} max={100}
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-400"/>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{tr>0?`${taxType||'Tax'} @ ${tr}%`:'Tax'}</span>
              <span className="font-semibold">{fmtAmt(ta,cur)}</span>
            </div>
          </div>
        )}
        <div className="flex justify-between py-3 border-t-2 border-slate-300">
          <span className="font-bold text-slate-800">Grand Total</span>
          <span className="font-bold text-slate-800">{fmtAmt(grand,cur)}</span>
        </div>
      </div>

      {/* RevOps selector */}
      <div>
        <MultiSelect
          label="Assign RevOps reviewer(s) — first selected is Primary DRI"
          req
          options={REVOPS_USERS.map(u=>({value:u.email,label:u.name}))}
          value={piRevops}
          onChange={setPiRevops}
        />
        {piRevops.length > 0 && (
          <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
            <strong>Primary DRI:</strong> {(REVOPS_USERS.find(u=>u.email===piRevops[0])||{}).name||piRevops[0]}
            {piRevops.length > 1 && <span className="ml-2 text-blue-500">· CC: {piRevops.slice(1).map(e=>(REVOPS_USERS.find(u=>u.email===e)||{}).name||e).join(', ')}</span>}
          </div>
        )}
        {!piRevops.length && <p className="text-xs text-amber-600 mt-1">Select at least one RevOps reviewer to submit.</p>}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Btn variant="ghost" size="sm" onClick={()=>{ setItems([blankLI()]); setTaxType(''); setTaxRate(''); setPiRevops([]); }}>Reset</Btn>
        <Btn onClick={handleSubmit} disabled={submitting}>{submitting?'Submitting…':'Submit for RevOps Approval →'}</Btn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function FormDetail({ form: initial }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { forms, revopsApprove, revopsReject, financeApprove, financeReject, markSigned, applyDealStatus, cloneForm, deleteDraft, submitForm, updateDraft } = useForms();
  const { toast, show, hide } = useToast();

  const form     = forms.find(f => f.id === initial.id) || initial;
  const [tab,    setTab]   = useState('client');
  const [edit,   setEdit]  = useState(false);
  const [ef,     setEf]    = useState({...form});
  const [ofNum,  setOfNum] = useState(form.of_number||'');
  const [cmt,    setCmt]   = useState('');
  const [finDRIs,setFinDRIs]= useState([]);
  const [sigDate,    setSigDate]    = useState('');
  const [signedLink, setSignedLink] = useState(form.signed_of_link||'');
  const [salesRevopsApprovers, setSalesRevopsApprovers] = useState([]);

  // ── PI state ──
  const [pis,        setPIs]        = useState([]);
  const [piLoading,  setPILoading]  = useState(false);
  const [showPIForm, setShowPIForm] = useState(false);

  const live = edit ? ef : form;
  const set  = (k,v) => setEf(prev => ({...prev,[k]:v}));

  const revopsPrimaryEmail  = (form.revops_approvers||[])[0];
  const financePrimaryEmail = (form.finance_approvers||[])[0];
  const isRevopsPrimary  = user?.email === revopsPrimaryEmail || user?.isUniversal;
  const isFinancePrimary = user?.email === financePrimaryEmail || user?.isUniversal;

  const canEdit = user?.isUniversal
    || (user?.role==='sales' && ['draft','revops_rejected'].includes(form.status) && form.sales_rep_email===user.email)
    || (user?.role==='revops' && form.status==='submitted')
    || (user?.role==='finance');

  const canDelete = (user?.isUniversal) || (user?.role==='sales'&&form.status==='draft') || (user?.role==='revops'&&form.status==='submitted') || (user?.role==='finance'&&form.status==='revops_approved');

  const canRaisePI = (user?.role==='sales'||user?.isUniversal) && ['approved','signed'].includes(form.status);

  const tabContent = {
    client:     <StepClient     form={live} set={set} ro={!edit}/>,
    commercial: <StepCommercial form={live} set={set} ro={!edit}/>,
    fees:       <StepFees       form={live} set={set} ro={!edit}/>,
    terms:      <StepTerms      form={live} set={set} ro={!edit}/>,
    signatory:  <StepSignatory  form={live} set={set} ro={!edit}/>,
  };

  // ── Load PIs for this OF ──
  const loadPIs = useCallback(async () => {
    if (!form.id) return;
    setPILoading(true);
    try {
      let snap;
      try   { snap = await getDocs(query(collection(db,'proforma_invoices'),where('of_id','==',form.id),orderBy('created_at','desc'))); }
      catch { snap = await getDocs(query(collection(db,'proforma_invoices'),where('of_id','==',form.id))); }
      const all = [];
      snap.forEach(d => all.push({ id:d.id, ...d.data() }));
      setPIs(all);
    } catch(e) { console.warn('loadPIs',e); }
    finally { setPILoading(false); }
  }, [form.id]);

  useEffect(() => { loadPIs(); }, [loadPIs]);

  const handleRevopsApprove = async () => {
    if (!finDRIs.length) { alert('Select at least one Finance DRI.'); return; }
    await revopsApprove(form.id, { editedForm: edit?ef:{}, comment:cmt, financeApprovers:finDRIs });
    show('Sent to Finance!'); setEdit(false);
  };

  const handleRevopsReject = async () => {
    await revopsReject(form.id, { comment: cmt });
    show('Form rejected.', 'error');
  };

  const handleFinanceApprove = async () => {
    if (!ofNum) { alert('Enter OF Number first.'); return; }
    await financeApprove(form.id, { ofNumber:ofNum, comment:cmt, editedForm:edit?ef:{} });
    show(`✓ Approved! OF# ${ofNum}`); setEdit(false);
  };

  const handleMarkSigned = async () => {
    if (!sigDate) { alert('Enter signing date.'); return; }
    await markSigned(form.id, sigDate, signedLink);
    show('Marked as signed ✓');
  };

  const handleSaveSignedEdits = async () => {
    await updateDraft(form.id, ef);
    setEdit(false);
    show('Edits saved ✓');
  };

  const handleClone = async () => {
    const clone = await cloneForm(form);
    show('Cloned! Redirecting to new draft…');
    setTimeout(() => navigate(`/form/${clone.id}`), 1000);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    await deleteDraft(form.id);
    navigate('/dashboard');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-brand-faint">←</button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold" style={{ color:NAVY }}>{form.customer_name}</h2>
              <StatusPill status={form.status}/>
              {form.of_number && (
                <span className="font-mono text-sm font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-800">{form.of_number}</span>
              )}
            </div>
            <p className="text-sm mt-0.5 text-brand-faint">{form.brand_name} · {form.sales_rep_name} · {fmtShort(form.submitted_at)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(canEdit || user?.isUniversal) && <Btn variant="ghost" size="sm" onClick={() => { setEdit(e=>!e); setEf({...form}); }}>{edit?'✕ Cancel':'✏️ Edit'}</Btn>}
          {canDelete && !['approved','signed'].includes(form.status) && <Btn variant="ghost" size="sm" onClick={handleDelete}>🗑 Delete</Btn>}
          {(user?.role==='sales'||user?.role==='revops'||user?.isUniversal) && (
            <Btn variant="ghost" size="sm" onClick={handleClone}>📋 Clone</Btn>
          )}
          <Btn variant="ghost" size="sm" onClick={() => openPDF(live)}>📄 Preview PDF</Btn>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-slate-100">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all"
            style={tab===t.id ? {background:'#fff',color:NAVY,boxShadow:'0 1px 3px rgba(0,0,0,0.08)'} : {color:'#94a3b8'}}>
            {t.lbl}
          </button>
        ))}
      </div>

      <Card className="p-6">{tabContent[tab]}</Card>

      {/* SoW downloads */}
      {(form.sow_document || form.sow_reference_document) && (
        <Card className="mt-4 p-5">
          <p className="text-xs font-bold uppercase tracking-widest mb-3 text-brand-faint">Scope of Work Documents</p>
          <div className="flex gap-3 flex-wrap">
            {form.sow_document && (
              <a href={form.sow_document.data} download={form.sow_document.name}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors">
                📎 {form.sow_document.name}
              </a>
            )}
            {form.sow_reference_document && (
              <a href={form.sow_reference_document.data} download={form.sow_reference_document.name}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors">
                📎 Ref: {form.sow_reference_document.name}
              </a>
            )}
          </div>
        </Card>
      )}

      {/* Finance / Universal — save edits at any stage */}
      {edit && (user?.role==='finance' || user?.isUniversal) && !['draft','revops_rejected','revops_approved','signed'].includes(form.status) && (
        <Card className="mt-4 p-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex-1">
              ✏️ Editing — save to persist changes
            </span>
            <Btn variant="navy" onClick={async () => { await updateDraft(form.id, ef); setEdit(false); show('Edits saved ✓'); }}>
              💾 Save edits
            </Btn>
          </div>
        </Card>
      )}

      {/* Sales Rep — save edits + submit draft */}
      {user?.role==='sales' && ['draft','revops_rejected'].includes(form.status) && form.sales_rep_email===user?.email && (
        <Card className="mt-4 p-6">
          <h3 className="font-bold mb-4" style={{ color:NAVY }}>
            {form.status==='revops_rejected' ? '↩ Resubmit for RevOps review' : '📝 Submit for RevOps review'}
          </h3>
          {form.status==='revops_rejected' && form.revops_comment && (
            <div className="mb-4 p-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-700">
              <strong>Rejection reason:</strong> {form.revops_comment}
            </div>
          )}
          {edit && (
            <div className="mb-4">
              <Btn variant="navy" onClick={async () => {
                await updateDraft(form.id, ef);
                setEdit(false);
                show('Draft saved!');
              }}>💾 Save edits</Btn>
            </div>
          )}
          <MultiSelect
            label="Select RevOps reviewer(s) — first selected is Primary DRI"
            req
            options={REVOPS_USERS.map(u => ({ value:u.email, label:u.name }))}
            value={salesRevopsApprovers}
            onChange={setSalesRevopsApprovers}
          />
          {salesRevopsApprovers.length > 0 && (
            <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
              <strong>Primary DRI:</strong> {(REVOPS_USERS.find(u=>u.email===salesRevopsApprovers[0])||{}).name||salesRevopsApprovers[0]}
              {salesRevopsApprovers.length > 1 && (
                <span className="ml-2 text-blue-500">
                  · CC: {salesRevopsApprovers.slice(1).map(e=>(REVOPS_USERS.find(u=>u.email===e)||{}).name||e).join(', ')}
                </span>
              )}
            </div>
          )}
          {!salesRevopsApprovers.length && (
            <p className="text-xs text-amber-600 mt-1">Select at least one RevOps reviewer to submit.</p>
          )}
          <div className="mt-4">
            <Btn onClick={async () => {
              if (!salesRevopsApprovers.length) { alert('Please select at least one RevOps reviewer.'); return; }
              await submitForm(form, salesRevopsApprovers);
              show('Submitted for RevOps review!');
              navigate('/dashboard');
            }}>
              {form.status==='revops_rejected' ? 'Resubmit for review →' : 'Submit for review →'}
            </Btn>
          </div>
        </Card>
      )}

      {/* Universal — submit draft on behalf of Sales Rep */}
      {user?.isUniversal && form.status==='draft' && (
        <Card className="mt-4 p-6">
          <h3 className="font-bold mb-2" style={{ color:NAVY }}>🚀 Submit draft (Universal)</h3>
          <p className="text-sm text-brand-muted mb-4">You can finalise this draft and submit it for RevOps review on behalf of the Sales Rep.</p>
          {edit && <div className="mb-4 p-3 rounded-xl text-sm bg-blue-50 border border-blue-200 text-blue-700">ℹ️ Save edits first, then submit.</div>}
          <MultiSelect
            label="Select RevOps reviewer(s)"
            req
            options={REVOPS_USERS.map(u => ({ value:u.email, label:u.name }))}
            value={finDRIs}
            onChange={setFinDRIs}
          />
          <div className="flex gap-3 flex-wrap mt-2">
            {edit && <Btn variant="navy" onClick={async () => { await revopsApprove(form.id,{editedForm:ef,comment:'',financeApprovers:[]}); setEdit(false); show('Edits saved!'); }}>💾 Save edits</Btn>}
            <Btn onClick={async () => {
              if (!finDRIs.length) { alert('Select at least one RevOps reviewer.'); return; }
              const now = new Date().toISOString();
              await revopsApprove(form.id, {
                editedForm: { ...form, status:'submitted', submitted_at: now, revops_approvers: finDRIs },
                comment: 'Submitted by Universal user',
                financeApprovers: [],
              });
              show('Draft submitted for RevOps review!');
            }}>Submit for RevOps review →</Btn>
          </div>
        </Card>
      )}

      {/* RevOps review panel */}
      {(user?.role==='revops'||user?.isUniversal) && form.status==='submitted' && (
        <Card className="mt-4 p-6">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h3 className="font-bold" style={{ color:NAVY }}>🔍 RevOps review</h3>
            {revopsPrimaryEmail && (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-teal-100 text-teal-700">
                  Primary DRI: {(REVOPS_USERS.find(u=>u.email===revopsPrimaryEmail)||{}).name || revopsPrimaryEmail}
                </span>
                {(form.revops_approvers||[]).slice(1).map(email => (
                  <span key={email} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    CC: {(REVOPS_USERS.find(u=>u.email===email)||{}).name || email}
                  </span>
                ))}
              </div>
            )}
          </div>
          {!isRevopsPrimary && (
            <div className="mb-4 p-3 rounded-xl text-sm bg-amber-50 border border-amber-200 text-amber-700">
              👁 You are CC'd on this review. Only the Primary DRI (<strong>{(REVOPS_USERS.find(u=>u.email===revopsPrimaryEmail)||{}).name || revopsPrimaryEmail}</strong>) can approve or reject.
            </div>
          )}
          {edit && <div className="mb-4 p-3 rounded-xl text-sm bg-blue-50 border border-blue-200 text-blue-700">ℹ️ Save edits first, then approve or reject.</div>}
          <TA label="Review comment (optional)" value={cmt} onChange={setCmt} disabled={!isRevopsPrimary}/>
          <MultiSelect
            label="Forward to Finance DRI(s) — first selected is Primary DRI"
            req
            options={FINANCE_USERS.map(u => ({ value:u.email, label:u.name }))}
            value={finDRIs}
            onChange={setFinDRIs}
          />
          {finDRIs.length > 0 && (
            <div className="mb-3 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
              Primary Finance DRI: <strong>{(FINANCE_USERS.find(u=>u.email===finDRIs[0])||{}).name || finDRIs[0]}</strong>
              {finDRIs.length > 1 && <span className="ml-2 text-blue-500">CC: {finDRIs.slice(1).map(e=>(FINANCE_USERS.find(u=>u.email===e)||{}).name||e).join(', ')}</span>}
            </div>
          )}
          {isRevopsPrimary && (
            <div className="flex gap-3 flex-wrap mt-2">
              {edit && <Btn variant="navy" onClick={() => { revopsApprove(form.id,{editedForm:ef,comment:cmt,financeApprovers:finDRIs}); setEdit(false); show('Edits saved!'); }}>💾 Save edits</Btn>}
              <Btn variant="success" onClick={handleRevopsApprove}>✓ Approve → Finance</Btn>
              <Btn variant="danger"  onClick={handleRevopsReject}>✕ Reject</Btn>
            </div>
          )}
        </Card>
      )}

      {/* Finance panel */}
      {(user?.role==='finance'||user?.isUniversal) && form.status==='revops_approved' && (
        <Card className="mt-4 p-6">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h3 className="font-bold" style={{ color:NAVY }}>💼 Finance approval</h3>
            {financePrimaryEmail && (
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-teal-100 text-teal-700">
                  Primary DRI: {(FINANCE_USERS.find(u=>u.email===financePrimaryEmail)||{}).name || financePrimaryEmail}
                </span>
                {(form.finance_approvers||[]).slice(1).map(email => (
                  <span key={email} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    CC: {(FINANCE_USERS.find(u=>u.email===email)||{}).name || email}
                  </span>
                ))}
              </div>
            )}
          </div>
          {!isFinancePrimary && (
            <div className="mb-4 p-3 rounded-xl text-sm bg-amber-50 border border-amber-200 text-amber-700">
              👁 You are CC'd on this approval. Only the Primary DRI (<strong>{(FINANCE_USERS.find(u=>u.email===financePrimaryEmail)||{}).name || financePrimaryEmail}</strong>) can assign the OF number and approve.
            </div>
          )}
          {isFinancePrimary && (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Lbl c="OF Number" req/>
                  <div className="flex items-center border-2 rounded-lg overflow-hidden font-mono font-bold text-base" style={{ borderColor:T }}>
                    <span className="px-3 py-2 text-slate-400 bg-slate-50 border-r border-slate-200 select-none whitespace-nowrap">OF-FY-</span>
                    <input value={ofNum.replace(/^OF-FY-/,'')}
                      onChange={e=>{ const val=e.target.value.replace(/[^0-9]/g,''); setOfNum(val?'OF-FY-'+val:''); }}
                      placeholder="0001" maxLength={6}
                      className="flex-1 px-3 py-2 focus:outline-none font-mono font-bold"
                      style={{ color:NAVY }}/>
                  </div>
                  <p className="text-xs mt-1 text-brand-faint">Enter only the number — prefix is added automatically</p>
                </div>
              </div>
              <TA label="Finance comment (optional)" value={cmt} onChange={setCmt}/>
              <div className="flex gap-3">
                <Btn onClick={handleFinanceApprove}>✓ Approve &amp; assign OF#</Btn>
                <Btn variant="danger" onClick={async () => { await financeReject(form.id,{comment:cmt}); show('Sent back to queue.','error'); }}>↩ Send back</Btn>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Approved — mark signed */}
      {(user?.role==='finance'||user?.isUniversal) && form.status==='approved' && (
        <Card className="mt-4 p-6">
          <h3 className="font-bold mb-4 text-green-800">✅ Mark as signed</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Lbl c="Signing date" req/>
              <input type="date" value={sigDate} onChange={e=>setSigDate(e.target.value)}
                className="field-input" style={{ borderColor:'#e2e8f0' }}/>
            </div>
            <div>
              <Lbl c="Signed PDF link (Google Drive)"/>
              <input type="url" value={signedLink} onChange={e=>setSignedLink(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="field-input" style={{ borderColor:'#e2e8f0' }}/>
            </div>
          </div>
          <div className="flex gap-3">
            <Btn variant="success" onClick={handleMarkSigned}>✍️ Mark as signed</Btn>
            <Btn variant="ghost" size="sm" onClick={() => openPDF(live)}>👁 Preview PDF</Btn>
          </div>
        </Card>
      )}

      {/* Signed */}
      {form.status === 'signed' && (
        <Card className="mt-4 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="font-bold text-green-800">✍️ Signed</p>
              <p className="text-sm mt-0.5 text-green-700">
                Signed on {fmtDate(form.signed_date)} · OF# <strong className="font-mono">{form.of_number}</strong>
              </p>
            </div>
            <Btn variant="ghost" size="sm" onClick={() => openPDF(live)}>👁 Preview PDF</Btn>
          </div>
          {edit && (user?.role==='finance' || user?.isUniversal) && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                  ✏️ Editing signed form — changes will be saved directly
                </span>
              </div>
              <Btn variant="navy" onClick={handleSaveSignedEdits}>💾 Save edits</Btn>
            </div>
          )}
          {(user?.role==='finance'||user?.isUniversal) && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <Lbl c="Signed PDF link (Google Drive)"/>
              <div className="flex gap-3 items-center">
                <input type="url" value={signedLink} onChange={e=>setSignedLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="field-input flex-1" style={{ borderColor:'#e2e8f0' }}/>
                <Btn size="sm" onClick={async () => {
                  await updateDraft(form.id, { signed_of_link: signedLink });
                  show('Signed PDF link saved ✓');
                }}>Save link</Btn>
              </div>
              {form.signed_of_link && (
                <a href={form.signed_of_link} target="_blank" rel="noreferrer"
                  className="text-xs font-medium hover:underline mt-2 inline-block"
                  style={{ color:'#00C3B5' }}>
                  📎 Open current signed PDF →
                </a>
              )}
            </div>
          )}
          {!(user?.role==='finance'||user?.isUniversal) && form.signed_of_link && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <a href={form.signed_of_link} target="_blank" rel="noreferrer"
                className="text-xs font-medium hover:underline"
                style={{ color:'#00C3B5' }}>
                📎 View signed PDF →
              </a>
            </div>
          )}
        </Card>
      )}

      {/* ── PROFORMA INVOICES SECTION ─────────────────────────────────────── */}
      {['approved','signed'].includes(form.status) && (
        <Card className="mt-4 p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-faint">Proforma Invoices</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {piLoading ? 'Loading…' : `${pis.length} PI${pis.length!==1?'s':''} raised against this Order Form`}
              </p>
            </div>
            {canRaisePI && (
              <Btn size="sm" onClick={()=>setShowPIForm(v=>!v)}>
                {showPIForm ? '✕ Cancel' : '+ Raise PI'}
              </Btn>
            )}
          </div>

          {/* Existing PIs list */}
          {!piLoading && pis.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-100 mb-4">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-400 uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-semibold">PI Number</th>
                    <th className="px-4 py-2.5 font-semibold">Amount</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold">Created By</th>
                    <th className="px-4 py-2.5 font-semibold">Reviewed By</th>
                  </tr>
                </thead>
                <tbody>
                  {pis.map(pi=>(
                    <tr key={pi.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-700">{pi.pi_number}</td>
                      <td className="px-4 py-2.5 font-semibold">{fmtAmt(pi.grand_total,pi.currency)}</td>
                      <td className="px-4 py-2.5"><PIPill status={pi.status}/></td>
                      <td className="px-4 py-2.5 text-slate-500">{pi.created_by_name||'—'}</td>
                      <td className="px-4 py-2.5 text-slate-400">{pi.revops_reviewer||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!piLoading && pis.length === 0 && !showPIForm && (
            <div className="py-6 text-center text-slate-400 text-sm">
              No PIs raised yet.
              {canRaisePI && <span className="ml-1">Click <strong>+ Raise PI</strong> to create one.</span>}
            </div>
          )}

          {/* Inline create form */}
          {showPIForm && canRaisePI && (
            <PICreateForm
              form={form}
              user={user}
              onSubmitted={async (piNum) => {
                show(`PI ${piNum} submitted for RevOps approval ✓`);
                setShowPIForm(false);
                await loadPIs();
              }}
            />
          )}
        </Card>
      )}

      {/* Audit trail */}
      <Card className="mt-4 p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest mb-3 text-brand-faint">Audit trail</p>
        <div className="space-y-2">
          {form.submitted_at && (
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="w-20 shrink-0 text-slate-300">{fmtDate(form.submitted_at.split('T')[0])}</span>
              Submitted by <strong>{form.sales_rep_name}</strong>
            </div>
          )}
          {form.revops_reviewed_at && (
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="w-20 shrink-0 text-slate-300">{fmtDate(form.revops_reviewed_at.split('T')[0])}</span>
              RevOps {form.status==='revops_rejected'?'rejected':'approved'}{form.revops_comment && ` — "${form.revops_comment}"`}
            </div>
          )}
          {form.approved_at && (
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="w-20 shrink-0 text-slate-300">{fmtDate(form.approved_at.split('T')[0])}</span>
              Finance approved · <strong className="font-mono">{form.of_number}</strong>
            </div>
          )}
          {form.signed_date && (
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="w-20 shrink-0 text-slate-300">{fmtDate(form.signed_date)}</span>
              Signed
            </div>
          )}
        </div>
      </Card>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}
