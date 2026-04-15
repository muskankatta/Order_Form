import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, StatusPill, Btn } from '../ui/index.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { STATUS } from '../../constants/status.js';
import { SALES_TEAMS } from '../../constants/formOptions.js';
import { SALES_REPS } from '../../constants/users.js';
import { fmtShort } from '../../utils/dates.js';
import { exportOFIndex, exportServiceIndex } from '../../utils/csv.js';
import { generateRepositoryReport } from '../../utils/reports.js';

const NAVY='#1B2B4B'; const T='#00C3B5';

// ── Quarter helpers ────────────────────────────────────────────────────────
function getSigningQuarter(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr), m = d.getMonth()+1, y = d.getFullYear();
  if (m>=4  && m<=6)  return { q:'Q1', fy:y+1 };
  if (m>=7  && m<=9)  return { q:'Q2', fy:y+1 };
  if (m>=10 && m<=12) return { q:'Q3', fy:y+1 };
  return { q:'Q4', fy:y };
}
function fmtQtr(dateStr) {
  const r = getSigningQuarter(dateStr);
  return r ? `${r.q} FY${String(r.fy).slice(2)}` : '—';
}
function getCurrentFY() {
  const m = new Date().getMonth()+1, y = new Date().getFullYear();
  return m>=4 ? y+1 : y;
}

// ── All columns definition ─────────────────────────────────────────────────
const ALL_COLUMNS = [
  { id:'index',     label:'#',                  default:true,  alwaysOn:true },
  { id:'of_number', label:'OF Number',           default:true,  alwaysOn:true },
  { id:'customer',  label:'Customer',            default:true,  alwaysOn:true },
  { id:'services',  label:'Services',            default:true  },
  { id:'revenue',   label:'Committed Revenue',   default:true  },
  { id:'period',    label:'Period',              default:true  },
  { id:'quarter',   label:'Quarter',             default:true  },
  { id:'active',    label:'Active',              default:true  },
  { id:'rep',       label:'Sales Rep',           default:true  },
  { id:'team',      label:'Team',               default:false  },
  { id:'status',    label:'Status',             default:true  },
  { id:'signed_date',label:'Signing Date',       default:false },
  { id:'sale_type', label:'Sale Type',           default:false },
  { id:'segment',   label:'Segment',            default:false },
];

