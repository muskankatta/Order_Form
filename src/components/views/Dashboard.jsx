import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, StatusPill, Btn } from '../ui/index.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { SALES_REPS, getRepRegion } from '../../constants/users.js';
import { fmtShort, daysUntil } from '../../utils/dates.js';

const NAVY='#1B2B4B'; const T='#00C3B5';

// Exchange rates to USD
const TO_USD = { USD:v=>v, INR:v=>v/91, AED:v=>v/3.6725, MYR:v=>v/4.30, IDR:v=>v/16950, GBP:v=>v/0.80, EUR:v=>v/0.90, SGD:v=>v/1.35, SAR:v=>v/3.75, AUD:v=>v/1.55 };
const toUSD = (amt, cur) => (TO_USD[cur] || (v=>v))(amt);

// Get region for a form (from rep assignment or form.region field)
function formRegion(f) {
  return f.region || getRepRegion(f.sales_rep_email) || null;
}

// Filter helpers
function matchesFilter(f, filter) {
  if (filter === 'all')        return true;
  if (filter === 'India')      return f.sales_team === 'India';
  if (filter === 'AI/SaaS')    return f.sales_team === 'AI/SaaS';
  if (filter === 'MEA')        return f.sales_team === 'Global' && formRegion(f) === 'MEA';
  if (filter === 'SEA & RoW')  return f.sales_team === 'Global' && formRegion(f) === 'SEA & RoW';
  if (filter === 'Global')     return f.sales_team === 'Global';
  return true;
}

function isGlobalFilter(filter) { return filter === 'MEA' || filter === 'SEA & RoW' || filter === 'Global'; }

// Quarter from signing date
function signingQtr(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr), m = d.getMonth()+1, y = d.getFullYear();
  if (m>=4&&m<=6)  return `Q1 FY${String(y+1).slice(2)}`;
  if (m>=7&&m<=9)  return `Q2 FY${String(y+1).slice(2)}`;
  if (m>=10&&m<=12)return `Q3 FY${String(y+1).slice(2)}`;
  return `Q4 FY${String(y).slice(2)}`;
}

function signingMonth(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
}

function fmtRev(val, useUSD) {
  if (useUSD) return '$' + Math.round(val).toLocaleString('en-US');
  return '\u20b9' + Math.round(val).toLocaleString('en-IN');
}

const STATUS_COLORS = {
  draft:'#94a3b8', submitted:'#f59e0b', revops_approved:'#3b82f6',
  revops_rejected:'#ef4444', approved:'#22c55e', signed:'#00C3B5',
  completed:'#8b5cf6', dropped:'#e2e8f0', void:'#f97316', churn:'#f43f5e',
};

