import { useNavigate } from 'react-router-dom';
import { Card, StatusPill, Btn } from '../ui/index.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtShort, daysUntil } from '../../utils/dates.js';

const NAVY='#1B2B4B'; const T='#00C3B5';

function StatCard({ label, value, color, onClick, sub }) {
  return (
    <Card
      className={'p-5 transition-all ' + (onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : '')}
      onClick={onClick}
    >
      <div className="text-2xl font-black mb-0.5" style={{ color: color||NAVY }}>{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-faint">{label}</div>
      {sub && <div className="text-[10px] mt-1 text-brand-faint">{sub}</div>}
      {onClick && <div className="text-[10px] mt-1.5 font-medium" style={{ color: color||T }}>View →</div>}
    </Card>
  );
}

function BigStatCard({ label, value, color, onClick }) {
  return (
    <Card
      className={'p-5 transition-all ' + (onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : '')}
      onClick={onClick}
    >
      <div className="text-xs font-bold uppercase tracking-widest mb-2 text-brand-faint">{label}</div>
      <div className="text-2xl font-black" style={{ color: color||NAVY }}>{value}</div>
      {onClick && <div className="text-[10px] mt-1.5 font-medium" style={{ color: color||T }}>View →</div>}
    </Card>
  );
}

export default function Dashboard() {
  const { user }   = useAuth();
  const { forms }  = useForms();
  const navigate   = useNavigate();

  const isSales = user?.role === 'sales' && !user?.isUniversal;
  const visible = isSales ? forms.filter(f => f.sales_rep_email === user.email) : forms;

  const today = new Date(); today.setHours(0,0,0,0);
  const isActive = f => {
    const s = f.start_date ? new Date(f.start_date) : null;
    const e = f.end_date   ? new Date(f.end_date)   : null;
    return f.status==='signed' && s && e && today>=s && today<=e;
  };

  const n = {
    total:     visible.length,
    revops:    visible.filter(f => f.status==='submitted').length,
    finance:   visible.filter(f => f.status==='revops_approved').length,
    approved:  visible.filter(f => f.status==='approved').length,
    unsigned:  visible.filter(f => f.status==='approved' && !f.signed_date).length,
    draft:     visible.filter(f => f.status==='draft' && !f.is_renewal).length,
    active:    visible.filter(isActive).length,
    completed: visible.filter(f => f.status==='completed').length,
    renewals:  visible.filter(f => f.is_renewal && f.status==='draft').length,
  };

  const totalSigned = visible
    .filter(f => f.status==='signed')
    .reduce((s,f) => s+Number(f.committed_revenue||0), 0);

  const queue = user?.role==='revops'
    ? visible.filter(f=>f.status==='submitted')
    : user?.role==='finance'
    ? visible.filter(f=>f.status==='revops_approved')
    : visible.filter(f=>['submitted','draft','revops_rejected'].includes(f.status));

  const renewing = visible.filter(f => {
    const d = daysUntil(f.end_date);
    return d !== null && d <= 30 && d > 0;
  });

  // Navigation helpers
  const goRepo   = (status) => navigate(`/repository${status ? '?status='+status : ''}`);
  const goPending = (section) => navigate(`/pending${section ? '?section='+section : ''}`);
  const goSigned  = (tab) => navigate(`/signed${tab ? '?tab='+tab : ''}`);

  return (
    <div>
      <div className="flex items-center justify-between mb-7">
        <h2 className="text-xl font-bold" style={{ color:NAVY }}>Dashboard</h2>
        {(user?.role==='sales'||user?.isUniversal) && (
          <Btn onClick={() => navigate('/form/new')}>+ New Order Form</Btn>
        )}
      </div>

      {/* Row 1 — workflow stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard label="Total OFs"       value={n.total}    onClick={() => goRepo()}/>
        <StatCard label="Pending RevOps"  value={n.revops}   color="#d97706"
          onClick={() => goPending('revops')}/>
        <StatCard label="Pending Finance" value={n.finance}  color="#2563eb"
          onClick={() => goPending('finance')}/>
        <StatCard label="Approved"        value={n.approved} color="#16a34a"
          onClick={() => goRepo('approved')}/>
      </div>

      {/* Row 2 — revenue + contract health */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <BigStatCard
          label="Committed revenue (signed)"
          value={'₹' + totalSigned.toLocaleString('en-IN')}
          color={T}
          onClick={() => goRepo('signed')}/>
        <BigStatCard
          label="Active contracts"
          value={n.active}
          color="#16a34a"
          onClick={() => goRepo('signed')}/>
        <BigStatCard
          label="Completed contracts"
          value={n.completed}
          color="#7c3aed"
          onClick={() => goRepo('completed')}/>
      </div>

      {/* Row 3 — actions needed */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Unsigned OFs"      value={n.unsigned}  color="#ef4444"
          onClick={() => goSigned('unsigned')}/>
        <StatCard label="Drafts in progress" value={n.draft}    color="#64748b"
          onClick={() => goPending('drafts')}/>
        <StatCard label="Renewal drafts"    value={n.renewals}  color="#7c3aed"
          onClick={() => goPending('renewals')}/>
      </div>

      {/* Renewal drafts banner */}
      {n.renewals > 0 && (
        <Card className="mb-6 overflow-hidden cursor-pointer hover:shadow-md transition-all"
          onClick={() => goPending('renewals')}>
          <div className="px-6 py-3 bg-purple-50 border-b border-purple-200">
            <h3 className="font-bold text-sm text-purple-800">
              🔄 Renewal drafts ready for review ({n.renewals}) — click to view →
            </h3>
          </div>
          {visible.filter(f=>f.is_renewal&&f.status==='draft').map(f => (
            <div key={f.id} onClick={e=>{e.stopPropagation();navigate(`/form/${f.id}`);}}
              className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
              <div>
                <span className="text-sm font-medium" style={{ color:NAVY }}>{f.customer_name}</span>
                <span className="text-xs text-purple-600 ml-2 font-semibold">
                  Renewal of {f.renewal_of_number} · Suggested: {f.suggested_of_number}
                </span>
              </div>
              <span className="text-xs text-brand-faint">{f.start_date} → {f.end_date}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Renewing within 30 days */}
      {renewing.length > 0 && (
        <Card className="mb-6 overflow-hidden cursor-pointer hover:shadow-md transition-all"
          onClick={() => goRepo()}>
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
            <h3 className="font-bold text-sm text-amber-800">
              🔔 Renewing / expiring within 30 days ({renewing.length}) — click to view in Repository →
            </h3>
          </div>
          {renewing.map(f => (
            <div key={f.id} onClick={e=>{e.stopPropagation();navigate(`/form/${f.id}`);}}
              className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
              <span className="text-sm font-medium" style={{ color:NAVY }}>{f.customer_name}</span>
              <span className="text-xs text-amber-600 font-bold">{daysUntil(f.end_date)}d remaining · {f.end_date}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Queue */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-50">
          <h3 className="font-bold text-sm text-slate-500">
            {user?.role==='revops' ? '⏳ Pending your review'
            :user?.role==='finance'? '💼 Pending your approval'
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
                  {(f.services_fees||[]).map(s=>s.name).filter(Boolean).join(', ')||'—'} · {f.committed_currency||'INR'} {f.committed_revenue||'—'}
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
