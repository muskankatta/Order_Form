import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { Card } from '../ui/index.jsx';

const NAVY = '#1B2B4B';
const T    = '#00C3B5';

function extractEvents(form) {
  const events = [];
  const push = (action, actor, timestamp, comment, meta) => {
    if (!timestamp) return;
    events.push({
      formId: form.id, ofNumber: form.of_number || '—',
      customerName: form.customer_name || '—', brandName: form.brand_name || '',
      salesRep: form.sales_rep_name || '—',
      action, actor: actor || '—', timestamp, comment: comment || '', meta: meta || '',
    });
  };
  push('Draft created',        form.sales_rep_name,    form.created_at,        '', '');
  push('Submitted for review', form.sales_rep_name,    form.submitted_at,      '', (form.revops_approvers||[]).join(', '));
  if (form.revops_reviewed_at) {
    const rejected = form.status === 'revops_rejected';
    push(
      rejected ? 'RevOps rejected' : 'RevOps approved',
      form.revops_reviewer, form.revops_reviewed_at,
      form.revops_comment,
      rejected ? '' : (form.finance_approvers||[]).join(', ')
    );
  }
  push('Finance approved',    form.finance_approver,  form.approved_at,       form.finance_comment, form.of_number ? 'OF# ' + form.of_number : '');
  push('Marked as signed',    form.signed_by,         form.signed_at,         '', form.signed_date ? 'Signing date: ' + form.signed_date : '');
  push('Marked as completed', '',                     form.completed_at,      '', '');
  push('Status changed',      form.status_changed_by, form.status_changed_at, form.status_change_comment, form.status ? '\u2192 ' + form.status : '');
  return events;
}

const ACTION_STYLE = {
  'Draft created':         { bg:'#f1f5f9', text:'#475569', dot:'#94a3b8' },
  'Submitted for review':  { bg:'#fffbeb', text:'#b45309', dot:'#f59e0b' },
  'RevOps approved':       { bg:'#eff6ff', text:'#1d4ed8', dot:'#3b82f6' },
  'RevOps rejected':       { bg:'#fef2f2', text:'#b91c1c', dot:'#ef4444' },
  'Finance approved':      { bg:'#f0fdf4', text:'#15803d', dot:'#22c55e' },
  'Marked as signed':      { bg:'#f0fdfa', text:'#0f766e', dot:T },
  'Marked as completed':   { bg:'#f5f3ff', text:'#6d28d9', dot:'#8b5cf6' },
  'Status changed':        { bg:'#fff7ed', text:'#c2410c', dot:'#f97316' },
};

function ActionBadge({ action }) {
  const s = ACTION_STYLE[action] || { bg:'#f1f5f9', text:'#475569', dot:'#94a3b8' };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background:s.bg, color:s.text }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background:s.dot }}/>
      {action}
    </span>
  );
}

function fmtDT(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day:'2-digit', month:'short', year:'numeric',
      hour:'2-digit', minute:'2-digit', hour12:true,
    });
  } catch { return ts; }
}

export default function AuditLog() {
  const { user }  = useAuth();
  const { forms } = useForms();
  const navigate  = useNavigate();
  const [q,            setQ]            = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [sortOrder,    setSortOrder]    = useState('desc');

  if (!user?.isUniversal) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="text-4xl">🔒</div>
        <p className="text-brand-muted">Access restricted to Universal admin only.</p>
      </div>
    );
  }

  const allEvents = useMemo(() => forms.flatMap(extractEvents), [forms]);

  const filtered = useMemo(() => allEvents
    .filter(e => {
      const mq = !q || [e.customerName, e.ofNumber, e.actor, e.salesRep, e.brandName]
        .some(v => v?.toLowerCase().includes(q.toLowerCase()));
      const ma = actionFilter === 'all' || e.action === actionFilter;
      return mq && ma;
    })
    .sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? tb - ta : ta - tb;
    }),
  [allEvents, q, actionFilter, sortOrder]);

  const thCls = "text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-brand-faint whitespace-nowrap";

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color:NAVY }}>Audit Log</h2>
          <p className="text-sm mt-0.5 text-brand-faint">
            {filtered.length} event{filtered.length !== 1 ? 's' : ''} across all Order Forms
          </p>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-red-50 text-red-700">🔒 Universal only</span>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="🔍 Search customer, OF#, actor…"
          className="text-sm border rounded-xl px-4 py-2.5 focus:outline-none border-slate-200"/>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200">
          <option value="all">All actions</option>
          {Object.keys(ACTION_STYLE).map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={sortOrder} onChange={e => setSortOrder(e.target.value)}
          className="text-sm border rounded-xl px-3 py-2.5 bg-white border-slate-200">
          <option value="desc">↓ Newest first</option>
          <option value="asc">↑ Oldest first</option>
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm w-full" style={{ minWidth:'1000px' }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className={thCls}>#</th>
                <th className={thCls}>Date &amp; Time</th>
                <th className={thCls}>Action</th>
                <th className={thCls}>Actor</th>
                <th className={thCls}>Customer</th>
                <th className={thCls}>OF Number</th>
                <th className={thCls}>Sales Rep</th>
                <th className={thCls}>Comment / Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-16 text-slate-300">No audit events found.</td></tr>
              )}
              {filtered.map((e, i) => (
                <tr key={e.formId + e.action + e.timestamp}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate('/form/' + e.formId)}>
                  <td className="px-4 py-3 text-xs text-slate-300">{i+1}</td>
                  <td className="px-4 py-3 text-xs text-brand-muted whitespace-nowrap">{fmtDT(e.timestamp)}</td>
                  <td className="px-4 py-3"><ActionBadge action={e.action}/></td>
                  <td className="px-4 py-3 text-xs font-semibold whitespace-nowrap" style={{ color:NAVY }}>{e.actor}</td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold" style={{ color:NAVY }}>{e.customerName}</div>
                    {e.brandName && e.brandName !== e.customerName &&
                      <div className="text-[10px] text-brand-faint">{e.brandName}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-bold whitespace-nowrap"
                    style={{ color: e.ofNumber !== '—' ? NAVY : '#cbd5e1' }}>{e.ofNumber}</td>
                  <td className="px-4 py-3 text-xs text-brand-muted">{e.salesRep}</td>
                  <td className="px-4 py-3 text-xs" style={{ maxWidth:'240px' }}>
                    {e.comment && <div className="truncate text-slate-600 font-medium" title={e.comment}>"{e.comment}"</div>}
                    {e.meta && <div className="text-[10px] text-slate-400 mt-0.5">{e.meta}</div>}
                    {!e.comment && !e.meta && <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-brand-faint mt-3">Clicking any row opens the corresponding Order Form.</p>
    </div>
  );
}
