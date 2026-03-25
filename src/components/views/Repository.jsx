import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, StatusPill, Btn } from '../ui/index.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { STATUS } from '../../constants/status.js';
import { SALES_TEAMS } from '../../constants/formOptions.js';
import { fmtShort } from '../../utils/dates.js';
import { fmtMoney } from '../../utils/formatting.js';
import { exportOFIndex, exportServiceIndex } from '../../utils/csv.js';

const NAVY='#1B2B4B'; const T='#00C3B5';

export default function Repository() {
  const { user }  = useAuth();
  const { forms } = useForms();
  const navigate  = useNavigate();
  const [q,  setQ]  = useState('');
  const [st, setSt] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [tab, setTab] = useState('of');

  const isSales = user?.role === 'sales' && !user?.isUniversal;

  const filtered = forms.filter(f => {
    if (isSales && f.sales_rep_email !== user.email) return false;
    const m = !q || [f.customer_name,f.of_number,f.sales_rep_name,f.brand_name]
      .some(v => v?.toLowerCase().includes(q.toLowerCase()));
    const s = st==='all' || f.status===st;
    const t = teamFilter==='all' || f.sales_team===teamFilter;
    return m && s && t;
  });

  const svcRows = [];
  filtered.forEach(f => (f.services_fees||[]).forEach(svc => svcRows.push({f,svc})));

  const thClass = "text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-brand-faint";
  const tdClass = "px-4 py-3.5";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color:NAVY }}>Repository</h2>
          <p className="text-sm mt-0.5 text-brand-faint">
            {filtered.filter(f=>f.status==='approved').length} approved · {filtered.length} OFs
          </p>
        </div>
        <Btn variant="ghost" onClick={() => tab==='of' ? exportOFIndex(filtered) : exportServiceIndex(filtered)}>
          ⬇ Export CSV
        </Btn>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[{id:'of',lbl:'📁 Index (per OF)'},{id:'service',lbl:'📋 Service index'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-4 py-2 text-sm font-semibold rounded-xl border transition-all"
            style={tab===t.id ? {background:NAVY,color:'#fff',borderColor:NAVY} : {background:'#f8fafc',color:'#64748b',borderColor:'#e2e8f0'}}>
            {t.lbl}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Search customer, OF#, rep…"
          className="flex-1 min-w-48 text-sm border rounded-xl px-4 py-2.5 focus:outline-none border-slate-200"/>
        <select value={st} onChange={e=>setSt(e.target.value)}
          className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200">
          <option value="all">All status</option>
          {Object.entries(STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {!isSales && (
          <select value={teamFilter} onChange={e=>setTeamFilter(e.target.value)}
            className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200">
            <option value="all">All teams</option>
            {SALES_TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          {tab === 'of' ? (
            <>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['#','OF Number','Customer','Services','Committed','Period','Rep','Status'].map(h => (
                    <th key={h} className={thClass}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-16 text-slate-300">No order forms found.</td></tr>
                )}
                {filtered.map((f,i) => (
                  <tr key={f.id} onClick={() => navigate(`/form/${f.id}`)}
                    className="cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
                    <td className={`${tdClass} text-xs text-slate-300`}>{i+1}</td>
                    <td className={`${tdClass} font-mono font-bold text-sm`} style={{ color:f.of_number?NAVY:'#cbd5e1' }}>{f.of_number||'—'}</td>
                    <td className={tdClass}>
                      <div className="font-semibold text-sm" style={{ color:NAVY }}>{f.customer_name}</div>
                      <div className="text-xs text-brand-faint">{f.brand_name}</div>
                    </td>
                    <td className={tdClass}>
                      <div className="flex flex-wrap gap-1">
                        {(f.services_fees||[]).slice(0,2).map(s => (
                          <span key={s.id} className="text-xs px-2 py-0.5 rounded-full bg-teal-light text-teal-dark font-medium">{s.name}</span>
                        ))}
                        {(f.services_fees||[]).length>2 && <span className="text-xs text-brand-faint">+{f.services_fees.length-2}</span>}
                      </div>
                    </td>
                    <td className={`${tdClass} text-xs font-semibold`} style={{ color:NAVY }}>{fmtMoney(f.committed_revenue,f.committed_currency)}</td>
                    <td className={`${tdClass} text-xs text-brand-muted`}>{fmtShort(f.start_date)} → {fmtShort(f.end_date)}</td>
                    <td className={`${tdClass} text-xs text-brand-muted`}>{f.sales_rep_name}</td>
                    <td className={tdClass}><StatusPill status={f.status}/></td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            <>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['#','OF Number','Customer','Service','Fee summary','Period','Rep','Status'].map(h => (
                    <th key={h} className={thClass}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {svcRows.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-16 text-slate-300">No rows.</td></tr>
                )}
                {svcRows.map(({f,svc},i) => (
                  <tr key={`${f.id}-${svc.id}`} onClick={() => navigate(`/form/${f.id}`)}
                    className="cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
                    <td className={`${tdClass} text-xs text-slate-300`}>{i+1}</td>
                    <td className={`${tdClass} font-mono font-bold text-sm`} style={{ color:f.of_number?NAVY:'#cbd5e1' }}>{f.of_number||'—'}</td>
                    <td className={tdClass}>
                      <div className="font-semibold text-xs" style={{ color:NAVY }}>{f.customer_name}</div>
                      <div className="text-xs text-brand-faint">{f.brand_name}</div>
                    </td>
                    <td className={tdClass}>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-teal-light text-teal-dark font-semibold">{svc.name||'—'}</span>
                    </td>
                    <td className={`${tdClass} text-xs text-slate-500`}>
                      {(svc.fees||[]).map((fee,fi) => <div key={fi}>{fee.feeType}: {fee.commercialValue||'—'} {fee.billingCycle}</div>)}
                    </td>
                    <td className={`${tdClass} text-xs text-brand-muted`}>{fmtShort(f.start_date)} → {fmtShort(f.end_date)}</td>
                    <td className={`${tdClass} text-xs text-brand-muted`}>{f.sales_rep_name}</td>
                    <td className={tdClass}><StatusPill status={f.status}/></td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </Card>
    </div>
  );
}
