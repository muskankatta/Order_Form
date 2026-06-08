import { useEffect, useRef, useState } from 'react';
import { Lbl, SHdr } from '../../ui/index.jsx';
import { SERVICES, FEE_TYPES, FEE_RULES, UNIT_METRICS, PAY_TRIGGERS,
         GRADUATED_ELIGIBLE, STEP_UP_ELIGIBLE, SLAB_RATE_UNITS,
         BUSINESS_UNITS, buForService, isSkuService } from '../../../constants/formOptions.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { uid } from '../../../utils/dates.js';
import { cyclesInTerm, getSym, cyclesInDateRange } from '../../../utils/formatting.js';
import { calcMetrics, calcOFValue } from '../../../utils/calculations.js';
import { newFee } from '../../../hooks/useFormWizard.js';

const T = '#00C3B5'; const NAVY = '#1B2B4B';

const SUB_SERVICES = {
  'Konnect (OMS)': ['3P Storefront','3P Marketplace'],
  'StoreOS': ['Clienteling','POS','Endless Aisle','Scan & Go','Self Checkout Kiosk'],
  'GlamAR':  ['3D Model Creation','3D Configurator','3D Virtual Photography','360 Degree Product Viewer','Virtual Try-On (VTO)','AR Ads','AI Skin Analysis'],
};

// ── Drag handle icon ──────────────────────────────────────────────────────────
function DragHandle() {
  return (
    <span
      title="Drag to reorder"
      className="cursor-grab active:cursor-grabbing select-none"
      style={{color:'#cbd5e1',fontSize:'14px',lineHeight:1,letterSpacing:'-1px',padding:'0 2px'}}>
      ⠿
    </span>
  );
}

// ── Inclusions helpers ────────────────────────────────────────────────────────
function toIncArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(item =>
    typeof item === 'string' ? { text: item, metric: '' } : item
  );
  return val.split(',').map(s => ({ text: s.trim(), metric: '' })).filter(i => i.text);
}

function incLabel(item) {
  if (!item) return '';
  if (typeof item === 'string') return item;
  return item.metric ? item.text + ' ' + item.metric : item.text;
}

