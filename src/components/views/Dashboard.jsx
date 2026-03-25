import { useNavigate } from 'react-router-dom';
import { Card, StatusPill, Btn } from '../ui/index.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtShort, fmtDate, daysUntil } from '../../utils/dates.js';
import { fmtMoney } from '../../utils/formatting.js';

const NAVY='#1B2B4B'; const T='#00C3B5';

function StatCard({ label, value, color }) {
  return (
    <Card className="p-5">
      <div className="text-2xl font-black mb-0.5" style={{ color: color||NAVY }}>{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-faint">{label}</div>
    </Card>
  );
}

export default function Dashboard() {
  const { user }   = useAuth();
  const { forms }  = useForms();
  const navigate   = useNavigate();

  const isSales = user?.role === 'sales' && !user?.isUniversal;
  const visible = isSales ? forms.filter(f => f.sales_rep_email === user.email) : forms;

  const n = {
    total:    visible.length,
    revops:   visible.filter(f => f.status==='submitted').length,
    finance:  visible.filter(f => f.status==='revops_approved').length,
    approved: visible.filter(f => f.status==='approved').length,
    unsigned: visible.filter(f => f.status==='approved' && !f.signed_date).length,
    draft:    visible.filter(f => f.status==='draft').length,
  };
  const totalC = visible.filter(f=>['approved','signed'].includes(f.status))
    .reduce((s,f)=>s+Number(f.committed_revenue||0),0);

  // 30-day unsigned alert — approved OFs with no signing date for 30+ days
  const overdueUnsigned = visible.filter(f => {
    if (f.status !== 'approved' || f.signed_date) return false;
    const sentDate = f.submitted_at || f.approved_at;
    if (!sentDate) return false;
    const daysSince = Math.floor((new Date() - new Date(sentDate)) / 86400000);
    return daysSince >= 30;
  });

  // Renewing soon
  const renewing = visible.filter(f => {
    const d = daysUntil(f.end_date);
    return d !== null && d <= 30 && d > 0;
  });

  const queue = user?.role==='revops'
    ? visible.filter(f=>f.status==='submitted')
    : user?.role==='finance'
    ? visible.filter(f=>f.status==='revops_approved')
    : visible.filter(f=>['submitted','draft','revops_rejected'].includes(f.status));

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <h2 className="text-xl font-bold" style={{ color:NAVY }}>Dashboard</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard label="Total OFs"       value={n.total}/>
        <StatCard label="Pending RevOps"  value={n.revops}   color="#d97706"/>
        <StatCard label="Pending Finance" value={n.finance}  color="#2563eb"/>
        <StatCard label="Approved"        value={n.approved} color="#16a34a"/>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="p-5">
          <div className="text-xs font-bold uppercase tracking-widest mb-2 text-brand-faint">Committed revenue (approved + signed)</div>
          <div className="text-2xl font-black" style={{ color:T }}>₹{totalC.toLocaleString('en-IN')}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-bold uppercase tracking-widest mb-2 text-brand-faint">Unsigned OFs</div>
          <div className="text-2xl font-black text-amber-600">{n.unsigned}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs font-bold uppercase tracking-widest mb-2 text-brand-faint">Drafts in progress</div>
          <div className="text-2xl font-black text-slate-500">{n.draft}</div>
        </Card>
      </div>

      {/* 30-day unsigned overdue alert */}
      {overdueUnsigned.length > 0 && (
        <div className="mb-6 rounded-2xl overflow-hidden border border-red-200">
          <div className="px-6 py-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
            <span className="text-red-600 font-bold text-sm">🚨 Unsigned for 30+ days ({overdueUnsigned.length})</span>
            <span className="text-red-500 text-xs">— these OFs need immediate follow-up</span>
          </div>
          {overdueUnsigned.map(f => {
            const sentDate = f.submitted_at || f.approved_at;
            const daysSince = sentDate ? Math.floor((new Date() - new Date(sentDate)) / 86400000) : '?';
            return (
              <div key={f.id} onClick={() => navigate(`/form/${f.id}`)}
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-red-50 bg-white border-b border-red-100 last:border-0 transition-colors">
                <div>
                  <div className="font-semibold text-sm" style={{ color:NAVY }}>{f.customer_name}
                    <span className="text-slate-300 mx-2">·</span>
                    <span className="font-normal text-slate-500">{f.of_number}</span>
                  </div>
                  <div className="text-xs mt-0.5 text-brand-faint">
                    {(f.services_fees||[]).map(s=>s.name).filter(Boolean).join(', ')||'—'} · {f.sales_rep_name}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">{daysSince} days unsigned</span>
                  <span className="text-slate-300">›</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Renewal warnings */}
      {renewing.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
            <h3 className="font-bold text-sm text-amber-800">🔔 Renewing / expiring within 30 days ({renewing.length})</h3>
          </div>
          {renewing.map(f => (
            <div key={f.id} onClick={() => navigate(`/form/${f.id}`)}
              className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
              <span className="text-sm font-medium" style={{ color:NAVY }}>{f.customer_name}
                <span className="text-slate-300 mx-2">·</span>
                <span className="font-normal text-slate-500 text-xs">{f.of_number}</span>
              </span>
              <span className="text-xs text-amber-600 font-bold">{daysUntil(f.end_date)}d remaining · {f.end_date}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Queue */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-50">
          <h3 className="font-bold text-sm text-slate-500">
            {user?.role==='revops'  ? '⏳ Pending your review'
            :user?.role==='finance' ? '💼 Pending your approval'
            :'📋 My active forms'}
            <span className="ml-2 font-normal text-brand-faint">({queue.length})</span>
          </h3>
        </div>
        {queue.length === 0
          ? <div className="py-14 text-center text-sm text-slate-300">Queue is clear 🎉</div>
          : queue.map(f => (
            <div key={f.id} onClick={() => navigate(`/form/${f.id}`)}
              className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
              <div>
                <div className="font-semibold text-sm" style={{ color:NAVY }}>
                  {f.customer_name} <span className="text-slate-300">·</span>{' '}
                  <span className="font-normal text-slate-500">{f.brand_name}</span>
                </div>
                <div className="text-xs mt-0.5 text-brand-faint">
                  {(f.services_fees||[]).map(s=>s.name).filter(Boolean).join(', ')||'—'} · {f.committed_currency||'INR'} {Number(f.committed_revenue||0).toLocaleString('en-IN')||'—'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={f.status}/>
                <span className="text-slate-300">›</span>
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  );
}
