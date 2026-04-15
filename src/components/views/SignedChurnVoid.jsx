import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Btn, Lbl, Sel, TA, Inp, MultiSelect, Toast } from '../ui/index.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { FINANCE_USERS } from '../../constants/users.js';
import { getRepRegion } from '../../constants/users.js';
import { fmtDate, uid } from '../../utils/dates.js';
import { useToast } from '../../hooks/useToast.js';
import { db, isConfigured } from '../../firebase.js';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';

const NAVY = '#1B2B4B'; const T = '#00C3B5';

function formRegion(f) { return f.region || getRepRegion(f.sales_rep_email) || null; }

function matchesRegion(f, filter) {
  if (filter === 'all')       return true;
  if (filter === 'India')     return f.sales_team === 'India';
  if (filter === 'AI/SaaS')   return f.sales_team === 'AI/SaaS';
  if (filter === 'MEA')       return f.sales_team === 'Global' && formRegion(f) === 'MEA';
  if (filter === 'SEA & RoW') return f.sales_team === 'Global' && formRegion(f) === 'SEA & RoW';
  return true;
}

const REGION_FILTERS = [
  { id:'all',       lbl:'All' },
  { id:'India',     lbl:'India' },
  { id:'MEA',       lbl:'Global · MEA' },
  { id:'SEA & RoW', lbl:'Global · SEA & RoW' },
  { id:'AI/SaaS',   lbl:'AI/SaaS' },
];

