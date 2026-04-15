import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { SALES_REPS } from '../../constants/users.js';
import { Card } from '../ui/index.jsx';
import { generateSalesTargetReport } from '../../utils/reports.js';

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

// Incentive slab — applied on achieved revenue
// Upto 25%: 0% | 25–49.99%: 3% | 50–74.99%: 5% | 75–99.99%: 7%
// 100–139.99%: 9% | 140–179.99%: 11% | 180%+: 13%
function getIncentiveRate(pct) {
  if (pct >= 180)  return 0.13;
  if (pct >= 140)  return 0.11;
  if (pct >= 100)  return 0.09;
  if (pct >= 75)   return 0.07;
  if (pct >= 50)   return 0.05;
  if (pct >= 25)   return 0.03;
  return 0;
}
function getIncentiveTierLabel(pct) {
  if (pct >= 180)  return '180%+ · 13%';
  if (pct >= 140)  return '140–179.99% · 11%';
  if (pct >= 100)  return '100–139.99% · 9%';
  if (pct >= 75)   return '75–99.99% · 7%';
  if (pct >= 50)   return '50–74.99% · 5%';
  if (pct >= 25)   return '25–49.99% · 3%';
  return 'Upto 25% · 0%';
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
    return '₹' + Math.round(amount).toLocaleString('en-IN');
  }
  return '$' + Math.round(amount).toLocaleString('en-US');
}