function ColumnPicker({ visible, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = id => {
    const col = ALL_COLUMNS.find(c => c.id === id);
    if (col?.alwaysOn) return;
    onChange(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl border transition-all"
        style={{ borderColor:'#e2e8f0', background:'#f8fafc', color:'#475569' }}>
        <span>⚙ Columns</span>
        <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
          style={{ background:T, color:'#fff' }}>{visible.length}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 w-52">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2 px-1" style={{ color:'#94a3b8' }}>
            Toggle columns
          </div>
          {ALL_COLUMNS.map(col => (
            <label key={col.id}
              className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-all cursor-pointer ${col.alwaysOn ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-50'}`}>
              <input type="checkbox"
                checked={visible.includes(col.id)}
                onChange={() => toggle(col.id)}
                disabled={col.alwaysOn}
                className="accent-teal-500"/>
              <span style={{ color:'#475569' }}>{col.label}</span>
              {col.alwaysOn && <span className="text-[9px] ml-auto text-slate-400">locked</span>}
            </label>
          ))}
          <div className="border-t border-slate-100 mt-2 pt-2 px-1">
            <button onClick={() => onChange(ALL_COLUMNS.filter(c=>c.default).map(c=>c.id))}
              className="text-xs font-medium" style={{ color:T }}>
              Reset to default
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusChangeModal({ form, onClose, onSave }) {
  const [newStatus, setNewStatus] = useState(form.status);
  const [comment,   setComment]   = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h3 className="font-bold text-lg mb-1" style={{ color:NAVY }}>Change Status</h3>
        <p className="text-sm text-brand-muted mb-4">{form.customer_name} · {form.of_number}</p>
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">New status <span className="text-red-400">*</span></label>
          <select value={newStatus} onChange={e=>setNewStatus(e.target.value)} className="field-input cursor-pointer" style={{ borderColor:'#e2e8f0' }}>
            {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">Reason / comment</label>
          <textarea rows={3} value={comment} onChange={e=>setComment(e.target.value)}
            className="field-input resize-none" style={{ borderColor:'#e2e8f0' }}
            placeholder="Optional — reason for status change"/>
        </div>
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          ⚠️ Changing to <strong>Void</strong> will zero the OF value. <strong>Churn</strong> will flag the deal for partial revenue. <strong>Dropped</strong> archives the deal.
        </div>
        <div className="flex gap-3">
          <Btn onClick={() => onSave(newStatus, comment)}>Save change</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

export default function Repository() {
  const { user }  = useAuth();
  const { forms, applyDealStatus } = useForms();
  const navigate  = useNavigate();
  const [searchParams] = useSearchParams();

  const [q,           setQ]          = useState('');
  const [st,          setSt]         = useState(searchParams.get('status') || 'all');
  const [teamFilter,  setTeamFilter] = useState('all');
  const [repFilter,   setRepFilter]  = useState('all');
  const [dateFrom,    setDateFrom]   = useState('');
  const [dateTo,      setDateTo]     = useState('');
  const [qtrFilter,   setQtrFilter]  = useState('all');
  const [fyFilter,    setFyFilter]   = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [leadCatFilter, setLeadCatFilter] = useState('all');
  const [tab,         setTab]        = useState('of');
  const [statusModal, setStatusModal]= useState(null);
  const [sortBy,      setSortBy]     = useState('approved_desc');
  const [visibleCols, setVisibleCols]= useState(() =>
    ALL_COLUMNS.filter(c => c.default).map(c => c.id)
  );

  useEffect(() => {
    const s = searchParams.get('status');
    if (s) setSt(s);
  }, [searchParams]);

  const isSales    = user?.role === 'sales' && !user?.isUniversal;
  const sortedReps = [...SALES_REPS].sort((a,b) => a.name.localeCompare(b.name));

  // Build FY options from forms that have signing dates
  const fyOptions = [...new Set(
    forms
      .filter(f => f.signed_date)
      .map(f => getSigningQuarter(f.signed_date)?.fy)
      .filter(Boolean)
  )].sort((a,b) => b-a);

  const filtered = forms.filter(f => {
    if (isSales && f.sales_rep_email !== user.email) return false;
    const m  = !q || [f.customer_name, f.of_number, f.sales_rep_name, f.brand_name]
                  .some(v => v?.toLowerCase().includes(q.toLowerCase()));
    const s  = st==='all'         || f.status===st;
    const t  = teamFilter==='all' || f.sales_team===teamFilter;
    const r  = repFilter==='all'  || f.sales_rep_email===repFilter;
    const df = !dateFrom || (f.start_date && f.start_date >= dateFrom);
    const dt = !dateTo   || (f.start_date && f.start_date <= dateTo);
    const qInfo = getSigningQuarter(f.signed_date);
    const qm = qtrFilter==='all' || (qInfo && qInfo.q===qtrFilter);
    const fm = fyFilter==='all'  || (qInfo && String(qInfo.fy)===String(fyFilter));
    const ch = channelFilter==='all' || f.lead_type===channelFilter;
    const lc = leadCatFilter==='all' || f.lead_category===leadCatFilter;
    return m && s && t && r && df && dt && qm && fm && ch && lc;
  });

  const sorted = [...filtered].sort((a,b) => {
    if (sortBy==='approved_desc') return (b.approved_at||b.submitted_at||'').localeCompare(a.approved_at||a.submitted_at||'');
    if (sortBy==='approved_asc')  return (a.approved_at||a.submitted_at||'').localeCompare(b.approved_at||b.submitted_at||'');
    if (sortBy==='name_asc')  return (a.customer_name||'').localeCompare(b.customer_name||'');
    if (sortBy==='name_desc') return (b.customer_name||'').localeCompare(a.customer_name||'');
    return 0;
  });

  const svcRows = [];
  sorted.forEach(f => (f.services_fees||[]).forEach(svc => svcRows.push({f,svc})));

  // Deduplicate by OF number for the Index tab — keep the doc with the most data/latest update
  const dedupedSorted = (() => {
    const seen = new Map();
    sorted.forEach(f => {
      if (!f.of_number) return;
      const existing = seen.get(f.of_number);
      if (!existing) { seen.set(f.of_number, f); return; }
      // Prefer the one with a signed_date, or the later created_at
      const fBetter = (f.signed_date && !existing.signed_date)
        || (!existing.signed_date && (f.created_at||'') > (existing.created_at||''));
      if (fBetter) seen.set(f.of_number, f);
    });
    // Include forms without OF numbers as-is
    const noNum = sorted.filter(f => !f.of_number);
    return [...seen.values(), ...noNum];
  })();

  const show = id => visibleCols.includes(id);
  const thCls = "text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-brand-faint whitespace-nowrap";

  const handleStatusSave = async (newStatus, comment) => {
    const f = statusModal;
    const patch = {
      status: newStatus,
      ...(newStatus==='void'    ? { is_void:true,  of_value:0, committed_revenue:0 } : {}),
      ...(newStatus==='churn'   ? { is_churn:true  } : {}),
      ...(newStatus==='dropped' ? { is_dropped:true } : {}),
      status_change_comment: comment,
      status_changed_by: user?.name,
      status_changed_at: new Date().toISOString(),
    };
    await applyDealStatus(f.id, patch);
    setStatusModal(null);
  };

  const hasActiveFilters = qtrFilter!=='all' || fyFilter!=='all' || dateFrom || dateTo || channelFilter!=='all' || leadCatFilter!=='all';

  // ── Summary stats (dynamic, based on filtered set) ────────────────────────
  const TO_USD = { USD:v=>v, INR:v=>v/91, AED:v=>v/3.6725, MYR:v=>v/4.30, IDR:v=>v/16950, GBP:v=>v/0.80, EUR:v=>v/0.90, SGD:v=>v/1.35, SAR:v=>v/3.75, AUD:v=>v/1.55 };
  const toUSD = (amt, cur) => (TO_USD[cur] || (v=>v))(Number(amt||0));

  const summaryINR = filtered
    .filter(f => f.sales_team === 'India')
    .reduce((s,f) => s + Number(f.committed_revenue||0), 0);

  const summaryUSD = filtered
    .filter(f => f.sales_team !== 'India')
    .reduce((s,f) => s + toUSD(f.committed_revenue, f.committed_currency||'USD'), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color:NAVY }}>Repository</h2>
          <p className="text-sm mt-0.5 text-brand-faint">
            {filtered.filter(f=>['approved','signed'].includes(f.status)).length} active · {filtered.length} OFs shown
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {tab==='of' && <ColumnPicker visible={visibleCols} onChange={setVisibleCols}/>}
          <Btn variant="ghost" onClick={() => tab==='of' ? exportOFIndex(filtered) : exportServiceIndex(filtered)}>
            ⬇ Export CSV
          </Btn>
          <Btn variant="ghost" onClick={() => generateRepositoryReport(filtered)}>
            📊 Report
          </Btn>
        </div>
      </div>

      {/* Tab switch */}
      <div className="flex gap-2 mb-4">
        {[{id:'of',lbl:'📁 Index (per OF)'},{id:'service',lbl:'📋 Service index'}].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            className="px-4 py-2 text-sm font-semibold rounded-xl border transition-all"
            style={tab===t.id?{background:NAVY,color:'#fff',borderColor:NAVY}:{background:'#f8fafc',color:'#64748b',borderColor:'#e2e8f0'}}>
            {t.lbl}
          </button>
        ))}
      </div>

      {/* Row 1: search + status + sort */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Search customer, OF#, rep…"
          className="text-sm border rounded-xl px-4 py-2.5 focus:outline-none border-slate-200"/>
        <select value={st} onChange={e=>setSt(e.target.value)}
          className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200">
          <option value="all">All status</option>
          {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
          className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200">
          <option value="approved_desc">↓ Latest approved first</option>
          <option value="approved_asc">↑ Oldest approved first</option>
          <option value="name_asc">A → Z (Client name)</option>
          <option value="name_desc">Z → A (Client name)</option>
        </select>
      </div>

      {/* Row 2: team/rep + quarter + FY */}
      <div className="grid grid-cols-4 gap-3 mb-3">
        {!isSales && (
          <>
            <select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}
              className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200">
              <option value="all">All teams</option>
              {SALES_TEAMS.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <select value={repFilter} onChange={e=>setRepFilter(e.target.value)}
              className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200">
              <option value="all">All sales reps</option>
              {sortedReps.map(r=><option key={r.email} value={r.email}>{r.name}</option>)}
            </select>
          </>
        )}
        {/* Quarter filter */}
        <select value={qtrFilter} onChange={e=>setQtrFilter(e.target.value)}
          className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200"
          style={qtrFilter!=='all'?{borderColor:T,boxShadow:`0 0 0 2px ${T}33`}:{}}>
          <option value="all">All quarters</option>
          <option value="Q1">Q1 (Apr–Jun)</option>
          <option value="Q2">Q2 (Jul–Sep)</option>
          <option value="Q3">Q3 (Oct–Dec)</option>
          <option value="Q4">Q4 (Jan–Mar)</option>
        </select>
        {/* FY filter */}
        <select value={fyFilter} onChange={e=>setFyFilter(e.target.value)}
          className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200"
          style={fyFilter!=='all'?{borderColor:T,boxShadow:`0 0 0 2px ${T}33`}:{}}>
          <option value="all">All FYs</option>
          {fyOptions.map(fy=><option key={fy} value={fy}>FY{String(fy).slice(2)}</option>)}
        </select>
        {/* Sales Channel filter */}
        <select value={channelFilter} onChange={e=>{setChannelFilter(e.target.value);setLeadCatFilter('all');}}
          className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200"
          style={channelFilter!=='all'?{borderColor:T,boxShadow:`0 0 0 2px ${T}33`}:{}}>
          <option value="all">All channels</option>
          <option value="Direct">Direct</option>
          <option value="Indirect">Indirect</option>
        </select>
        {/* Lead Category filter */}
        <select value={leadCatFilter} onChange={e=>setLeadCatFilter(e.target.value)}
          className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200"
          style={leadCatFilter!=='all'?{borderColor:T,boxShadow:`0 0 0 2px ${T}33`}:{}}>
          <option value="all">All categories</option>
          {channelFilter==='Indirect'
            ? <option value="Partner">Partner</option>
            : <>
                <option value="Event">Event</option>
                <option value="Inside Sales/Pre-Sales">Inside Sales / Pre-Sales</option>
                <option value="NA">NA</option>
                {channelFilter==='all' && <option value="Partner">Partner</option>}
              </>
          }
        </select>
      </div>

      {/* Row 3: Start date range */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-xs text-brand-faint whitespace-nowrap">Start date:</span>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
          className="text-sm border rounded-xl px-3 py-2 bg-white border-slate-200"/>
        <span className="text-xs text-brand-faint">to</span>
        <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
          className="text-sm border rounded-xl px-3 py-2 bg-white border-slate-200"/>
        {hasActiveFilters && (
          <button onClick={()=>{setDateFrom('');setDateTo('');setQtrFilter('all');setFyFilter('all');setChannelFilter('all');setLeadCatFilter('all');}}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-all">
            ✕ Clear filters
          </button>
        )}
        {(qtrFilter!=='all'||fyFilter!=='all') && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background:'#e0f7f5', color:'#00897b' }}>
            Signing date filter active
          </span>
        )}
      </div>

      {/* ── Summary stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl border px-4 py-3" style={{borderColor:'#e8edf3',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-faint mb-1">OFs shown</div>
          <div className="text-2xl font-black" style={{color:NAVY}}>{filtered.length}</div>
        </div>
        <div className="bg-white rounded-xl border px-4 py-3" style={{borderColor:'#e8edf3',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-faint mb-1">Committed Revenue · India (INR)</div>
          <div className="text-xl font-black" style={{color:T}}>
            ₹{Math.round(summaryINR).toLocaleString('en-IN')}
          </div>
        </div>
        <div className="bg-white rounded-xl border px-4 py-3" style={{borderColor:'#e8edf3',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-brand-faint mb-1">Committed Revenue · Global + AI/SaaS (USD)</div>
          <div className="text-xl font-black" style={{color:'#7c3aed'}}>
            ${Math.round(summaryUSD).toLocaleString('en-US')}
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
        <table className="text-sm" style={{ minWidth:'800px', width:'100%' }}>
          {tab==='of' ? (
            <>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {show('index')     && <th className={thCls}>#</th>}
                  {show('of_number') && <th className={thCls}>OF Number</th>}
                  {show('customer')  && <th className={thCls}>Customer</th>}
                  {show('services')  && <th className={thCls}>Services</th>}
                  {show('revenue')   && <th className={thCls}>Committed Revenue</th>}
                  {show('period')    && <th className={thCls}>Period</th>}
                  {show('quarter')   && <th className={thCls}>Quarter</th>}
                  {show('signed_date')&&<th className={thCls}>Signing Date</th>}
                  {show('active')    && <th className={thCls}>Active</th>}
                  {show('team')      && <th className={thCls}>Team</th>}
                  {show('rep')       && <th className={thCls}>Sales Rep</th>}
                  {show('sale_type') && <th className={thCls}>Sale Type</th>}
                  {show('segment')   && <th className={thCls}>Segment</th>}
                  {show('status')    && <th className={thCls}>Status</th>}
                  {user?.isUniversal && <th className={thCls}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {dedupedSorted.length===0 && (
                  <tr><td colSpan={visibleCols.length + (user?.isUniversal?1:0)}
                    className="text-center py-16 text-slate-300">No order forms found.</td></tr>
                )}
                {dedupedSorted.map((f,i) => {
                  const daysSinceSent = f.approved_at ? Math.floor((new Date()-new Date(f.approved_at))/86400000) : null;
                  const overdue = f.status==='approved' && !f.signed_date && daysSinceSent>=30;
                  const signingQtr = fmtQtr(f.signed_date);
                  return (
                    <tr key={f.id} onClick={()=>navigate(`/form/${f.id}`)}
                      className={`cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0 ${overdue?'bg-red-50':''}`}>
                      {show('index')     && <td className="px-4 py-3.5 text-xs text-slate-300">{i+1}</td>}
                      {show('of_number') && (
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-sm" style={{ color:f.of_number?NAVY:'#cbd5e1' }}>{f.of_number||'—'}</span>
                          {overdue && <div className="text-[10px] text-red-600 font-bold mt-0.5">{daysSinceSent}d unsigned</div>}
                        </td>
                      )}
                      {show('customer')  && (
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-sm" style={{ color:NAVY }}>{f.customer_name}</div>
                          <div className="text-xs text-brand-faint">{f.brand_name}</div>
                        </td>
                      )}
                      {show('services')  && (
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {(f.services_fees||[]).slice(0,2).map(s=>(
                              <span key={s.id} className="text-xs px-2 py-0.5 rounded-full bg-teal-light text-teal-dark font-medium">{s.name}</span>
                            ))}
                            {(f.services_fees||[]).length>2 && <span className="text-xs text-brand-faint">+{f.services_fees.length-2}</span>}
                          </div>
                        </td>
                      )}
                      {show('revenue')   && (
                        <td className="px-4 py-3.5">
                          <div className="text-xs font-semibold" style={{ color:NAVY }}>
                            {f.committed_currency||'INR'} {Number(f.committed_revenue||0).toLocaleString('en-IN')||'—'}
                          </div>
                          {f.arr_text && (
                            <div className="text-[10px] text-brand-faint mt-0.5 leading-tight"
                              style={{ maxWidth:'180px', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}
                              title={f.arr_text}>
                              {f.arr_text.split('\n')[0]}
                            </div>
                          )}
                          {f.signed_of_link && (
                            <a href={f.signed_of_link} target="_blank" rel="noreferrer"
                              onClick={e=>e.stopPropagation()}
                              className="text-[10px] font-medium hover:underline mt-0.5 block"
                              style={{ color:T }}>
                              📎 Signed PDF
                            </a>
                          )}
                        </td>
                      )}
                      {show('period')    && (
                        <td className="px-4 py-3.5 text-xs text-brand-muted whitespace-nowrap">
                          {fmtShort(f.start_date)} → {fmtShort(f.end_date)}
                        </td>
                      )}
                      {show('quarter')   && (
                        <td className="px-4 py-3.5">
                          {f.signed_date
                            ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 whitespace-nowrap">{signingQtr}</span>
                            : <span className="text-xs text-slate-300">—</span>
                          }
                        </td>
                      )}
                      {show('signed_date') && (
                        <td className="px-4 py-3.5 text-xs text-brand-muted whitespace-nowrap">
                          {f.signed_date ? <span className="text-green-600 font-medium">✍️ {fmtShort(f.signed_date)}</span> : <span className="text-slate-300">—</span>}
                        </td>
                      )}
                      {show('active')    && (
                        <td className="px-4 py-3.5">
                          {(() => {
                            const today = new Date(); today.setHours(0,0,0,0);
                            const start = f.start_date ? new Date(f.start_date) : null;
                            const end   = f.end_date   ? new Date(f.end_date)   : null;
                            const isActive = f.status==='signed' && start && end && today>=start && today<=end;
                            return isActive
                              ? <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-green-100 text-green-700">Active</span>
                              : <span className="text-xs text-slate-300">—</span>;
                          })()}
                        </td>
                      )}
                      {show('team')      && <td className="px-4 py-3.5 text-xs text-brand-muted">{f.sales_team||'—'}</td>}
                      {show('rep')       && <td className="px-4 py-3.5 text-xs text-brand-muted">{f.sales_rep_name}</td>}
                      {show('sale_type') && <td className="px-4 py-3.5 text-xs text-brand-muted">{f.sale_type||'—'}</td>}
                      {show('segment')   && <td className="px-4 py-3.5 text-xs text-brand-muted">{f.segment||'—'}</td>}
                      {show('status')    && <td className="px-4 py-3.5"><StatusPill status={f.status}/></td>}
                      {user?.isUniversal && (
                        <td className="px-4 py-3.5" onClick={e=>e.stopPropagation()}>
                          <button onClick={()=>setStatusModal(f)}
                            className="text-xs font-medium px-2 py-1 rounded-lg border border-slate-200 text-brand-muted hover:border-teal hover:text-teal transition-all whitespace-nowrap">
                            Change status
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['#','OF Number','Customer','Service','Fee summary','Period','Rep','Status'].map(h=>(
                    <th key={h} className={thCls}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {svcRows.length===0 && <tr><td colSpan={8} className="text-center py-16 text-slate-300">No rows.</td></tr>}
                {svcRows.map(({f,svc},i)=>(
                  <tr key={`${f.id}-${svc.id}`} onClick={()=>navigate(`/form/${f.id}`)}
                    className="cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3.5 text-xs text-slate-300">{i+1}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-sm" style={{ color:f.of_number?NAVY:'#cbd5e1' }}>{f.of_number||'—'}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-xs" style={{ color:NAVY }}>{f.customer_name}</div>
                      <div className="text-xs text-brand-faint">{f.brand_name}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-light text-teal-dark font-semibold">{svc.name||'—'}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {(svc.fees||[]).map((fee,fi)=>(
                        <div key={fi}>{fee.feeType}: {fee.commercialValue||'—'} {fee.billingCycle}</div>
                      ))}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-brand-muted whitespace-nowrap">{fmtShort(f.start_date)} → {fmtShort(f.end_date)}</td>
                    <td className="px-4 py-3.5 text-xs text-brand-muted">{f.sales_rep_name}</td>
                    <td className="px-4 py-3.5"><StatusPill status={f.status}/></td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
        </div>
      </Card>

      {statusModal && (
        <StatusChangeModal
          form={statusModal}
          onClose={()=>setStatusModal(null)}
          onSave={handleStatusSave}
        />
      )}
    </div>
  );
}
