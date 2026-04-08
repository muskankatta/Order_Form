import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { SALES_REPS } from '../../constants/users.js';
import { Card } from '../ui/index.jsx';

const NAVY = '#1B2B4B';
const T    = '#00C3B5';

// Exchange rates: everything → USD
const TO_USD = {
  USD: v => v,
  INR: v => v / 91,
  AED: v => v / 3.6725,
  MYR: v => v / 4.30,
  IDR: v => v / 16950,
  GBP: v => v / 0.80,
  EUR: v => v / 0.90,
  SGD: v => v / 1.35,
  SAR: v => v / 3.75,
  AUD: v => v / 1.55,
};

function toUSD(amount, currency) {
  const fn = TO_USD[currency] || (v => v);
  return fn(amount);
}

function toTargetCurrency(amountUSD, targetCurrency) {
  if (targetCurrency === 'INR') return amountUSD * 91;
  return amountUSD; // USD
}

function convertRevenue(amount, fromCurrency, targetCurrency) {
  const usd = toUSD(amount, fromCurrency);
  return toTargetCurrency(usd, targetCurrency);
}

// FY helpers
function getFYLabel(fy) { return 'FY' + String(fy).slice(2); }

function getCurrentFY() {
  const now = new Date();
  const m   = now.getMonth() + 1;
  const y   = now.getFullYear();
  return m >= 4 ? y + 1 : y;
}

function getFYRange(fy) {
  // FY27 = Apr 1 2026 – Mar 31 2027
  const startYear = fy - 1;
  return {
    start: new Date(startYear, 3, 1),  // Apr 1
    end:   new Date(fy, 2, 31, 23, 59, 59), // Mar 31
  };
}

function formatAmount(amount, currency) {
  if (currency === 'INR') {
    if (amount >= 10000000) return '₹' + (amount / 10000000).toFixed(2) + ' Cr';
    if (amount >= 100000)   return '₹' + (amount / 100000).toFixed(2) + ' L';
    return '₹' + Math.round(amount).toLocaleString('en-IN');
  }
  // USD
  if (amount >= 1000000) return '$' + (amount / 1000000).toFixed(2) + 'M';
  if (amount >= 1000)    return '$' + (amount / 1000).toFixed(1) + 'K';
  return '$' + Math.round(amount).toLocaleString('en-US');
}

function ProgressBar({ pct }) {
  const clamped = Math.min(pct, 100);
  const color = pct >= 100 ? '#22c55e' : pct >= 75 ? T : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: clamped + '%', background: color }}/>
      </div>
      <span className="text-xs font-bold w-12 text-right" style={{ color }}>
        {pct >= 1000 ? '999%+' : pct.toFixed(1) + '%'}
      </span>
    </div>
  );
}

function StatusBadge({ pct }) {
  if (pct >= 100) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Achieved</span>;
  if (pct >= 75)  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">On track</span>;
  if (pct >= 50)  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">At risk</span>;
  return               <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Behind</span>;
}

const ROLE_COLOR = {
  'Sales':           { bg:'#eff6ff', text:'#1d4ed8' },
  'Inside Sales':    { bg:'#f0fdf4', text:'#15803d' },
  'BDR':             { bg:'#fdf4ff', text:'#7e22ce' },
  'CBO':             { bg:'#fff7ed', text:'#c2410c' },
  'Customer Success':{ bg:'#f0fdfa', text:'#0f766e' },
};