function ProgressBar({ pct }) {
  const clamped = Math.min(pct, 100);
  const color = pct >= 100 ? '#22c55e' : pct >= 75 ? T : pct >= 50 ? '#f59e0b' : pct >= 25 ? '#f97316' : '#ef4444';
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
  if (pct >= 180) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">🚀 Exceptional</span>;
  if (pct >= 140) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Exceeded</span>;
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
        const incentiveRate   = getIncentiveRate(pct);
        const incentiveAmount = achieved * incentiveRate;
        return { ...r, achieved, pct, ofCount: myOFs.length, incentiveRate, incentiveAmount };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [repsWithTargets, signedInFY, teamFilter, isSales, user]);

  // Summary stats (for managers)
  const summary = useMemo(() => {
    if (isSales) return null;
    const visible = repData;
    const achieved = visible.filter(r => r.pct >= 100).length;
    const onTrack  = visible.filter(r => r.pct >= 75 && r.pct < 100).length;
    const atRisk   = visible.filter(r => r.pct >= 25 && r.pct < 75).length;
    const behind   = visible.filter(r => r.pct < 25).length;
    return { total: visible.length, achieved, onTrack, atRisk, behind };
  }, [repData, isSales]);

  // FY options — current + 2 past
  const fyOptions = [currentFY, currentFY - 1, currentFY - 2];

  const [selectedRep, setSelectedRep] = useState(null);

  // OFs for the detail drill-down
  const selectedRepOFs = useMemo(() => {
    if (!selectedRep) return [];
    return signedInFY
      .filter(f => f.sales_rep_email === selectedRep.email)
      .map(f => {
        const rev = parseFloat(f.committed_revenue || 0);
        const cur = f.committed_currency || 'INR';
        const converted = convertRevenue(rev, cur, selectedRep.targetCurrency);
        return { ...f, convertedRevenue: converted };
      })
      .sort((a,b) => (b.signed_date||'').localeCompare(a.signed_date||''));
  }, [selectedRep, signedInFY]);

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
          <button
            onClick={() => generateSalesTargetReport(repData, signedInFY, getFYLabel(fy))}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all"
            style={{color:NAVY}}>
            ⬇ Export Report
          </button>
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
                <th className={thCls}>Incentive</th>
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
                  <tr key={r.id}
                    onClick={() => setSelectedRep(r)}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer">
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
                    <td className="px-4 py-3.5">
                      {r.achieved > 0 ? (
                        <div>
                          <div className="font-mono text-xs font-bold" style={{ color: r.incentiveAmount > 0 ? '#15803d' : '#94a3b8' }}>
                            {r.incentiveAmount > 0 ? formatAmount(r.incentiveAmount, r.targetCurrency) : '—'}
                          </div>
                          <div className="text-[10px] mt-0.5" style={{ color:'#94a3b8' }}>
                            {getIncentiveTierLabel(r.pct)}
                          </div>
                        </div>
                      ) : <span className="text-xs text-slate-300">—</span>}
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
        Click any row to see the Order Forms considered for that rep's target. · India in INR · Global &amp; AI/SaaS in USD ($1 = ₹91 · AED 3.6725 · MYR 4.30 · IDR 16,950 · £0.80 · €0.90)
      </p>

      {/* Rep detail panel */}
      {selectedRep && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
          style={{ background:'rgba(0,0,0,0.45)' }}
          onClick={() => setSelectedRep(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 mb-4 sm:mb-0 max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* Panel header */}
            <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-lg font-bold" style={{ color:NAVY }}>{selectedRep.name}</h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background:(ROLE_COLOR[selectedRep.role]||{bg:'#f1f5f9'}).bg, color:(ROLE_COLOR[selectedRep.role]||{text:'#475569'}).text }}>
                    {selectedRep.role}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-500">
                    {selectedRep.team}
                  </span>
                </div>
                <p className="text-xs text-brand-faint mt-1">{selectedRep.email}</p>
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-faint">Target</span>
                    <div className="text-sm font-bold font-mono mt-0.5" style={{ color:NAVY }}>
                      {formatAmount(selectedRep.target, selectedRep.targetCurrency)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-faint">Achieved</span>
                    <div className="text-sm font-bold font-mono mt-0.5"
                      style={{ color: selectedRep.pct >= 100 ? '#22c55e' : NAVY }}>
                      {formatAmount(selectedRep.achieved, selectedRep.targetCurrency)}
                    </div>
                  </div>
                  <div className="flex-1" style={{ minWidth:'120px' }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-faint">Progress</span>
                    <div className="mt-1.5"><ProgressBar pct={selectedRep.pct}/></div>
                  </div>
                  <StatusBadge pct={selectedRep.pct}/>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-faint">Eligible Incentive</span>
                    <div className="text-sm font-bold font-mono mt-0.5" style={{ color: selectedRep.incentiveAmount > 0 ? '#15803d' : '#94a3b8' }}>
                      {selectedRep.incentiveAmount > 0 ? formatAmount(selectedRep.incentiveAmount, selectedRep.targetCurrency) : '—'}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color:'#94a3b8' }}>
                      {getIncentiveTierLabel(selectedRep.pct)}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedRep(null)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none ml-4 mt-1">✕</button>
            </div>

            {/* OF list */}
            <div className="overflow-y-auto flex-1 p-6 pt-4">
              <div className="text-xs font-bold uppercase tracking-wider mb-3 text-brand-faint">
                {selectedRepOFs.length} Signed OF{selectedRepOFs.length !== 1 ? 's' : ''} in {getFYLabel(fy)} counted towards target
              </div>
              {selectedRepOFs.length === 0 ? (
                <div className="text-center py-10 text-slate-300 text-sm">No signed OFs in {getFYLabel(fy)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth:'580px' }}>
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {['OF Number','Customer','Services','Currency','Committed Revenue','Converted (' + selectedRep.targetCurrency + ')','Signing Date'].map(h => (
                          <th key={h} className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-brand-faint whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRepOFs.map((f, i) => (
                        <tr key={f.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-mono font-bold whitespace-nowrap" style={{ color:NAVY }}>
                            {f.of_number || '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold" style={{ color:NAVY }}>{f.customer_name}</div>
                            {f.brand_name && f.brand_name !== f.customer_name && (
                              <div className="text-[10px] text-brand-faint">{f.brand_name}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {(f.services_fees||[]).map(s => (
                                <span key={s.id} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700">
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-brand-muted">{f.committed_currency || 'INR'}</td>
                          <td className="px-3 py-2.5 font-mono font-semibold" style={{ color:NAVY }}>
                            {Number(f.committed_revenue||0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold" style={{ color:T }}>
                            {formatAmount(f.convertedRevenue, selectedRep.targetCurrency)}
                          </td>
                          <td className="px-3 py-2.5 text-brand-muted whitespace-nowrap">
                            {f.signed_date ? new Date(f.signed_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t-2 border-slate-200">
                        <td colSpan={5} className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-brand-faint">Total</td>
                        <td className="px-3 py-2.5 font-mono font-black text-sm" style={{ color:NAVY }}>
                          {formatAmount(selectedRep.achieved, selectedRep.targetCurrency)}
                        </td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