function InclusionsField({ value, onChange }) {
  const items = toIncArray(value);
  const [draftText,         setDraftText]         = useState('');
  const [draftMetric,       setDraftMetric]       = useState('');
  const [draftCustomMetric, setDraftCustomMetric] = useState('');

  const effectiveMetric = draftMetric === 'Custom' ? draftCustomMetric.trim() : draftMetric;

  const add = () => {
    const t = draftText.trim();
    if (!t) return;
    onChange([...items, { text: t, metric: effectiveMetric }]);
    setDraftText(''); setDraftMetric(''); setDraftCustomMetric('');
  };

  const remove = (i) => onChange(items.filter((_,j) => j !== i));

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-2 text-brand-faint">Inclusions</div>
      {items.length > 0 && (
        <div className="flex flex-col gap-1 mb-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{background:'#e0f7f5', color:'#00897b', border:'1px solid #99f6e4'}}>
              <span className="font-bold">{item.text}</span>
              {item.metric && <span className="font-normal opacity-75">{item.metric}</span>}
              <button type="button" onClick={() => remove(i)}
                className="ml-auto text-[11px] font-bold leading-none hover:text-red-500 transition-colors">✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-lg border p-2 bg-white" style={{borderColor:'#e2e8f0'}}>
        <div className="flex gap-2 mb-1.5">
          <input value={draftText} onChange={e => setDraftText(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); add(); } }}
            placeholder="Value (e.g. 3,333)"
            className="flex-1 text-xs px-2 py-1.5 rounded-md border focus:outline-none bg-white"
            style={{borderColor:'#e2e8f0'}}/>
          <button type="button" onClick={add}
            className="text-xs px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-all"
            style={{background: T, color:'#fff', border:'none'}}>+ Add</button>
        </div>
        <select value={draftMetric}
          onChange={e => { setDraftMetric(e.target.value); if (e.target.value !== 'Custom') setDraftCustomMetric(''); }}
          className="w-full text-xs px-2 py-1.5 rounded-md border focus:outline-none bg-white"
          style={{borderColor:'#e2e8f0'}}>
          <option value="">— Select metric —</option>
          {UNIT_METRICS.filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
          <option value="Custom">Custom…</option>
        </select>
        {draftMetric === 'Custom' && (
          <input value={draftCustomMetric} onChange={e => setDraftCustomMetric(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter') { e.preventDefault(); add(); } }}
            placeholder="Enter custom metric…"
            className="w-full text-xs px-2 py-1.5 rounded-md border mt-1.5 focus:outline-none bg-white"
            style={{borderColor:'#00C3B5'}}/>
        )}
      </div>
      <p className="text-[10px] mt-1 text-brand-faint">Fill value + metric, press Enter or click + Add</p>
    </div>
  );
}

// ── GaaS SKU block ────────────────────────────────────────────────────────────
function GaasSKUBlock({ svc, onChange, ro, currency }) {
  const lines = svc.gaas_lines || [];
  const sym   = getSym(currency || 'INR');

  const recalc = (updated) => {
    const total = updated.reduce((s,l) => s + (Number(l.amount)||0), 0);
    onChange({ ...svc, gaas_lines: updated, gaas_total: total });
  };

  const addLine = () => recalc([...lines, { id:uid(), skuDetails:'', styleId:'', color:'', size:'', quantity:0, rate:0, amount:0 }]);
  const updateLine = (i, field, val) => {
    recalc(lines.map((l, li) => {
      if (li !== i) return l;
      const upd = { ...l, [field]: val };
      if (field === 'quantity' || field === 'rate') upd.amount = parseFloat(upd.quantity||0) * parseFloat(upd.rate||0);
      return upd;
    }));
  };
  const removeLine = i => recalc(lines.filter((_,li) => li !== i));
  const total    = lines.reduce((s,l) => s + (Number(l.amount)||0), 0);
  const totalQty = lines.reduce((s,l) => s + (Number(l.quantity)||0), 0);

  const downloadTemplate = () => {
    const csv = 'SKU Details,Style id,Color,Size,Quantity,Rate,Amount\n';
    const blob = new Blob([csv], {type:'text/csv'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='gaas_sku_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const uploadCSV = e => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = ev.target.result.trim().split('\n').slice(1);
      const parsed = rows.map(row => {
        const cols = row.split(',');
        const qty  = parseFloat(cols[4]||0), rate = parseFloat(cols[5]||0);
        return { id:uid(), skuDetails:cols[0]?.trim()||'', styleId:cols[1]?.trim()||'',
                 color:cols[2]?.trim()||'', size:cols[3]?.trim()||'', quantity:qty, rate:rate, amount:qty*rate };
      }).filter(l => l.skuDetails || l.styleId);
      recalc(parsed);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const inp = 'w-full text-xs px-1.5 py-1 bg-transparent focus:outline-none focus:bg-white rounded';
  const thCls = 'text-left px-3 py-2 font-bold text-[10px] uppercase tracking-wider border border-slate-200 bg-slate-100';
  const tdCls = 'border border-slate-100 px-2 py-1.5';

  return (
    <div>
      {!ro && (
        <div className="flex gap-2 mb-3 flex-wrap items-center">
          <button type="button" onClick={downloadTemplate}
            className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-all hover:bg-slate-50"
            style={{borderColor:'#e2e8f0',color:'#475569'}}>⬇ Download GaaS Template (CSV)</button>
          <label className="text-xs px-3 py-1.5 rounded-lg border font-medium cursor-pointer transition-all hover:bg-slate-50"
            style={{borderColor:'#e2e8f0',color:'#475569'}}>
            📤 Upload & Preview CSV
            <input type="file" accept=".csv" className="hidden" onChange={uploadCSV}/>
          </label>
          <button type="button" onClick={addLine}
            className="text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all"
            style={{borderColor:T,color:T}}>+ Add SKU Row</button>
          {lines.length > 0 && (
            <button type="button" onClick={()=>recalc([])}
              className="text-xs px-3 py-1.5 rounded-lg border font-medium text-red-500 border-red-200 hover:bg-red-50">Clear All</button>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs" style={{minWidth:'700px',borderCollapse:'collapse'}}>
          <thead>
            <tr>
              <th className={thCls} style={{minWidth:'140px'}}>SKU Details</th>
              <th className={thCls}>Style ID</th>
              <th className={thCls}>Color</th>
              <th className={thCls}>Size</th>
              <th className={thCls + ' text-right'}>Quantity</th>
              <th className={thCls + ' text-right'}>Rate ({sym})</th>
              <th className={thCls + ' text-right'}>Amount ({sym})</th>
              {!ro && <th className={thCls}></th>}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={ro?7:8} className="text-center py-8 text-slate-300 border border-slate-100">No SKU rows yet — add manually or upload a CSV.</td></tr>
            )}
            {lines.map((l, i) => (
              <tr key={l.id} style={{background:i%2===0?'#fff':'#f8fafc'}}>
                {[['skuDetails',l.skuDetails,'SKU name'],['styleId',l.styleId,'Style ID'],['color',l.color,'Color'],['size',l.size,'Size']].map(([field,val,ph])=>(
                  <td key={field} className={tdCls}>
                    {ro ? <span>{val||'—'}</span> :
                      <input value={val} onChange={e=>updateLine(i,field,e.target.value)} placeholder={ph} className={inp}/>}
                  </td>
                ))}
                {[['quantity',l.quantity],['rate',l.rate]].map(([field,val])=>(
                  <td key={field} className={tdCls + ' text-right'}>
                    {ro ? val :
                      <input type="number" value={val} min="0" onChange={e=>updateLine(i,field,e.target.value)}
                        className={inp + ' text-right font-mono'}/>}
                  </td>
                ))}
                <td className={tdCls + ' text-right font-mono font-semibold'} style={{color:NAVY}}>
                  {Number(l.amount||0).toLocaleString('en-IN')}
                </td>
                {!ro && (
                  <td className={tdCls + ' text-center'}>
                    <button type="button" onClick={()=>removeLine(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr style={{background:'#f0f4f8'}}>
                <td colSpan={4} className="border border-slate-200 px-3 py-2 font-bold text-right text-[11px]" style={{color:NAVY}}>Total</td>
                <td className="border border-slate-200 px-2 py-2 text-right font-mono font-bold" style={{color:NAVY}}>{totalQty}</td>
                <td className="border border-slate-200 px-2 py-2"></td>
                <td className="border border-slate-200 px-2 py-2 text-right font-mono font-bold text-[12px]" style={{color:T}}>
                  {sym}{total.toLocaleString('en-IN')}
                </td>
                {!ro && <td className="border border-slate-200"></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {lines.length > 0 && (
        <div className="mt-2 text-xs text-brand-faint text-right">
          Order Form Value: <strong style={{color:NAVY}}>{sym}{total.toLocaleString('en-IN')}</strong>
        </div>
      )}
    </div>
  );
}

// ── Fee row ───────────────────────────────────────────────────────────────────
function FeeRow({ fee, onChange, onRemove, idx, termMonths, currency }) {
  const u   = (k,v) => onChange({ ...fee, [k]:v });
  const sym = getSym(currency || 'INR');
  const rules    = FEE_RULES[fee.feeType] || {};
  const cycleOpts= rules.locked ? [] : (rules.opts || ['Monthly','Quarterly','Bi-Annually','Annually','One Time']);
  const isOT     = fee.billingCycle === 'One Time';
  const canGrad  = GRADUATED_ELIGIBLE.includes(fee.feeType);
  const canStep  = STEP_UP_ELIGIBLE.includes(fee.feeType) && !isOT;
  const cycles   = termMonths && fee.billingCycle && !isOT ? cyclesInTerm(fee.billingCycle, termMonths) : null;
  const slabRateOpts = [...SLAB_RATE_UNITS.map(u => u.startsWith('%') ? u : `${sym} ${u}`), 'Others'];
  const s6  = { borderColor:'#e2e8f0' };
  const inp = 'w-full text-xs px-2 py-1.5 rounded-lg border focus:outline-none bg-white';

  const handleFeeType = ft => {
    const r = FEE_RULES[ft] || {};
    onChange({ ...fee, feeType:ft, billingCycle:r.locked||(r.opts?.[0])||'', billingCycleLocked:!!r.locked, isLogistics:ft==='Logistics Fee', pricingModel:'flat' });
  };

  const updSlab = (si, field, val) => {
    const slabs = fee.slabs.map((s,i) => {
      if (i !== si) return s;
      const upd = { ...s, [field]:val };
      if (field === 'rateType' && val !== 'Others') upd.rateTypeCustom = '';
      return upd;
    });
    if (field === 'to' && fee.slabs[si+1]) slabs[si+1] = { ...slabs[si+1], from: String(parseInt(val||0)+1) };
    u('slabs', slabs);
  };

  return (
    <div className="border rounded-xl p-4 mb-3 bg-slate-50" style={{ borderColor:'#e2e8f0' }}>
      <div className="flex justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-faint">Fee row {idx+1}</span>
        <button type="button" onClick={onRemove} className="text-xs font-medium text-red-500">✕ Remove</button>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">Fee type *</div>
          <select value={fee.isCustomFeeType ? '__others__' : (fee.feeType||'')}
            onChange={e => {
              if (e.target.value === '__others__') {
                onChange({ ...fee, feeType:'', isCustomFeeType:true, billingCycle:'', billingCycleLocked:false, isLogistics:false, pricingModel:'flat' });
              } else {
                onChange({ ...fee, isCustomFeeType:false });
                handleFeeType(e.target.value);
              }
            }} className={inp} style={s6}>
            <option value="">Select…</option>
            {FEE_TYPES.map(f=><option key={f}>{f}</option>)}
            <option value="__others__">Others…</option>
          </select>
          {fee.isCustomFeeType && (
            <input value={fee.feeType||''} onChange={e=>u('feeType',e.target.value)}
              placeholder="Enter fee type name…" className={`${inp} w-full mt-1.5`} style={{borderColor:'#00C3B5'}}/>
          )}
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">
            Billing cycle{fee.billingCycleLocked&&<span className="text-green-500 normal-case tracking-normal"> (auto)</span>}
          </div>
          {fee.billingCycleLocked
            ? <input value={fee.billingCycle} readOnly className={inp} style={{...s6,background:'#f8fafc',color:'#64748b'}}/>
            : <select value={fee.billingCycle} onChange={e=>u('billingCycle',e.target.value)} className={inp} style={s6}>
                <option value="">Select…</option>
                {cycleOpts.map(o=><option key={o}>{o}</option>)}
              </select>}
        </div>
        {canGrad && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">Pricing model</div>
            <div className="flex gap-1">
              {['flat','graduated'].map(pm=>(
                <button key={pm} type="button" onClick={()=>u('pricingModel',pm)}
                  className="flex-1 text-xs py-1.5 rounded-lg font-semibold border transition-all"
                  style={fee.pricingModel===pm?{background:NAVY,color:'#fff',borderColor:NAVY}:{background:'#f8fafc',color:'#64748b',borderColor:'#e2e8f0'}}>
                  {pm==='flat'?'Flat':'Graduated'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {fee.isLogistics && (
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">Rate card URL</div>
          <input value={fee.logisticsRateCard||''} onChange={e=>u('logisticsRateCard',e.target.value)} className={`${inp} w-full`} style={s6}/>
        </div>
      )}
      {!fee.isLogistics && fee.pricingModel==='graduated' && (
        <div className="mb-3 rounded-lg p-3 bg-slate-100 border border-slate-200">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-600">Slab tiers</div>
          <div className="grid gap-1 mb-1" style={{gridTemplateColumns:'1fr 1fr 1fr 1.4fr 20px'}}>
            {['From','To','Rate','Rate type',''].map((h,i)=>(
              <div key={i} className="text-[9px] font-bold uppercase tracking-wider text-brand-faint">{h}</div>
            ))}
          </div>
          {(fee.slabs||[]).map((sl,si)=>(
            <div key={sl.id}>
              <div className="grid gap-1 mb-1 items-center" style={{gridTemplateColumns:'1fr 1fr 1fr 1.4fr 20px'}}>
                <input value={sl.from} readOnly={si>0} onChange={e=>updSlab(si,'from',e.target.value)} className={`${inp} font-mono`} style={{...s6,background:si>0?'#f8fafc':'#fff'}}/>
                <input value={sl.to} onChange={e=>updSlab(si,'to',e.target.value)} placeholder="∞" className={`${inp} font-mono`} style={s6}/>
                <input value={sl.rate} onChange={e=>updSlab(si,'rate',e.target.value)} placeholder="0.00" className={`${inp} font-mono`} style={s6}/>
                <select value={sl.rateType} onChange={e=>updSlab(si,'rateType',e.target.value)} className={inp} style={s6}>
                  {slabRateOpts.map(o=><option key={o}>{o}</option>)}
                </select>
                <button type="button" onClick={()=>{if((fee.slabs||[]).length>1)u('slabs',(fee.slabs||[]).filter((_,i)=>i!==si));}} className="text-xs text-red-500">✕</button>
              </div>
              {sl.rateType==='Others' && (
                <div className="flex items-center gap-2 mb-2 pl-1">
                  <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap">{sym} per</span>
                  <input value={sl.rateTypeCustom||''} onChange={e=>updSlab(si,'rateTypeCustom',e.target.value)} placeholder="e.g. AI Video" className="flex-1 text-xs px-2 py-1 rounded-lg border" style={s6}/>
                </div>
              )}
            </div>
          ))}
          <button type="button"
            onClick={()=>u('slabs',[...(fee.slabs||[]),{id:uid(),from:String(parseInt((fee.slabs||[]).at(-1)?.to||'0')+1),to:'',rate:'',rateType:`${sym} per unit`,rateTypeCustom:''}])}
            className="text-xs font-medium mt-1" style={{color:T}}>+ Add slab tier</button>
        </div>
      )}
      {!fee.isLogistics && fee.pricingModel!=='graduated' && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-faint">Commercial value *</div>
            {(fee.feeType === 'Transaction Fee' || fee.feeType === 'Resource Fee') && !isOT && (
              <div className="flex gap-0.5 p-0.5 rounded-lg bg-slate-100">
                {(fee.feeType === 'Transaction Fee'
                  ? [['fixed','Fixed'],['percent','%']]
                  : [['fixed','Fixed'],['variable','Variable']]
                ).map(([mode,lbl])=>(
                  <button key={mode} type="button"
                    onClick={()=> {
                      if (fee.feeType === 'Transaction Fee') { u('transactionFeeIsPercent', mode==='percent'); }
                      else { u('resourceFeeIsVariable', mode==='variable'); }
                    }}
                    className="text-[10px] px-2 py-0.5 rounded-md font-bold transition-all"
                    style={
                      (fee.feeType === 'Transaction Fee'
                        ? ((!fee.transactionFeeIsPercent&&mode==='fixed')||(fee.transactionFeeIsPercent&&mode==='percent'))
                        : ((!fee.resourceFeeIsVariable&&mode==='fixed')||(fee.resourceFeeIsVariable&&mode==='variable'))
                      ) ? {background:NAVY,color:'#fff'} : {color:'#94a3b8'}
                    }>{lbl}</button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <input value={fee.commercialValue||''} onChange={e=>u('commercialValue',e.target.value)}
              placeholder={fee.transactionFeeIsPercent?'e.g. 1.5':isOT?'e.g. 50000':'e.g. 25000 per cycle'}
              className={`${inp} w-full font-mono`} style={s6}/>
            {fee.transactionFeeIsPercent && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-brand-faint">%</span>
            )}
          </div>
          {cycles && fee.commercialValue && !fee.transactionFeeIsPercent && fee.feeType !== 'Transaction Fee' && fee.feeType !== 'Usage Fee' && !(fee.feeType === 'Resource Fee' && fee.resourceFeeIsVariable) && (
            <p className="text-[10px] mt-1 text-green-600">
              {parseFloat(fee.commercialValue).toLocaleString('en-IN')} × {cycles} cycles = {(parseFloat(fee.commercialValue)*cycles).toLocaleString('en-IN')} over term
            </p>
          )}
          {fee.transactionFeeIsPercent && fee.commercialValue && (
            <p className="text-[10px] mt-1 text-blue-600">{fee.commercialValue}% per transaction · billed {fee.billingCycle?.toLowerCase()||'as agreed'} · variable</p>
          )}
          {!fee.transactionFeeIsPercent && fee.feeType === 'Transaction Fee' && fee.commercialValue && (
            <p className="text-[10px] mt-1 text-blue-600">Variable — excluded from OF value calculation</p>
          )}
          {fee.feeType === 'Resource Fee' && fee.resourceFeeIsVariable && (
            <p className="text-[10px] mt-1 text-blue-600">Variable — excluded from OF value calculation</p>
          )}
        </div>
      )}

      {/* ── Step-up pricing ── */}
      {canStep && !fee.isLogistics && fee.pricingModel==='flat' && (
        <div className="mb-3">
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer mb-2 text-slate-600">
            <input type="checkbox" checked={fee.stepUpPricing||false} onChange={e=>u('stepUpPricing',e.target.checked)}/> Step-up pricing
          </label>
          {fee.stepUpPricing && (
            <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 space-y-3">
              <p className="text-[10px] text-amber-700 font-medium">
                Each period has its own date range, billing cycle, and rate. OF contribution = rate × cycles in that period.
              </p>
              {(fee.stepUpValues||[]).map((sv, i) => {
                const rate   = parseFloat(sv.rate != null ? sv.rate : sv.value) || 0;
                const cycles = (sv.startDate && sv.endDate && sv.billingCycle)
                  ? cyclesInDateRange(sv.startDate, sv.endDate, sv.billingCycle) : null;
                const updSv = patch => u('stepUpValues', (fee.stepUpValues||[]).map((s,j) => j===i ? {...s,...patch} : s));
                return (
                  <div key={sv.id||i} className="rounded-lg border border-amber-200 bg-white p-3">
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Period {i+1}</span>
                      <button type="button" onClick={()=>u('stepUpValues',(fee.stepUpValues||[]).filter((_,j)=>j!==i))}
                        className="text-xs text-red-500">✕ Remove</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">Start date</div>
                        <input type="date" value={sv.startDate||''} onChange={e=>updSv({startDate:e.target.value})}
                          className="w-full text-xs px-2 py-1.5 rounded-lg border focus:outline-none bg-white" style={{borderColor:'#fcd34d'}}/>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">End date</div>
                        <input type="date" value={sv.endDate||''} onChange={e=>updSv({endDate:e.target.value})}
                          className="w-full text-xs px-2 py-1.5 rounded-lg border focus:outline-none bg-white" style={{borderColor:'#fcd34d'}}/>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">Billing cycle</div>
                        <select value={sv.billingCycle||''} onChange={e=>updSv({billingCycle:e.target.value})}
                          className="w-full text-xs px-2 py-1.5 rounded-lg border focus:outline-none bg-white" style={{borderColor:'#fcd34d'}}>
                          <option value="">Select…</option>
                          {['Monthly','Quarterly','Bi-Annually','Annually','One Time'].map(o=><option key={o}>{o}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">Rate per cycle ({sym})</div>
                        <input type="number" value={sv.rate != null ? sv.rate : (sv.value||'')}
                          onChange={e=>updSv({rate:e.target.value, value:e.target.value})}
                          placeholder="0" min="0"
                          className="w-full text-xs px-2 py-1.5 rounded-lg border focus:outline-none bg-white font-mono" style={{borderColor:'#fcd34d'}}/>
                      </div>
                    </div>
                    {cycles !== null && rate > 0 ? (
                      <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-amber-100 border border-amber-200 text-[11px] font-semibold text-amber-800">
                        {sym}{rate.toLocaleString('en-IN')} × {cycles} {sv.billingCycle} cycle{cycles!==1?'s':''} = <span style={{color:NAVY}}>{sym}{(rate*cycles).toLocaleString('en-IN')}</span>
                      </div>
                    ) : sv.startDate && sv.endDate && !sv.billingCycle ? (
                      <p className="mt-1.5 text-[10px] text-amber-600">← Select a billing cycle to calculate</p>
                    ) : null}
                  </div>
                );
              })}
              <button type="button"
                onClick={()=>u('stepUpValues',[...(fee.stepUpValues||[]),{id:uid(),startDate:'',endDate:'',billingCycle:'Monthly',rate:'',value:''}])}
                className="text-xs font-semibold text-amber-800 hover:text-amber-900">+ Add period</button>
              {(fee.stepUpValues||[]).length > 1 && (() => {
                const stepTotal = (fee.stepUpValues||[]).reduce((sum, sv) => {
                  const r = parseFloat(sv.rate != null ? sv.rate : sv.value) || 0;
                  const c = (sv.startDate && sv.endDate && sv.billingCycle)
                    ? cyclesInDateRange(sv.startDate, sv.endDate, sv.billingCycle) : 0;
                  return sum + r * c;
                }, 0);
                return stepTotal > 0 ? (
                  <div className="pt-2 border-t border-amber-200 text-[11px] font-bold text-amber-900">
                    Total across all periods: {sym}{stepTotal.toLocaleString('en-IN')}
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      )}

      {!isOT && !fee.isLogistics && (
        <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2 text-blue-700">Usage cycle</div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs cursor-pointer text-slate-600">
              <input type="checkbox" checked={fee.usageCycleDiffers||false} onChange={e=>u('usageCycleDiffers',e.target.checked)}/>
              Usage cycle differs from billing cycle
            </label>
            {fee.usageCycleDiffers && (
              <select value={fee.usageCycle||''} onChange={e=>u('usageCycle',e.target.value)} className="text-xs px-2 py-1 rounded border bg-white" style={{borderColor:'#e2e8f0'}}>
                <option value="">Select…</option>
                {['Monthly','Quarterly','Bi-Annually','Annually'].map(o=><option key={o}>{o}</option>)}
              </select>
            )}
          </div>
        </div>
      )}
      <div className="mb-3">
        <InclusionsField value={fee.inclusions} onChange={arr => u('inclusions', arr)}/>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">Payment trigger</div>
          <select
            value={fee.isCustomPaymentTrigger ? '__custom__' : (fee.paymentTrigger||'')}
            onChange={e => {
              if (e.target.value === '__custom__') onChange({ ...fee, isCustomPaymentTrigger: true, paymentTrigger: '' });
              else onChange({ ...fee, isCustomPaymentTrigger: false, paymentTrigger: e.target.value });
            }} className={inp} style={s6}>
            {PAY_TRIGGERS.map(o=><option key={o} value={o}>{o||'— None —'}</option>)}
            <option value="__custom__">Custom…</option>
          </select>
          {fee.isCustomPaymentTrigger && (
            <input value={fee.paymentTrigger||''} onChange={e=>u('paymentTrigger',e.target.value)}
              placeholder="Enter payment trigger…" className={`${inp} w-full mt-1.5`} style={{borderColor:'#00C3B5'}}/>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Service block ─────────────────────────────────────────────────────────────
function SvcBlock({ svc, idx, onChange, onRemove, termMonths, ro, currency, isFinance,
                    onDragStart, onDragOver, onDrop, onDragEnd, isDragOver }) {
  const letter     = String.fromCharCode(97 + idx);
  const subOptions = SUB_SERVICES[svc.name] || [];
  const selected   = svc.subServices || [];
  const isGaaS     = isSkuService(svc.name);
  const sym        = getSym(currency || 'INR');
  const bu         = svc.bu || buForService(svc.name);

  const addFee  = () => onChange({ ...svc, fees:[...(svc.fees||[]), newFee()] });
  const updFee  = (fi,u) => onChange({ ...svc, fees:svc.fees.map((f,i)=>i===fi?u:f) });
  const remFee  = fi => onChange({ ...svc, fees:svc.fees.filter((_,i)=>i!==fi) });
  const toggleSub = val => onChange({ ...svc, subServices: selected.includes(val) ? selected.filter(v=>v!==val) : [...selected, val] });

  // ── Fee drag-and-drop (within this service block) ─────────────────────────
  const dragFeeIdx    = useRef(null);
  const [dragOverFeeIdx, setDragOverFeeIdx] = useState(null);

  const handleFeeDragStart = (i) => { dragFeeIdx.current = i; };
  const handleFeeDragOver  = (e, i) => { e.preventDefault(); setDragOverFeeIdx(i); };
  const handleFeeDrop      = (i) => {
    if (dragFeeIdx.current === null || dragFeeIdx.current === i) { setDragOverFeeIdx(null); return; }
    const fees = [...(svc.fees||[])];
    const [moved] = fees.splice(dragFeeIdx.current, 1);
    fees.splice(i, 0, moved);
    onChange({ ...svc, fees });
    dragFeeIdx.current = null;
    setDragOverFeeIdx(null);
  };
  const handleFeeDragEnd = () => { dragFeeIdx.current = null; setDragOverFeeIdx(null); };

  return (
    <div
      draggable={!ro}
      onDragStart={!ro ? onDragStart : undefined}
      onDragOver={!ro ? onDragOver : undefined}
      onDrop={!ro ? onDrop : undefined}
      onDragEnd={!ro ? onDragEnd : undefined}
      className="border rounded-2xl mb-4 overflow-hidden transition-all"
      style={{
        borderColor: isDragOver ? T : (isGaaS ? '#99f6e4' : '#e2e8f0'),
        boxShadow: isDragOver ? `0 0 0 2px ${T}` : 'none',
        opacity: isDragOver ? 0.85 : 1,
      }}>

      <div className="flex items-center justify-between px-5 py-3 border-b"
        style={{background: isGaaS ? '#f0fdfa' : '#f8fafc', borderColor: isGaaS ? '#99f6e4' : '#e2e8f0'}}>
        <div className="flex items-center gap-3">
          {/* Service drag handle */}
          {!ro && <DragHandle />}
          <span className="text-xs font-bold text-brand-faint">{letter}.</span>
          {ro
            ? <span className="text-sm font-semibold" style={{color:NAVY}}>{svc.name||'—'}</span>
            : <div className="flex flex-col gap-1">
                <select value={svc.isCustomService ? '__others__' : (svc.name||'')}
                  onChange={e => {
                    if (e.target.value === '__others__') {
                      onChange({...svc, name:'', isCustomService:true, subServices:[], gaas_lines:[], gaas_total:0, bu:''});
                    } else {
                      onChange({...svc, name:e.target.value, isCustomService:false, subServices:[], gaas_lines:[], gaas_total:0, bu:buForService(e.target.value)});
                    }
                  }}
                  className="text-sm font-semibold border-none bg-transparent focus:outline-none cursor-pointer" style={{color:NAVY}}>
                  <option value="">Select service…</option>
                  {SERVICES.map(s=><option key={s}>{s}</option>)}
                  <option value="__others__">Others…</option>
                </select>
                {svc.isCustomService && (
                  <input value={svc.name||''} onChange={e=>onChange({...svc, name:e.target.value})}
                    placeholder="Enter service name…" className="text-xs px-2 py-1 rounded-lg border"
                    style={{borderColor:'#00C3B5', color:NAVY, background:'#fff'}}/>
                )}
              </div>}
          {isGaaS && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">SKU-based</span>}

          {/* Business Unit — auto-tagged from the service, editable by Finance only. Internal reporting use. */}
          <div className="flex items-center gap-1.5 ml-1" title="Business Unit — internal reporting only">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">BU</span>
            {isFinance && !ro ? (
              <select value={bu} onChange={e=>onChange({...svc, bu:e.target.value})}
                className="text-[11px] font-semibold rounded-lg border px-1.5 py-0.5 cursor-pointer"
                style={{borderColor:'#cbd5e1', color:NAVY, background:'#fff'}}>
                <option value="">— Select BU —</option>
                {BUSINESS_UNITS.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{bu || '—'}</span>
            )}
          </div>
        </div>
        {!ro && <button type="button" onClick={onRemove} className="text-xs font-medium text-red-500">Remove</button>}
      </div>

      <div className="p-5">
        {isGaaS ? (
          <div>
            <div className="mb-3 p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs">
              <strong>Fynd Create</strong> — SKU-based commercials. PDF will show as <strong>"Garment Sale"</strong>. Enter SKU-level commercials below. Revenue is auto-calculated from the SKU total.
            </div>
            <GaasSKUBlock svc={svc} onChange={s=>onChange(s)} ro={ro} currency={currency}/>
          </div>
        ) : (
          <>
            {subOptions.length > 0 && (
              <div className="mb-4 p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2 text-brand-faint">
                  Sub-services <span className="text-[9px] font-normal normal-case tracking-normal text-slate-400">(select all that apply)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {subOptions.map(opt => {
                    const active = selected.includes(opt);
                    return (
                      <button key={opt} type="button" onClick={()=>!ro&&toggleSub(opt)}
                        className="text-xs px-3 py-1.5 rounded-full font-semibold border transition-all"
                        style={active?{background:NAVY,color:'#fff',borderColor:NAVY}:{background:'#fff',color:'#64748b',borderColor:'#e2e8f0'}}>
                        {active?'✓ ':''}{opt}
                      </button>
                    );
                  })}
                </div>
                {selected.length > 0 && <p className="text-[10px] mt-2 text-brand-faint">Selected: {selected.join(' · ')}</p>}
              </div>
            )}

            {/* ── Fee rows with per-fee drag ── */}
            {(svc.fees||[]).map((fee, fi) => (
              ro ? (
                <div key={fee.id} className="border rounded-xl p-3 mb-2 text-xs bg-slate-50" style={{borderColor:'#e2e8f0'}}>
                  <div className="flex flex-wrap gap-x-2 gap-y-1 items-baseline">
                    <span className="font-semibold" style={{color:NAVY}}>{fee.feeType}</span>
                    {fee.billingCycle && <span className="text-brand-muted">· {fee.billingCycle}</span>}
                    {fee.isLogistics
                      ? <span className="text-brand-muted">· As per rate card
                          {fee.logisticsRateCard && <> (<a href={fee.logisticsRateCard} target="_blank" rel="noreferrer" className="underline" style={{color:T}}>link</a>)</>}
                        </span>
                      : fee.pricingModel === 'graduated'
                        ? <span className="text-brand-muted">· Slabs:&nbsp;
                            {(fee.slabs||[]).map((sl,si) => (
                              <span key={sl.id||si} className="font-mono">
                                {sl.from}–{sl.to||'∞'} @ {sl.rate} {sl.rateType==='Others' ? sl.rateTypeCustom : sl.rateType}
                                {si < (fee.slabs||[]).length - 1 ? ',  ' : ''}
                              </span>
                            ))}
                          </span>
                        : fee.stepUpPricing && (fee.stepUpValues||[]).length > 0
                          ? <span className="text-brand-muted">· Step-up:&nbsp;
                              {(fee.stepUpValues||[]).map((sv, si) => {
                                const rate = parseFloat(sv.rate != null ? sv.rate : sv.value) || 0;
                                const cycles = (sv.startDate && sv.endDate && sv.billingCycle)
                                  ? cyclesInDateRange(sv.startDate, sv.endDate, sv.billingCycle) : null;
                                const label = (sv.startDate && sv.endDate) ? `${sv.startDate} – ${sv.endDate}` : (sv.label || `Period ${si+1}`);
                                return (
                                  <span key={sv.id||si} className="font-mono">
                                    {label}{sv.billingCycle ? ` (${sv.billingCycle})` : ''}:
                                    {' '}{sym}{rate.toLocaleString('en-IN')}/cycle
                                    {cycles ? ` × ${cycles} = ${sym}${(rate*cycles).toLocaleString('en-IN')}` : ''}
                                    {si < (fee.stepUpValues||[]).length - 1 ? ',  ' : ''}
                                  </span>
                                );
                              })}
                            </span>
                          : <span className="font-mono font-semibold" style={{color:NAVY}}>
                              · {fee.commercialValue||'—'}{fee.transactionFeeIsPercent?'%':''}{fee.resourceFeeIsVariable?' (variable)':''}
                            </span>
                    }
                    {toIncArray(fee.inclusions).length > 0 && (
                      <span className="text-brand-muted">· Inclusions: {toIncArray(fee.inclusions).map(incLabel).join(', ')}</span>
                    )}
                    {fee.paymentTrigger && <span className="text-brand-muted">· {fee.paymentTrigger}</span>}
                  </div>
                </div>
              ) : (
                // ── Draggable fee row wrapper ──
                <div
                  key={fee.id}
                  draggable
                  onDragStart={e => { e.stopPropagation(); handleFeeDragStart(fi); }}
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); handleFeeDragOver(e, fi); }}
                  onDrop={e => { e.stopPropagation(); handleFeeDrop(fi); }}
                  onDragEnd={e => { e.stopPropagation(); handleFeeDragEnd(); }}
                  className="transition-all"
                  style={{
                    borderRadius: '12px',
                    outline: dragOverFeeIdx === fi ? `2px solid ${T}` : 'none',
                    opacity: dragFeeIdx.current === fi ? 0.5 : 1,
                  }}>
                  {/* Fee drag handle strip */}
                  <div className="flex items-center gap-1.5 px-3 pt-2 pb-0 cursor-grab active:cursor-grabbing"
                    style={{color:'#cbd5e1'}}>
                    <DragHandle />
                    <span className="text-[10px] font-medium text-slate-300 select-none">drag to reorder</span>
                  </div>
                  <FeeRow fee={fee} idx={fi} onChange={u=>updFee(fi,u)} onRemove={()=>remFee(fi)} termMonths={termMonths} currency={currency}/>
                </div>
              )
            ))}

            {!ro && (
              <button type="button" onClick={addFee}
                className="w-full text-sm font-medium py-2.5 rounded-xl border-2 border-dashed transition-all border-slate-200 text-slate-500 hover:border-teal hover:text-teal">
                + Add fee row to {svc.name||'service'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── StepFees ──────────────────────────────────────────────────────────────────
export default function StepFees({ form, set, ro }) {
  const { user }   = useAuth();
  const isFinance  = user?.role === 'finance' || user?.isUniversal;
  const services   = form.services_fees || [];
  const termMonths = form.of_term_months || 12;
  const isGaaSForm = services.some(s => isSkuService(s.name));

  const addSvc  = () => set('services_fees', [...services, {id:uid(), name:'', subServices:[], fees:[newFee()], gaas_lines:[], gaas_total:0, bu:''}]);
  const updSvc  = (i,s) => set('services_fees', services.map((sv,j)=>j===i?s:sv));
  const remSvc  = i => set('services_fees', services.filter((_,j)=>j!==i));
  const isBundle= services.length > 1;

  // ── Service drag-and-drop ─────────────────────────────────────────────────
  const dragSvcIdx    = useRef(null);
  const [dragOverSvcIdx, setDragOverSvcIdx] = useState(null);

  const handleSvcDragStart = (i) => { dragSvcIdx.current = i; };
  const handleSvcDragOver  = (e, i) => { e.preventDefault(); setDragOverSvcIdx(i); };
  const handleSvcDrop      = (i) => {
    if (dragSvcIdx.current === null || dragSvcIdx.current === i) { setDragOverSvcIdx(null); return; }
    const reordered = [...services];
    const [moved] = reordered.splice(dragSvcIdx.current, 1);
    reordered.splice(i, 0, moved);
    set('services_fees', reordered);
    dragSvcIdx.current = null;
    setDragOverSvcIdx(null);
  };
  const handleSvcDragEnd = () => { dragSvcIdx.current = null; setDragOverSvcIdx(null); };

  useEffect(() => {
    if (ro) return;
    const gaasRevenue = services.filter(s=>isSkuService(s.name)).reduce((sum,s)=>sum+(s.gaas_total||0),0);
    if (isGaaSForm) {
      if (form.committed_revenue !== String(gaasRevenue) && form.committed_revenue !== gaasRevenue) {
        set('committed_revenue', gaasRevenue || '');
        set('of_value', gaasRevenue || '');
        set('arr_text', gaasRevenue > 0 ? 'Garment Sale: ' + gaasRevenue.toLocaleString('en-IN') : '');
      }
      return;
    }
    const { arrText, committed } = calcMetrics(services, termMonths);
    const ofv = calcOFValue(services, termMonths);
    if (form.arr_text !== arrText || form.committed_revenue !== committed || form.of_value !== ofv) {
      set('arr_text', arrText);
      set('committed_revenue', committed || '');
      set('of_value', ofv || '');
    }
  }, [JSON.stringify(services), termMonths]); // eslint-disable-line

  return (
    <div>
      {!isGaaSForm && (
        <div className={`flex items-center justify-between mb-4 px-4 py-3 rounded-xl border ${isBundle?'bg-green-50 border-green-200':'bg-slate-50 border-slate-200'}`}>
          <span className={`text-sm font-semibold ${isBundle?'text-green-800':'text-slate-500'}`}>Bundle: <strong>{isBundle?'Yes':'No'}</strong></span>
          <span className={`text-xs font-bold ${isBundle?'text-green-700':'text-brand-faint'}`}>{services.length} service{services.length!==1?'s':''}</span>
        </div>
      )}
      {isGaaSForm && (
        <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl bg-teal-50 border border-teal-200">
          <span className="text-sm font-semibold text-teal-800">Fynd Create — SKU-based pricing</span>
          <span className="text-xs text-teal-600">PDF will be generated as Order Confirmation</span>
        </div>
      )}

      {!ro && services.length > 1 && (
        <p className="text-[11px] text-slate-400 mb-3 flex items-center gap-1.5">
          <span style={{fontSize:'16px'}}>⠿</span> Drag the grip icon on a service or fee row to reorder it.
        </p>
      )}

      {services.map((svc,i) => (
        <SvcBlock
          key={svc.id}
          svc={svc} idx={i} termMonths={termMonths} ro={ro} isFinance={isFinance}
          currency={form.committed_currency||'INR'}
          onChange={s=>!ro&&updSvc(i,s)}
          onRemove={()=>!ro&&remSvc(i)}
          isDragOver={dragOverSvcIdx === i}
          onDragStart={() => handleSvcDragStart(i)}
          onDragOver={e => handleSvcDragOver(e, i)}
          onDrop={() => handleSvcDrop(i)}
          onDragEnd={handleSvcDragEnd}
        />
      ))}

      {!ro && (
        <button type="button" onClick={addSvc}
          className="w-full py-3 text-sm font-semibold rounded-xl border-2 border-dashed transition-all mb-5"
          style={{borderColor:T, color:T}}>
          + Add service
        </button>
      )}

      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
        <SHdr c="Revenue metrics"/>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Lbl c="OF value (auto)"/>
            <input value={form.of_value||''} onChange={e=>!ro&&set('of_value',e.target.value)} disabled={ro} className="field-input font-mono"/>
          </div>
          <div className="col-span-2">
            <Lbl c={isGaaSForm ? 'Garment Sale total (auto)' : 'ARR breakdown (auto)'}/>
            <textarea rows={3} value={form.arr_text||''} onChange={e=>!ro&&set('arr_text',e.target.value)} disabled={ro} className="field-input resize-none text-xs font-mono"/>
          </div>
        </div>
        <div>
          <Lbl c="Committed revenue (auto)"/>
          <input value={form.committed_revenue||''} onChange={e=>!ro&&set('committed_revenue',e.target.value)} disabled={ro} className="field-input font-mono"/>
        </div>
      </div>
    </div>
  );
}
