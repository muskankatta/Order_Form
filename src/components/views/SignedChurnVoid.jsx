import { useState, useEffect, useMemo } from 'react';
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
import { generateSignedOFReport, generateUnsignedOFReport } from '../../utils/reports.js';

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

// Period helpers (Indian FY)
function getSigningPeriod(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr), m = d.getMonth()+1, y = d.getFullYear();
  let q, fy;
  if      (m>=4&&m<=6)  { q='Q1'; fy=y+1; }
  else if (m>=7&&m<=9)  { q='Q2'; fy=y+1; }
  else if (m>=10&&m<=12){ q='Q3'; fy=y+1; }
  else                  { q='Q4'; fy=y;   }
  const monthLabel = d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
  return { q, fy, fyLabel:`FY${String(fy).slice(2)}`, monthLabel };
}

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

  // Period filters for Signed tab
  const [periodFY,    setPeriodFY]    = useState('all');
  const [periodQtr,   setPeriodQtr]   = useState('all');
  const [periodMonth, setPeriodMonth] = useState('all');

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

  // Available FY/Quarter/Month options derived from signed forms
  const signedBase = useMemo(() =>
    forms.filter(f => f.signed_date || f.status==='signed'),
  [forms]);

  const availableFYs = useMemo(() => {
    const s = new Set();
    signedBase.forEach(f => { const p = getSigningPeriod(f.signed_date); if (p) s.add(p.fyLabel); });
    return [...s].sort((a,b)=>b.localeCompare(a));
  }, [signedBase]);

  const availableQtrs = useMemo(() => {
    const s = new Set();
    signedBase.forEach(f => {
      const p = getSigningPeriod(f.signed_date);
      if (p && (periodFY==='all'||p.fyLabel===periodFY)) s.add(p.q);
    });
    return [...s].sort();
  }, [signedBase, periodFY]);

  const availableMonths = useMemo(() => {
    const map = {};
    signedBase.forEach(f => {
      const p = getSigningPeriod(f.signed_date);
      if (!p) return;
      if (periodFY!=='all'&&p.fyLabel!==periodFY) return;
      if (periodQtr!=='all'&&p.q!==periodQtr) return;
      // sortKey for ordering
      const d = new Date(f.signed_date);
      const sortKey = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}`;
      map[p.monthLabel] = sortKey;
    });
    return Object.entries(map).sort((a,b)=>a[1].localeCompare(b[1])).map(([lbl])=>lbl);
  }, [signedBase, periodFY, periodQtr]);

  const matchesPeriod = (f) => {
    if (!f.signed_date) return periodFY==='all'&&periodQtr==='all'&&periodMonth==='all';
    const p = getSigningPeriod(f.signed_date);
    if (!p) return false;
    if (periodFY!=='all'&&p.fyLabel!==periodFY) return false;
    if (periodQtr!=='all'&&p.q!==periodQtr) return false;
    if (periodMonth!=='all'&&p.monthLabel!==periodMonth) return false;
    return true;
  };

  const baseFilter = arr => {
    let res = arr;
    if (q) res = res.filter(f=>[f.customer_name,f.of_number,f.brand_name,f.sales_rep_name].some(v=>v?.toLowerCase().includes(q.toLowerCase())));
    return res.filter(f => matchesRegion(f, regionFilter));
  };

  const approved = baseFilter(forms.filter(f => f.status==='approved' && !f.signed_date));
  const signed   = baseFilter(forms.filter(f => (f.signed_date || f.status==='signed') && matchesPeriod(f)));

  // Revenue helpers
  const TO_USD = { USD:v=>v, INR:v=>v/91, AED:v=>v/3.6725, MYR:v=>v/4.30, IDR:v=>v/16950, GBP:v=>v/0.80, EUR:v=>v/0.90, SGD:v=>v/1.35, SAR:v=>v/3.75, AUD:v=>v/1.55 };
  const toUSD = (amt, cur) => (TO_USD[cur] || (v=>v))(Number(amt||0));

  const calcSummary = (arr) => ({
    count: arr.length,
    inr:   arr.filter(f=>f.sales_team==='India').reduce((s,f)=>s+Number(f.committed_revenue||0),0),
    usd:   arr.filter(f=>f.sales_team!=='India').reduce((s,f)=>s+toUSD(f.committed_revenue,f.committed_currency||'USD'),0),
  });

  const approvedSummary = calcSummary(approved);
  const signedSummary   = calcSummary(signed);
  const cvSummary       = { count: cvRequests.length, inr: 0, usd: 0 };

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

  const hasPeriodFilter = periodFY!=='all'||periodQtr!=='all'||periodMonth!=='all';

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-xl font-bold" style={{color:NAVY}}>Signed Order Forms</h2>
        <div className="flex gap-2">
          {cvTab==='signed' && (
            <button onClick={()=>generateSignedOFReport(signed)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all"
              style={{color:NAVY}}>
              📊 Export Signed Report
            </button>
          )}
          {cvTab==='unsigned' && (
            <button onClick={()=>generateUnsignedOFReport(approved)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all"
              style={{color:NAVY}}>
              📊 Export Unsigned Report
            </button>
          )}
        </div>
      </div>

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

      {/* Search + region filter */}
      <div className="flex gap-3 mb-3 flex-wrap items-center">
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

      {/* Period filters — only on Signed tab */}
      {cvTab==='signed' && (
        <div className="flex gap-2 mb-4 items-center flex-wrap">
          <select value={periodFY} onChange={e=>{setPeriodFY(e.target.value);setPeriodQtr('all');setPeriodMonth('all');}}
            className="text-xs border rounded-lg px-3 py-2 bg-white border-slate-200"
            style={periodFY!=='all'?{borderColor:T}:{}}>
            <option value="all">All FYs</option>
            {availableFYs.map(fy=><option key={fy} value={fy}>{fy}</option>)}
          </select>
          <select value={periodQtr} onChange={e=>{setPeriodQtr(e.target.value);setPeriodMonth('all');}}
            className="text-xs border rounded-lg px-3 py-2 bg-white border-slate-200"
            style={periodQtr!=='all'?{borderColor:T}:{}}>
            <option value="all">All quarters</option>
            {availableQtrs.map(q=><option key={q} value={q}>{q} (Apr–{q==='Q1'?'Jun':q==='Q2'?'Sep':q==='Q3'?'Dec':'Mar'})</option>)}
          </select>
          <select value={periodMonth} onChange={e=>setPeriodMonth(e.target.value)}
            className="text-xs border rounded-lg px-3 py-2 bg-white border-slate-200"
            style={periodMonth!=='all'?{borderColor:T}:{}}>
            <option value="all">All months</option>
            {availableMonths.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
          {hasPeriodFilter && (
            <button onClick={()=>{setPeriodFY('all');setPeriodQtr('all');setPeriodMonth('all');}}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
              ✕ Clear period
            </button>
          )}
          {hasPeriodFilter && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{background:'#e0f7f5',color:'#00897b'}}>
              {signed.length} signed OFs in period
            </span>
          )}
        </div>
      )}

      {/* ── Summary bar — dynamic per active tab ──────────────────────────── */}
      {(() => {
        const s = cvTab==='unsigned' ? approvedSummary : cvTab==='signed' ? signedSummary : cvSummary;
        return (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white rounded-xl border px-4 py-3" style={{borderColor:'#e8edf3',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-faint mb-1">
                {cvTab==='unsigned'?'Pending Signing':cvTab==='signed'?'Signed OFs':'Pending Requests'}
              </div>
              <div className="text-2xl font-black" style={{color:NAVY}}>{s.count}</div>
            </div>
            <div className="bg-white rounded-xl border px-4 py-3" style={{borderColor:'#e8edf3',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-faint mb-1">Committed Revenue · India (INR)</div>
              <div className="text-xl font-black" style={{color:T}}>
                {cvTab==='requests' ? '—' : '₹'+Math.round(s.inr).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-white rounded-xl border px-4 py-3" style={{borderColor:'#e8edf3',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-brand-faint mb-1">Committed Revenue · Global + AI/SaaS (USD)</div>
              <div className="text-xl font-black" style={{color:'#7c3aed'}}>
                {cvTab==='requests' ? '—' : '$'+Math.round(s.usd).toLocaleString('en-US')}
              </div>
            </div>
          </div>
        );
      })()}

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
          <table style={{minWidth:'750px',width:'100%'}} className="text-sm">
            <thead><tr>
              {['OF#','Customer','Region','Quarter','Value','Signed On','Signed PDF'].map(h=>(
                <th key={h} className={thCls}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {signed.length===0&&<tr><td colSpan={7} className="text-center py-12 text-slate-300">No signed OFs{hasPeriodFilter?' in selected period':' yet'}.</td></tr>}
              {signed.map(f=>{
                const region=formRegion(f);
                const period=getSigningPeriod(f.signed_date);
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
                    <td className="px-4 py-3 text-xs">
                      {period
                        ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700">{period.q} {period.fyLabel}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">{f.committed_currency} {Number(f.committed_revenue||0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs text-brand-muted">{fmtDate(f.signed_date)}</td>
                    <td className="px-4 py-3 text-xs" onClick={e=>e.stopPropagation()}>
                      {f.signed_of_link
                        ? <a href={f.signed_of_link} target="_blank" rel="noreferrer" className="font-medium hover:underline" style={{color:T}}>View signed PDF</a>
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

  const approvedForms = useMemo(() =>
    forms.filter(f=>['approved','signed'].includes(f.status)),
  [forms]);

  const customerNames = useMemo(() =>
    [...new Set(approvedForms.map(f=>f.customer_name?.trim()))].filter(Boolean).sort((a,b)=>a.localeCompare(b)),
  [approvedForms]);

  // Fix: case-insensitive, trimmed comparison
  const relevantOFs = useMemo(() =>
    !req.customer
      ? []
      : approvedForms
          .filter(f => f.customer_name?.trim().toLowerCase() === req.customer.trim().toLowerCase())
          .sort((a,b)=>(a.of_number||'').localeCompare(b.of_number||'')),
  [approvedForms, req.customer]);

  const selectedForm = useMemo(() =>
    req.of_number
      ? approvedForms.find(f =>
          f.customer_name?.trim().toLowerCase() === req.customer?.trim().toLowerCase() &&
          f.of_number === req.of_number
        )
      : null,
  [approvedForms, req.customer, req.of_number]);

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
      const form = selectedForm;
      if (isConfigured && db) {
        const reqId = uid();
        await setDoc(doc(db,'churn_void_requests',reqId),{
          id:reqId, form_id:form?.id||'', of_number:req.of_number,
          customer_name:req.customer, status_requested:req.status_requested,
          churn_value:req.churn_value||'', reason:req.reason||'',
          requested_by:user?.name||'', requested_at:new Date().toISOString(), actioned:false,
        });
      }
      await submitChurnVoidRequest({
        form: form||{customer_name:req.customer,of_number:req.of_number},
        statusRequested:req.status_requested, churnValue:req.churn_value, reason:req.reason,
      });
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
          <Sel label="Client / Customer" req
            options={customerNames.map(n=>({value:n,label:n}))}
            value={req.customer}
            onChange={v=>{u('customer',v);u('of_number','');}}/>
          <div className="mb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
              Order Form # <span className="text-red-400">*</span>
            </label>
            <select value={req.of_number}
              onChange={e=>u('of_number',e.target.value)}
              disabled={!req.customer}
              className="field-input cursor-pointer">
              <option value="">{req.customer ? 'Select OF…' : 'Select a customer first'}</option>
              {relevantOFs.map(f=>(
                <option key={f.id} value={f.of_number}>
                  {f.of_number} — {f.customer_name}
                </option>
              ))}
            </select>
            {req.customer && relevantOFs.length === 0 && (
              <p className="text-xs mt-1 text-amber-600">No approved/signed OFs found for this customer.</p>
            )}
          </div>
        </div>

        {selectedForm && (
          <div className="mb-4 p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono font-bold" style={{color:NAVY}}>{selectedForm.of_number}</span>
              <span className="text-slate-400">·</span>
              <span className="text-brand-muted">{selectedForm.start_date} → {selectedForm.end_date}</span>
              <span className="text-slate-400">·</span>
              <span className="font-semibold" style={{color:T}}>{selectedForm.committed_currency} {Number(selectedForm.committed_revenue||0).toLocaleString('en-IN')}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{background:selectedForm.status==='signed'?'#f0fdf4':'#eff6ff',
                        color:selectedForm.status==='signed'?'#15803d':'#1d4ed8'}}>
                {selectedForm.status}
              </span>
            </div>
            <div className="text-brand-faint">{(selectedForm.services_fees||[]).map(s=>s.name).filter(Boolean).join(', ')||'—'}</div>
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

        {req.status_requested==='Churn' && (
          <Inp label="Churn amount" value={req.churn_value} onChange={v=>u('churn_value',v)} placeholder="e.g. 150000" mono hint="Portion of OF value to be churned"/>
        )}
        {req.status_requested==='Void' && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            Warning: Marking as Void will set the OF value to zero.
          </div>
        )}

        <TA label="Reason / justification" req value={req.reason} onChange={v=>u('reason',v)} rows={4}/>
        <MultiSelect label="Notify Finance DRI(s)" req
          options={FINANCE_USERS.map(u=>({value:u.email,label:u.name}))}
          value={req.finance_dris} onChange={v=>u('finance_dris',v)}/>

        {validationErrors.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            <p className="font-bold mb-1">Please fix:</p>
            {validationErrors.map((e,i)=><p key={i}>• {e}</p>)}
          </div>
        )}
        <Btn onClick={handleSubmit} disabled={submitting}>
          {submitting?'Submitting...':'Submit request'}
        </Btn>
      </Card>
      {toast&&<Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}