export function SignedOFs() {
  const { forms, markSigned, applyDealStatus } = useForms();
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast, show, hide } = useToast();
  const [cvTab,        setCvTab]       = useState(searchParams.get('tab') || 'unsigned');
  const [signingData,  setSigningData] = useState({});
  const [cvRequests,   setCvRequests]  = useState([]);
  const [q,            setQ]           = useState('');
  const [regionFilter, setRegionFilter]= useState('all');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) setCvTab(t);
  }, [searchParams]);

  useEffect(() => {
    if (!isConfigured || !db) return;
    const unsub = onSnapshot(collection(db, 'churn_void_requests'), snap => {
      setCvRequests(
        snap.docs.map(d => d.data())
          .filter(r => !r.actioned)
          .sort((a,b) => (b.requested_at||'').localeCompare(a.requested_at||''))
      );
    });
    return () => unsub();
  }, []);

  const searchFn = arr => {
    let res = arr;
    if (q) res = res.filter(f=>[f.customer_name,f.of_number,f.brand_name,f.sales_rep_name].some(v=>v?.toLowerCase().includes(q.toLowerCase())));
    return res.filter(f => matchesRegion(f, regionFilter));
  };

  const approved = searchFn(forms.filter(f => f.status==='approved' && !f.signed_date));
  const signed   = searchFn(forms.filter(f => f.signed_date || f.status==='signed'));

  const updateField = (id, field, val) =>
    setSigningData(d => ({...d, [id]:{...(d[id]||{}),[field]:val}}));

  const handleMarkSigned = async (f) => {
    const data = signingData[f.id] || {};
    if (!data.date) { alert('Enter signing date first.'); return; }
    await markSigned(f.id, data.date, data.link || '');
    show(f.of_number + ' marked as signed');
  };

  const handleApply = async (r) => {
    const form = forms.find(f => f.id===r.form_id || f.of_number===r.of_number);
    if (!form) { alert('Order Form not found.'); return; }
    await applyDealStatus(form.id, {
      status: r.status_requested.toLowerCase(),
      ...(r.status_requested==='Void'  ? {is_void:true, of_value:0, committed_revenue:0} : {}),
      ...(r.status_requested==='Churn' ? {is_churn:true} : {}),
      status_change_comment: r.reason,
      status_changed_by: user?.name,
      status_changed_at: new Date().toISOString(),
    });
    if (isConfigured && db) {
      await updateDoc(doc(db,'churn_void_requests',r.id), {
        actioned:true, actioned_by:user?.name, actioned_at:new Date().toISOString(),
      });
    }
    show('Status applied: ' + r.status_requested);
  };

  const handleDismiss = async (r) => {
    if (!confirm('Dismiss this request without applying?')) return;
    if (isConfigured && db) {
      await updateDoc(doc(db,'churn_void_requests',r.id), {
        actioned:true, actioned_by:user?.name,
        actioned_at:new Date().toISOString(), rejected:true,
      });
    }
    show('Request dismissed');
  };

  const thCls = "text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-brand-faint bg-slate-50";

  const tabs = [
    { id:'unsigned', lbl:'Pending Signing'+(approved.length?' ('+approved.length+')':'') },
    { id:'requests', lbl:'Churn/Void Requests'+(cvRequests.length?' ('+cvRequests.length+')':'') },
    { id:'signed',   lbl:'Signed ('+signed.length+')' },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4" style={{color:NAVY}}>Signed Order Forms</h2>

      {/* Tab buttons */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setCvTab(t.id)}
            className="px-4 py-2 text-sm font-semibold rounded-xl border transition-all"
            style={cvTab===t.id?{background:NAVY,color:'#fff',borderColor:NAVY}:{background:'#f8fafc',color:'#64748b',borderColor:'#e2e8f0'}}>
            {t.lbl}
          </button>
        ))}
      </div>

      {/* Search + region filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <input value={q} onChange={e=>setQ(e.target.value)}
          placeholder="🔍 Search customer, OF#, rep…"
          className="text-sm border rounded-xl px-4 py-2.5 focus:outline-none border-slate-200 flex-1" style={{minWidth:'200px'}}/>
        <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
          {REGION_FILTERS.map(f=>(
            <button key={f.id} onClick={()=>setRegionFilter(f.id)}
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all"
              style={regionFilter===f.id?{background:NAVY,color:'#fff'}:{color:'#94a3b8'}}>
              {f.lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Pending Signing */}
      {cvTab==='unsigned' && (
        approved.length===0
          ? <Card className="p-12 text-center text-slate-300">No OFs pending signing</Card>
          : <Card className="overflow-hidden">
              <div className="overflow-x-auto">
              <table style={{minWidth:'900px',width:'100%'}} className="text-sm">
                <thead><tr>
                  {['OF#','Customer','Value','Region','Approved On','Signing Date','Signed PDF Link','Action'].map(h=>(
                    <th key={h} className={thCls}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {approved.map(f=>{
                    const data=signingData[f.id]||{};
                    const sentDate=f.approved_at||f.submitted_at;
                    const daysSince=sentDate?Math.floor((new Date()-new Date(sentDate))/86400000):null;
                    const overdue=daysSince!==null&&daysSince>=30;
                    const region=formRegion(f);
                    return (
                      <tr key={f.id} className={'border-b border-slate-50 last:border-0 '+(overdue?'bg-red-50':'')}>
                        <td className="px-4 py-3 font-mono font-bold" style={{color:NAVY}}>
                          {f.of_number}
                          {overdue&&<span className="ml-2 text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full font-bold">{daysSince}d</span>}
                        </td>
                        <td className="px-4 py-3 cursor-pointer hover:underline font-medium" style={{color:NAVY}} onClick={()=>navigate('/form/'+f.id)}>{f.customer_name}</td>
                        <td className="px-4 py-3 text-xs">{f.committed_currency} {Number(f.committed_revenue||0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-xs">
                          {f.sales_team==='India'?<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">India</span>
                           :f.sales_team==='AI/SaaS'?<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">AI/SaaS</span>
                           :region?<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700">{region}</span>
                           :<span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-brand-muted">{fmtDate(f.approved_at?.split('T')[0])}</td>
                        <td className="px-4 py-3">
                          <input type="date" value={data.date||''} onChange={e=>updateField(f.id,'date',e.target.value)}
                            className="field-input text-xs" style={{borderColor:'#e2e8f0',width:'140px'}}/>
                        </td>
                        <td className="px-4 py-3">
                          <input type="url" value={data.link||''} onChange={e=>updateField(f.id,'link',e.target.value)}
                            placeholder="Paste signed PDF link" className="field-input text-xs" style={{borderColor:'#e2e8f0',width:'200px'}}/>
                        </td>
                        <td className="px-4 py-3">
                          <Btn size="sm" variant="success" disabled={!data.date} onClick={()=>handleMarkSigned(f)}>Mark signed</Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </Card>
      )}

      {/* Churn/Void Requests */}
      {cvTab==='requests' && (
        <div>
          <p className="text-sm text-brand-muted mb-4">Requests filed by RevOps. Review and apply or dismiss each one.</p>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
            <table style={{minWidth:'950px',width:'100%'}} className="text-sm">
              <thead><tr>
                {['OF#','Customer','Request','Churn Amount','Reason','Filed By','Date','Action'].map(h=>(
                  <th key={h} className={thCls}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {cvRequests.length===0&&<tr><td colSpan={8} className="text-center py-12 text-slate-300">No pending Churn/Void requests</td></tr>}
                {cvRequests.map(r=>(
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-mono font-bold text-sm" style={{color:NAVY}}>{r.of_number||'--'}</td>
                    <td className="px-4 py-3 text-sm font-medium" style={{color:NAVY}}>{r.customer_name}</td>
                    <td className="px-4 py-3">
                      <span className={'text-xs px-2 py-1 rounded-full font-bold '+(r.status_requested==='Void'?'bg-red-100 text-red-700':'bg-orange-100 text-orange-700')}>
                        {r.status_requested}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-muted">{r.churn_value||'--'}</td>
                    <td className="px-4 py-3 text-xs text-brand-muted" style={{maxWidth:'180px'}}>{r.reason||'--'}</td>
                    <td className="px-4 py-3 text-xs text-brand-muted">{r.requested_by}</td>
                    <td className="px-4 py-3 text-xs text-brand-muted">{r.requested_at?.split('T')[0]}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={()=>handleApply(r)} className="text-xs font-medium px-2 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors">Apply</button>
                        <button onClick={()=>handleDismiss(r)} className="text-xs font-medium px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">Dismiss</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      )}

      {/* Signed */}
      {cvTab==='signed' && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
          <table style={{minWidth:'700px',width:'100%'}} className="text-sm">
            <thead><tr>
              {['OF#','Customer','Region','Value','Signed On','Signed PDF'].map(h=>(
                <th key={h} className={thCls}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {signed.length===0&&<tr><td colSpan={6} className="text-center py-12 text-slate-300">No signed OFs yet.</td></tr>}
              {signed.map(f=>{
                const region=formRegion(f);
                return (
                  <tr key={f.id} className="border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50" onClick={()=>navigate('/form/'+f.id)}>
                    <td className="px-4 py-3 font-mono font-bold" style={{color:NAVY}}>{f.of_number}</td>
                    <td className="px-4 py-3 font-medium" style={{color:NAVY}}>{f.customer_name}</td>
                    <td className="px-4 py-3 text-xs">
                      {f.sales_team==='India'?<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">India</span>
                       :f.sales_team==='AI/SaaS'?<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">AI/SaaS</span>
                       :region?<span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700">{region}</span>
                       :<span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">{f.committed_currency} {Number(f.committed_revenue||0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs text-brand-muted">{fmtDate(f.signed_date)}</td>
                    <td className="px-4 py-3 text-xs">
                      {f.signed_of_link
                        ? <a href={f.signed_of_link} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="font-medium hover:underline" style={{color:T}}>View signed PDF</a>
                        : <span className="text-slate-300">--</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}

export function ChurnVoidRequest() {
  const { forms, submitChurnVoidRequest } = useForms();
  const { user }  = useAuth();
  const { toast, show, hide } = useToast();
  const [req, setReq] = useState({customer:'',of_number:'',status_requested:'Churn',churn_value:'',reason:'',finance_dris:[]});
  const [validationErrors, setValidationErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const u = (k,v) => setReq(r=>({...r,[k]:v}));
  const approvedForms = forms.filter(f=>['approved','signed'].includes(f.status));
  const customerNames = [...new Set(approvedForms.map(f=>f.customer_name?.trim()))].filter(Boolean).sort((a,b)=>a.localeCompare(b));
  const relevantOFs = approvedForms.filter(f=>!req.customer||f.customer_name?.trim()===req.customer?.trim()).sort((a,b)=>(a.of_number||'').localeCompare(b.of_number||''));
  const selectedForm = req.of_number ? forms.find(f=>f.customer_name?.trim()===req.customer?.trim()&&f.of_number===req.of_number) : null;

  const handleSubmit = async () => {
    const errs=[];
    if (!req.customer)       errs.push('Select a customer');
    if (!req.of_number)      errs.push('Select an Order Form number');
    if (!req.reason?.trim()) errs.push('Enter a reason / justification');
    if (!req.finance_dris.length) errs.push('Select at least one Finance DRI');
    setValidationErrors(errs);
    if (errs.length) return;
    setSubmitting(true);
    try {
      const form=forms.find(f=>f.customer_name?.trim()===req.customer?.trim()&&f.of_number===req.of_number);
      if (isConfigured&&db) {
        const reqId=uid();
        await setDoc(doc(db,'churn_void_requests',reqId),{
          id:reqId, form_id:form?.id||'', of_number:req.of_number, customer_name:req.customer,
          status_requested:req.status_requested, churn_value:req.churn_value||'', reason:req.reason||'',
          requested_by:user?.name||'', requested_at:new Date().toISOString(), actioned:false,
        });
      }
      await submitChurnVoidRequest({form:form||{customer_name:req.customer,of_number:req.of_number},statusRequested:req.status_requested,churnValue:req.churn_value,reason:req.reason});
      show('Request submitted');
      setReq({customer:'',of_number:'',status_requested:'Churn',churn_value:'',reason:'',finance_dris:[]});
      setValidationErrors([]);
    } catch(e) { setValidationErrors(['Error: '+e.message]); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{color:NAVY}}>Churn / Void Request</h2>
      <p className="text-sm text-brand-muted mb-6">File a request to Finance to mark a deal as Churn or Void.</p>
      <Card className="p-6 max-w-2xl">
        <div className="grid grid-cols-2 gap-x-4">
          <Sel label="Client / Customer" req options={customerNames.map(n=>({value:n,label:n}))} value={req.customer} onChange={v=>{u('customer',v);u('of_number','');}}/>
          <Sel label="Order Form #" req options={relevantOFs.map(f=>({value:f.of_number,label:f.of_number+' — '+f.customer_name}))} value={req.of_number} onChange={v=>u('of_number',v)} hint={!req.customer?'Select a customer first':''}/>
        </div>
        {selectedForm&&(
          <div className="mb-4 p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-600">
            <strong>{selectedForm.of_number}</strong> · {selectedForm.start_date} → {selectedForm.end_date} · {selectedForm.committed_currency} {Number(selectedForm.committed_revenue||0).toLocaleString('en-IN')}
          </div>
        )}
        <div className="mb-4">
          <Lbl c="Status requested" req/>
          <div className="flex gap-3">
            {['Churn','Void'].map(opt=>(
              <button key={opt} type="button" onClick={()=>u('status_requested',opt)}
                className="px-5 py-2 text-sm font-semibold rounded-lg border transition-all"
                style={req.status_requested===opt?{background:NAVY,color:'#fff',borderColor:NAVY}:{background:'#f8fafc',color:'#64748b',borderColor:'#e2e8f0'}}>
                {opt}
              </button>
            ))}
          </div>
        </div>
        {req.status_requested==='Churn'&&<Inp label="Churn amount" value={req.churn_value} onChange={v=>u('churn_value',v)} placeholder="e.g. 150000" mono hint="Portion of OF value to be churned"/>}
        {req.status_requested==='Void'&&<div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">Warning: Marking as Void will set the OF value to zero.</div>}
        <TA label="Reason / justification" req value={req.reason} onChange={v=>u('reason',v)} rows={4}/>
        <MultiSelect label="Notify Finance DRI(s)" req options={FINANCE_USERS.map(u=>({value:u.email,label:u.name}))} value={req.finance_dris} onChange={v=>u('finance_dris',v)}/>
        {validationErrors.length>0&&(
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <p className="font-bold mb-1">Please fix:</p>
            {validationErrors.map((e,i)=><p key={i}>• {e}</p>)}
          </div>
        )}
        <Btn onClick={handleSubmit} disabled={submitting}>{submitting?'Submitting...':'Submit request'}</Btn>
      </Card>
      {toast&&<Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}
