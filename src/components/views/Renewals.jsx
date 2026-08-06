import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { TEAM_FILTERS, matchesTeamFilter } from '../../constants/users.js';
import { daysUntil } from '../../utils/dates.js';

const NAVY = '#1B2B4B';

export default function Renewals() {
  const { forms } = useForms();
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [teamFilter, setTeamFilter] = useState('all');

  // Visible to everyone — no per-user restriction; region filter only.
  const visible = useMemo(() =>
    forms.filter(f => matchesTeamFilter(f, teamFilter)),
  [forms, teamFilter]);

  // De-duplicate by OF number (keep the furthest-along document) — same rule as the Dashboard.
  const uniq = useMemo(() => {
    const rank = s => ({ churn:9, void:9, dropped:9, completed:6, signed:5, approved:4, revops_approved:3, submitted:2, draft:1, revops_rejected:1 }[s] || 0);
    const seen = new Map(); const noNum = [];
    visible.forEach(f => {
      if (!f.of_number) { noNum.push(f); return; }
      const ex = seen.get(f.of_number);
      if (!ex) { seen.set(f.of_number, f); return; }
      const better = rank(f.status) > rank(ex.status) ||
        (rank(f.status) === rank(ex.status) && (f.created_at||'') > (ex.created_at||''));
      if (better) seen.set(f.of_number, f);
    });
    return [...seen.values(), ...noNum];
  }, [visible]);

  // Active signed contracts ending within 30 days, split by whether they auto-renew.
  const upcoming = useMemo(() =>
    uniq
      .filter(f => {
        if (f.status !== 'signed') return false;   // only active signed contracts renew/expire
        const d = daysUntil(f.end_date);
        return d !== null && d <= 30 && d > 0;
      })
      .sort((a, b) => daysUntil(a.end_date) - daysUntil(b.end_date)),
  [uniq]);

  const dueForRenewal = useMemo(() => upcoming.filter(f => f.auto_renewal === 'Yes'),  [upcoming]);
  const expiring      = useMemo(() => upcoming.filter(f => f.auto_renewal !== 'Yes'),  [upcoming]);

  const renderRows = (items, accent) => items.map(f => (
    <div key={f.id}
      onClick={() => navigate('/form/' + f.id)}
      className="flex items-center justify-between px-6 py-3.5 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors">
      <div>
        <span className="text-sm font-medium" style={{ color: NAVY }}>{f.customer_name}</span>
        {f.of_number && <span className="ml-2 text-xs font-mono text-slate-400">{f.of_number}</span>}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold" style={{ color: accent }}>{daysUntil(f.end_date)}d remaining · {f.end_date}</span>
        <span className="text-slate-300">›</span>
      </div>
    </div>
  ));

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: NAVY }}>Renewals</h2>
          <p className="text-sm text-slate-400 mt-0.5">Signed contracts due for renewal or expiring within the next 30 days</p>
        </div>
        <button onClick={() => navigate('/repository')}
          className="text-xs text-teal-600 font-medium hover:text-teal-700 whitespace-nowrap">
          View all in Repository →
        </button>
      </div>

      {/* Region filter — same as Dashboard */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {TEAM_FILTERS.map(t => (
          <button key={t.id} onClick={() => setTeamFilter(t.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
            style={teamFilter === t.id
              ? { background: NAVY, color: '#fff', borderColor: NAVY }
              : { background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }}>
            {t.lbl}
          </button>
        ))}
      </div>

      {/* Due for renewal (auto-renew = Yes) */}
      <div className="rounded-2xl border overflow-hidden mb-6" style={{ borderColor: '#e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div className="px-6 py-3 bg-teal-50 border-b border-teal-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-teal-800">🔄 Due for renewal within 30 days ({dueForRenewal.length})</h3>
          <span className="text-[11px] text-teal-600 font-medium">Auto-renew: Yes</span>
        </div>
        {dueForRenewal.length === 0
          ? <div className="py-12 text-center text-sm text-slate-300">No contracts due for renewal in the next 30 days</div>
          : renderRows(dueForRenewal, '#0d9488')}
      </div>

      {/* Expiring / completing (auto-renew = No / unset) */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#e8edf3', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
          <h3 className="font-bold text-sm text-amber-800">⌛ Expiring / completing within 30 days ({expiring.length})</h3>
          <span className="text-[11px] text-amber-600 font-medium">Auto-renew: No</span>
        </div>
        {expiring.length === 0
          ? <div className="py-12 text-center text-sm text-slate-300">Nothing expiring or completing in the next 30 days 🎉</div>
          : renderRows(expiring, '#d97706')}
      </div>
    </div>
  );
}
