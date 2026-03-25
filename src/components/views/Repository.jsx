import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, StatusPill, Btn, Lbl } from '../ui/index.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { STATUS } from '../../constants/status.js';
import { SALES_TEAMS } from '../../constants/formOptions.js';
import { SALES_REPS } from '../../constants/users.js';
import { fmtShort } from '../../utils/dates.js';
import { exportOFIndex, exportServiceIndex } from '../../utils/csv.js';

const NAVY='#1B2B4B'; const T='#00C3B5';

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
  const [q,          setQ]          = useState('');
  const [st,         setSt]         = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [repFilter,  setRepFilter]  = useState('all');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [tab,        setTab]        = useState('of');
  const [statusModal,setStatusModal]= useState(null);

  const isSales = user?.role === 'sales' && !user?.isUniversal;
  const sortedReps = [...SALES_REPS].sort((a,b)=>a.name.localeCompare(b.name));

  const filtered = forms.filter(f => {
    if (isSales && f.sales_rep_email !== user.email) return false;
    const m  = !q || [f.customer_name,f.of_number,f.sales_rep_name,f.brand_name]
                  .some(v => v?.toLowerCase().includes(q.toLowerCase()));
    const s  = st==='all'         || f.status===st;
    const t  = teamFilter==='all' || f.sales_team===teamFilter;
    const r  = repFilter==='all'  || f.sales_rep_email===repFilter;
    const df = !dateFrom || (f.start_date && f.start_date >= dateFrom);
    const dt = !dateTo   || (f.start_date && f.start_date <= dateTo);
    return m && s && t && r && df && dt;
  });

  const svcRows = [];
  filtered.forEach(f => (f.services_fees||[]).forEach(svc => svcRows.push({f,svc})));

  const thCls = "text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-brand-faint";

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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color:NAVY }}>Repository</h2>
          <p className="text-sm mt-0.5 text-brand-faint">
            {filtered.filter(f=>['approved','signed'].includes(f.status)).length} active · {filtered.length} OFs shown
          </p>
        </div>
        <Btn variant="ghost" onClick={() => tab==='of' ? exportOFIndex(filtered) : exportServiceIndex(filtered)}>
          ⬇ Export CSV
        </Btn>
      </div>

      <div className="flex gap-2 mb-4">
        {[{id:'of',lbl:'📁 Index (per OF)'},{id:'service',lbl:'📋 Service index'}].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            className="px-4 py-2 text-sm font-semibold rounded-xl border transition-all"
            style={tab===t.id?{background:NAVY,color:'#fff',borderColor:NAVY}:{background:'#f8fafc',color:'#64748b',borderColor:'#e2e8f0'}}>
            {t.lbl}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Search customer, OF#, rep…"
          className="text-sm border rounded-xl px-4 py-2.5 focus:outline-none border-slate-200"/>
        <select value={st} onChange={e=>setSt(e.target.value)}
          className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200">
          <option value="all">All status</option>
          {Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
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
        <div className="flex items-center gap-2 col-span-2">
          <span className="text-xs text-brand-faint whitespace-nowrap">Start date:</span>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            className="flex-1 text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200"/>
          <span className="text-xs text-brand-faint">to</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            className="flex-1 text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200"/>
          {(dateFrom||dateTo) && (
            <button onClick={()=>{setDateFrom('');setDateTo('');}} className="text-xs text-red-500 font-medium">✕</button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          {tab==='of' ? (
            <>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['#','OF Number','Customer','Services','Committed Revenue','Period','Rep','Status',
                    ...(user?.isUniversal?['Actions']:[])
                  ].map(h=><th key={h} className={thCls}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0 && <tr><td colSpan={9} className="text-center py-16 text-slate-300">No order forms found.</td></tr>}
                {filtered.map((f,i) => {
                  const daysSinceSent = f.approved_at ? Math.floor((new Date()-new Date(f.approved_at))/86400000) : null;
                  const overdue = f.status==='approved' && !f.signed_date && daysSinceSent>=30;
                  return (
                    <tr key={f.id} onClick={()=>navigate(`/form/${f.id}`)}
                      className={`cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0 ${overdue?'bg-red-50':''}`}>
                      <td className="px-4 py-3.5 text-xs text-slate-300">{i+1}</td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-sm" style={{ color:f.of_number?NAVY:'#cbd5e1' }}>{f.of_number||'—'}</span>
                        {overdue && <div className="text-[10px] text-red-600 font-bold mt-0.5">{daysSinceSent}d unsigned</div>}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-sm" style={{ color:NAVY }}>{f.customer_name}</div>
                        <div className="text-xs text-brand-faint">{f.brand_name}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {(f.services_fees||[]).slice(0,2).map(s=>(
                            <span key={s.id} className="text-xs px-2 py-0.5 rounded-full bg-teal-light text-teal-dark font-medium">{s.name}</span>
                          ))}
                          {(f.services_fees||[]).length>2 && <span className="text-xs text-brand-faint">+{f.services_fees.length-2}</span>}
                        </div>
                      </td>
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
                      <td className="px-4 py-3.5 text-xs text-brand-muted">
                        {fmtShort(f.start_date)} → {fmtShort(f.end_date)}
                        {f.signed_date && <div className="text-[10px] text-green-600 mt-0.5">✍️ {fmtShort(f.signed_date)}</div>}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-brand-muted">{f.sales_rep_name}</td>
                      <td className="px-4 py-3.5"><StatusPill status={f.status}/></td>
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
                    <td className="px-4 py-3.5 font-mono font-bold text-sm" style={{ color:f.of_number?NAVY:'#cbd5e1' }}>{f.of_number||'—'}</td>
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
                    <td className="px-4 py-3.5 text-xs text-brand-muted">{fmtShort(f.start_date)} → {fmtShort(f.end_date)}</td>
                    <td className="px-4 py-3.5 text-xs text-brand-muted">{f.sales_rep_name}</td>
                    <td className="px-4 py-3.5"><StatusPill status={f.status}/></td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
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