export default function SalesTargets() {
  const { user }  = useAuth();
  const { forms } = useForms();
  const currentFY = getCurrentFY();
  const [fy, setFY] = useState(currentFY);
  const [teamFilter, setTeamFilter] = useState('all');

  const isSales = user?.role === 'sales' && !user?.isUniversal;

  // Reps with targets only
  const repsWithTargets = useMemo(() =>
    SALES_REPS.filter(r => r.target !== null && r.target !== undefined),
  []);

  // Signed OFs in selected FY
  const { start, end } = getFYRange(fy);
  const signedInFY = useMemo(() =>
    forms.filter(f => {
      if (f.status !== 'signed' || !f.signed_date) return false;
      const d = new Date(f.signed_date);
      return d >= start && d <= end;
    }),
  [forms, fy]);

  // Calculate achievement per rep
  const repData = useMemo(() => {
    return repsWithTargets
      .filter(r => {
        if (isSales) return r.email === user?.email;
        if (teamFilter !== 'all') return r.team === teamFilter;
        return true;
      })
      .map(r => {
        const myOFs = signedInFY.filter(f => f.sales_rep_email === r.email);
        const achieved = myOFs.reduce((sum, f) => {
          const rev = parseFloat(f.committed_revenue || 0);
          const cur = f.committed_currency || 'INR';
          return sum + convertRevenue(rev, cur, r.targetCurrency);
        }, 0);
        const pct = r.target > 0 ? (achieved / r.target) * 100 : 0;
        return { ...r, achieved, pct, ofCount: myOFs.length };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [repsWithTargets, signedInFY, teamFilter, isSales, user]);

  // Summary stats (for managers)
  const summary = useMemo(() => {
    if (isSales) return null;
    const visible = repData;
    const achieved = visible.filter(r => r.pct >= 100).length;
    const onTrack  = visible.filter(r => r.pct >= 75 && r.pct < 100).length;
    const atRisk   = visible.filter(r => r.pct >= 50 && r.pct < 75).length;
    const behind   = visible.filter(r => r.pct < 50).length;
    return { total: visible.length, achieved, onTrack, atRisk, behind };
  }, [repData, isSales]);

  // FY options — current + 2 past
  const fyOptions = [currentFY, currentFY - 1, currentFY - 2];

  const thCls = "text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-brand-faint";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color:NAVY }}>Sales Target Achievement</h2>
          <p className="text-sm mt-0.5 text-brand-faint">
            Based on signed Order Forms · {getFYLabel(fy)} (Apr {fy-1} – Mar {fy})
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isSales && (
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
              className="text-sm border rounded-xl px-3 py-2 bg-white border-slate-200">
              <option value="all">All teams</option>
              <option value="India">India</option>
              <option value="Global">Global</option>
              <option value="AI/SaaS">AI/SaaS</option>
            </select>
          )}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100">
            {fyOptions.map(f => (
              <button key={f} onClick={() => setFY(f)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all"
                style={fy === f
                  ? { background:NAVY, color:'#fff' }
                  : { color:'#94a3b8' }}>
                {getFYLabel(f)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary cards — managers only */}
      {!isSales && summary && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { lbl:'Total reps tracked', val:summary.total,    color:NAVY },
            { lbl:'Target achieved',    val:summary.achieved, color:'#22c55e' },
            { lbl:'On track (≥75%)',    val:summary.onTrack,  color:T },
            { lbl:'Behind (<50%)',      val:summary.behind,   color:'#ef4444' },
          ].map(s => (
            <Card key={s.lbl} className="p-5">
              <div className="text-2xl font-black mb-0.5" style={{ color:s.color }}>{s.val}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-faint">{s.lbl}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm w-full" style={{ minWidth: isSales ? '600px' : '900px' }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {!isSales && <th className={thCls}>#</th>}
                <th className={thCls}>Sales Rep</th>
                {!isSales && <th className={thCls}>Team</th>}
                <th className={thCls}>Role</th>
                <th className={thCls}>Annual Target</th>
                <th className={thCls}>Achieved ({getFYLabel(fy)})</th>
                <th className={thCls}>OFs Signed</th>
                <th className={thCls} style={{ minWidth:'180px' }}>Progress</th>
                <th className={thCls}>Status</th>
              </tr>
            </thead>
            <tbody>
              {repData.length === 0 && (
                <tr><td colSpan={9} className="text-center py-16 text-slate-300">
                  {isSales ? 'No target assigned for your account.' : 'No reps found.'}
                </td></tr>
              )}
              {repData.map((r, i) => {
                const roleStyle = ROLE_COLOR[r.role] || { bg:'#f1f5f9', text:'#475569' };
                return (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    {!isSales && <td className="px-4 py-3.5 text-xs text-slate-300">{i+1}</td>}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-sm" style={{ color:NAVY }}>{r.name}</div>
                      <div className="text-xs text-brand-faint">{r.email}</div>
                    </td>
                    {!isSales && (
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background:'#f0f4f8', color:'#475569' }}>
                          {r.team}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background:roleStyle.bg, color:roleStyle.text }}>
                        {r.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold" style={{ color:NAVY }}>
                      {formatAmount(r.target, r.targetCurrency)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold" style={{ color: r.pct >= 100 ? '#22c55e' : NAVY }}>
                      {formatAmount(r.achieved, r.targetCurrency)}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-center" style={{ color:'#64748b' }}>
                      {r.ofCount > 0
                        ? <span className="font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">{r.ofCount}</span>
                        : <span className="text-slate-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-3.5" style={{ minWidth:'180px' }}>
                      <ProgressBar pct={r.pct}/>
                    </td>
                    <td className="px-4 py-3.5">
                      {r.ofCount > 0 || r.pct > 0
                        ? <StatusBadge pct={r.pct}/>
                        : <span className="text-xs text-slate-300">No OFs yet</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 flex-wrap">
        <span className="text-xs text-brand-faint">Progress legend:</span>
        {[
          { color:'#22c55e', lbl:'≥100% Achieved' },
          { color:T,         lbl:'75–99% On track' },
          { color:'#f59e0b', lbl:'50–74% At risk' },
          { color:'#ef4444', lbl:'<50% Behind' },
        ].map(l => (
          <div key={l.lbl} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ background:l.color }}/>
            <span className="text-xs text-brand-faint">{l.lbl}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-brand-faint mt-2">
        India team targets &amp; achievement in INR · Global and AI/SaaS in USD (conversion: $1 = ₹91 · $1 = AED 3.6725 · $1 = MYR 4.30 · $1 = IDR 16,950 · $1 = £0.80 · $1 = €0.90)
      </p>
    </div>
  );
}