function StatCard({ label, value, color, onClick, sub }) {
  return (
    <div className={'bg-white rounded-2xl border p-5 transition-all '+(onClick?'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-95':'')}
      style={{borderColor:'#e8edf3',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}} onClick={onClick}>
      <div className="text-2xl font-black mb-0.5" style={{color:color||NAVY}}>{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-faint">{label}</div>
      {sub && <div className="text-[10px] mt-1 text-brand-faint">{sub}</div>}
      {onClick && <div className="text-[10px] mt-1.5 font-medium" style={{color:color||T}}>View \u2192</div>}
    </div>
  );
}

function BigStatCard({ label, value, color, onClick }) {
  return (
    <div className={'bg-white rounded-2xl border p-5 transition-all '+(onClick?'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-95':'')}
      style={{borderColor:'#e8edf3',boxShadow:'0 1px 4px rgba(0,0,0,0.04)'}} onClick={onClick}>
      <div className="text-xs font-bold uppercase tracking-widest mb-2 text-brand-faint">{label}</div>
      <div className="text-2xl font-black" style={{color:color||NAVY}}>{value}</div>
      {onClick && <div className="text-[10px] mt-1.5 font-medium" style={{color:color||T}}>View \u2192</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user }  = useAuth();
  const { forms } = useForms();
  const navigate  = useNavigate();

  const [teamFilter,  setTeamFilter]  = useState('all');
  const [chartView,   setChartView]   = useState('quarter'); // 'quarter' | 'month'

  const isSales = user?.role === 'sales' && !user?.isUniversal;
  const useUSD  = isGlobalFilter(teamFilter);

  // Base visible forms
  const visible = useMemo(() => {
    let base = isSales ? forms.filter(f=>f.sales_rep_email===user.email) : forms;
    return base.filter(f => matchesFilter(f, teamFilter));
  }, [forms, isSales, teamFilter, user]);

  const today = new Date(); today.setHours(0,0,0,0);
  const isActive = f => {
    const s = f.start_date?new Date(f.start_date):null;
    const e = f.end_date?new Date(f.end_date):null;
    return f.status==='signed' && s && e && today>=s && today<=e;
  };

  const n = {
    total:    visible.length,
    revops:   visible.filter(f=>f.status==='submitted').length,
    finance:  visible.filter(f=>f.status==='revops_approved').length,
    approved: visible.filter(f=>f.status==='approved').length,
    unsigned: visible.filter(f=>f.status==='approved'&&!f.signed_date).length,
    draft:    visible.filter(f=>f.status==='draft'&&!f.is_renewal).length,
    active:   visible.filter(isActive).length,
    completed:visible.filter(f=>f.status==='completed').length,
    renewals: visible.filter(f=>f.is_renewal&&f.status==='draft').length,
  };

  // Revenue — signed OFs
  const signedForms = visible.filter(f=>f.status==='signed');

  const revenueINR = useMemo(() =>
    visible.filter(f=>f.status==='signed'&&f.sales_team==='India')
      .reduce((s,f)=>s+Number(f.committed_revenue||0),0),
  [visible]);

  const revenueUSD = useMemo(() =>
    visible.filter(f=>f.status==='signed'&&f.sales_team!=='India')
      .reduce((s,f)=>s+toUSD(Number(f.committed_revenue||0),f.committed_currency||'INR'),0),
  [visible]);

  // ── BAR CHART: Revenue by quarter/month ───────────────────────────────────
  const barData = useMemo(() => {
    const map = {};
    signedForms.forEach(f => {
      const key = chartView==='month' ? signingMonth(f.signed_date) : signingQtr(f.signed_date);
      if (!key) return;
      const rev = useUSD
        ? toUSD(Number(f.committed_revenue||0), f.committed_currency||'INR')
        : Number(f.committed_revenue||0);
      map[key] = (map[key]||0) + rev;
    });
    return Object.entries(map)
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([name,value])=>({name, value:Math.round(value)}));
  }, [signedForms, chartView, useUSD]);

  // ── PIE CHART: OFs by status ──────────────────────────────────────────────
  const pieData = useMemo(() => {
    const map = {};
    visible.forEach(f => {
      const s = f.status||'unknown';
      map[s] = (map[s]||0)+1;
    });
    return Object.entries(map)
      .filter(([,v])=>v>0)
      .map(([name,value])=>({name, value, label: name.replace(/_/g,' ')}))
      .sort((a,b)=>b.value-a.value);
  }, [visible]);

  // ── LEADERBOARD: rep performance ─────────────────────────────────────────
  const leaderboard = useMemo(() => {
    const repsToShow = SALES_REPS.filter(r => {
      if (!matchesFilter({sales_team:r.team, region:r.region, sales_rep_email:r.email}, teamFilter)) return false;
      return r.target !== null && r.target !== undefined;
    });
    return repsToShow.map(r => {
      const myOFs = signedForms.filter(f=>f.sales_rep_email===r.email);
      const achieved = myOFs.reduce((s,f)=>{
        const rev = Number(f.committed_revenue||0);
        const cur = f.committed_currency||'INR';
        const usd = toUSD(rev,cur);
        return s + (r.targetCurrency==='INR' ? usd*91 : usd);
      },0);
      const pct = r.target>0 ? (achieved/r.target)*100 : 0;
      return {...r, achieved, pct, ofCount:myOFs.length};
    }).sort((a,b)=>b.pct-a.pct).slice(0,10);
  }, [signedForms, teamFilter]);

  const queue = user?.role==='revops'
    ? visible.filter(f=>f.status==='submitted')
    : user?.role==='finance'
    ? visible.filter(f=>f.status==='revops_approved')
    : visible.filter(f=>['submitted','draft','revops_rejected'].includes(f.status));

  const renewing = visible.filter(f=>{
    const d=daysUntil(f.end_date);
    return d!==null&&d<=30&&d>0;
  });

  const goRepo    = s => navigate(`/repository${s?'?status='+s:''}`);
  const goPending = s => navigate(`/pending${s?'?section='+s:''}`);
  const goSigned  = t => navigate(`/signed${t?'?tab='+t:''}`);

  const FILTERS = [
    { id:'all',       lbl:'All' },
    { id:'India',     lbl:'India' },
    { id:'MEA',       lbl:'Global · MEA' },
    { id:'SEA & RoW', lbl:'Global · SEA & RoW' },
    { id:'AI/SaaS',   lbl:'AI/SaaS' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold" style={{color:NAVY}}>Dashboard</h2>
        {(user?.role==='sales'||user?.isUniversal) && (
          <Btn onClick={()=>navigate('/form/new')}>+ New Order Form</Btn>
        )}
      </div>

      {/* Team filter */}
      {!isSales && (
        <div className="flex gap-1.5 flex-wrap mb-6 p-1 rounded-xl bg-slate-100 w-fit">
          {FILTERS.map(f=>(
            <button key={f.id} onClick={()=>setTeamFilter(f.id)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all"
              style={teamFilter===f.id?{background:NAVY,color:'#fff'}:{color:'#94a3b8'}}>
              {f.lbl}
            </button>
          ))}
        </div>
      )}

      {/* Row 1 */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <StatCard label="Total OFs"       value={n.total}    onClick={()=>goRepo()}/>
        <StatCard label="Pending RevOps"  value={n.revops}   color="#d97706" onClick={()=>goPending('revops')}/>
        <StatCard label="Pending Finance" value={n.finance}  color="#2563eb" onClick={()=>goPending('finance')}/>
        <StatCard label="Approved"        value={n.approved} color="#16a34a" onClick={()=>goRepo('approved')}/>
      </div>

      {/* Row 2 — revenue */}
      {teamFilter === 'all' ? (
        <div className="grid grid-cols-4 gap-4 mb-4">
          <BigStatCard label="Revenue (India · INR · Signed)" value={'\u20b9'+revenueINR.toLocaleString('en-IN')} color={T} onClick={()=>goRepo('signed')}/>
          <BigStatCard label="Revenue (Global · USD · Signed)" value={'$'+Math.round(revenueUSD).toLocaleString('en-US')} color="#7c3aed" onClick={()=>goRepo('signed')}/>
          <BigStatCard label="Active contracts" value={n.active} color="#16a34a" onClick={()=>goRepo('signed')}/>
          <BigStatCard label="Completed contracts" value={n.completed} color="#64748b" onClick={()=>goRepo('completed')}/>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <BigStatCard
            label={`Committed Revenue (Signed) · ${useUSD?'USD':'INR'}`}
            value={useUSD ? '$'+Math.round(revenueUSD).toLocaleString('en-US') : '\u20b9'+revenueINR.toLocaleString('en-IN')}
            color={T} onClick={()=>goRepo('signed')}/>
          <BigStatCard label="Active contracts"    value={n.active}    color="#16a34a" onClick={()=>goRepo('signed')}/>
          <BigStatCard label="Completed contracts" value={n.completed} color="#64748b" onClick={()=>goRepo('completed')}/>
        </div>
      )}

      {/* Row 3 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Unsigned OFs"       value={n.unsigned} color="#ef4444" onClick={()=>goSigned('unsigned')}/>
        <StatCard label="Drafts in progress" value={n.draft}    color="#64748b" onClick={()=>goPending('drafts')}/>
        <StatCard label="Renewal drafts"     value={n.renewals} color="#7c3aed" onClick={()=>goPending('renewals')}/>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-5 mb-6">
        {/* Bar chart — revenue */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-bold text-sm" style={{color:NAVY}}>Committed Revenue</div>
              <div className="text-xs text-brand-faint">Signed OFs · by signing date</div>
            </div>
            <div className="flex gap-1 p-0.5 rounded-lg bg-slate-100">
              {[{id:'quarter',lbl:'Quarter'},{id:'month',lbl:'Month'}].map(v=>(
                <button key={v.id} onClick={()=>setChartView(v.id)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md transition-all"
                  style={chartView===v.id?{background:'#fff',color:NAVY,boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}:{color:'#94a3b8'}}>
                  {v.lbl}
                </button>
              ))}
            </div>
          </div>
          {barData.length === 0
            ? <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No signed OFs yet</div>
            : <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{top:0,right:0,bottom:0,left:0}}>
                  <XAxis dataKey="name" tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:'#94a3b8'}} axisLine={false} tickLine={false}
                    tickFormatter={v=>useUSD?'$'+(v/1000).toFixed(0)+'K':'\u20b9'+(v/100000).toFixed(0)+'L'}/>
                  <Tooltip
                    formatter={(value)=>[fmtRev(value,useUSD),'Revenue']}
                    contentStyle={{borderRadius:'10px',border:'1px solid #e2e8f0',fontSize:'12px'}}/>
                  <Bar dataKey="value" fill={T} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
          }
        </Card>

        {/* Pie chart — by status */}
        <Card className="p-5">
          <div className="font-bold text-sm mb-1" style={{color:NAVY}}>OFs by Status</div>
          <div className="text-xs text-brand-faint mb-3">All {visible.length} OFs</div>
          {pieData.length === 0
            ? <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No data</div>
            : <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" nameKey="label">
                    {pieData.map((entry,i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name]||'#94a3b8'}/>
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v,n)=>[v+' OFs',n]}
                    contentStyle={{borderRadius:'10px',border:'1px solid #e2e8f0',fontSize:'12px'}}/>
                  <Legend iconSize={8} iconType="circle"
                    formatter={v=><span style={{fontSize:'10px',color:'#64748b',textTransform:'capitalize'}}>{v.replace(/_/g,' ')}</span>}/>
                </PieChart>
              </ResponsiveContainer>
          }
        </Card>
      </div>

      {/* Leaderboard */}
      {!isSales && leaderboard.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50">
            <div className="font-bold text-sm" style={{color:NAVY}}>Rep Performance Leaderboard</div>
            <div className="text-xs text-brand-faint mt-0.5">Signed OFs · Target achievement · {teamFilter==='all'?'All teams':teamFilter}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{minWidth:'650px'}}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['#','Rep','Team','Target','Achieved','OFs','Achievement %'].map(h=>(
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-brand-faint">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r,i)=>{
                  const pctColor = r.pct>=100?'#22c55e':r.pct>=75?T:r.pct>=50?'#f59e0b':'#ef4444';
                  return (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-300 font-bold">{i+1}</td>
                      <td className="px-4 py-2.5 font-semibold" style={{color:NAVY}}>{r.name}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">{r.team}{r.region?' · '+r.region:''}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono">
                        {r.targetCurrency==='INR'?'\u20b9':'$'}{Math.round(r.target).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-mono" style={{color:pctColor}}>
                        {r.targetCurrency==='INR'?'\u20b9':'$'}{Math.round(r.achieved).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {r.ofCount>0?<span className="px-1.5 py-0.5 rounded-full font-bold bg-teal-50 text-teal-700">{r.ofCount}</span>:'—'}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden" style={{minWidth:'80px'}}>
                            <div className="h-full rounded-full" style={{width:Math.min(r.pct,100)+'%',background:pctColor}}/>
                          </div>
                          <span className="font-bold w-10 text-right" style={{color:pctColor}}>
                            {r.pct>=1000?'999%+':r.pct.toFixed(1)+'%'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Renewal drafts banner */}
      {n.renewals > 0 && (
        <Card className="mb-6 overflow-hidden cursor-pointer hover:shadow-md transition-all" onClick={()=>goPending('renewals')}>
          <div className="px-6 py-3 bg-purple-50 border-b border-purple-200">
            <h3 className="font-bold text-sm text-purple-800">\uD83D\uDD04 Renewal drafts ready for review ({n.renewals}) — click to view \u2192</h3>
          </div>
          {visible.filter(f=>f.is_renewal&&f.status==='draft').map(f=>(
            <div key={f.id} onClick={e=>{e.stopPropagation();navigate('/form/'+f.id);}}
              className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
              <div>
                <span className="text-sm font-medium" style={{color:NAVY}}>{f.customer_name}</span>
                <span className="text-xs text-purple-600 ml-2 font-semibold">Renewal of {f.renewal_of_number} · Suggested: {f.suggested_of_number}</span>
              </div>
              <span className="text-xs text-brand-faint">{f.start_date} \u2192 {f.end_date}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Renewing soon */}
      {renewing.length > 0 && (
        <Card className="mb-6 overflow-hidden cursor-pointer hover:shadow-md transition-all" onClick={()=>goRepo()}>
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200">
            <h3 className="font-bold text-sm text-amber-800">\uD83D\uDD14 Renewing / expiring within 30 days ({renewing.length}) \u2192</h3>
          </div>
          {renewing.map(f=>(
            <div key={f.id} onClick={e=>{e.stopPropagation();navigate('/form/'+f.id);}}
              className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-slate-50 border-b border-slate-50 last:border-0">
              <span className="text-sm font-medium" style={{color:NAVY}}>{f.customer_name}</span>
              <span className="text-xs text-amber-600 font-bold">{daysUntil(f.end_date)}d remaining · {f.end_date}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Queue */}
      <Card>
        <div className="px-6 py-4 border-b border-slate-50">
          <h3 className="font-bold text-sm text-slate-500">
            {user?.role==='revops'?'\u23f3 Pending your review':user?.role==='finance'?'\uD83D\uDCBC Pending your approval':'\uD83D\uDCCB My active forms'}
            <span className="ml-2 font-normal text-brand-faint">({queue.length})</span>
          </h3>
        </div>
        {queue.length===0
          ? <div className="py-14 text-center text-sm text-slate-300">Queue is clear \uD83C\uDF89</div>
          : queue.map(f=>(
            <div key={f.id} onClick={()=>navigate('/form/'+f.id)}
              className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
              <div>
                <div className="font-semibold text-sm" style={{color:NAVY}}>
                  {f.customer_name} <span className="text-slate-300">\u00b7</span>{' '}
                  <span className="font-normal text-slate-500">{f.brand_name}</span>
                </div>
                <div className="text-xs mt-0.5 text-brand-faint">
                  {(f.services_fees||[]).map(s=>s.name).filter(Boolean).join(', ')||'—'} · {f.committed_currency||'INR'} {f.committed_revenue||'—'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={f.status}/>
                <span className="text-slate-300">\u203a</span>
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  );
}
