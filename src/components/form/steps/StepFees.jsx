import { useEffect } from 'react';
import { Lbl, SHdr, Btn } from '../../ui/index.jsx';
import { SERVICES, FEE_TYPES, FEE_RULES, UNIT_METRICS, PAY_TRIGGERS,
         GRADUATED_ELIGIBLE, STEP_UP_ELIGIBLE, SLAB_RATE_UNITS } from '../../../constants/formOptions.js';
import { uid } from '../../../utils/dates.js';
import { cyclesInTerm, getSym } from '../../../utils/formatting.js';
import { calcMetrics, calcOFValue } from '../../../utils/calculations.js';
import { newFee } from '../../../hooks/useFormWizard.js';

const T = '#00C3B5'; const NAVY = '#1B2B4B';

// ── FEE ROW ────────────────────────────────────────────────────────────────
function FeeRow({ fee, onChange, onRemove, idx, termMonths, currency }) {
  const u = (k,v) => onChange({ ...fee, [k]:v });
  const sym = getSym(currency || 'INR');
  const rules = FEE_RULES[fee.feeType] || {};
  const cycleOpts = rules.locked ? [] : (rules.opts || ['Monthly','Quarterly','Bi-Annually','Annually','One Time']);
  const isOT   = fee.billingCycle === 'One Time';
  const canGrad= GRADUATED_ELIGIBLE.includes(fee.feeType);
  const canStep= STEP_UP_ELIGIBLE.includes(fee.feeType) && !isOT;
  const cycles = termMonths && fee.billingCycle && !isOT ? cyclesInTerm(fee.billingCycle, termMonths) : null;

  // Build dynamic slab rate options with currency symbol
  const slabRateOpts = SLAB_RATE_UNITS.map(u =>
    u.startsWith('%') ? u : `${sym} ${u}`
  );

  const handleFeeType = ft => {
    const r = FEE_RULES[ft] || {};
    const bc = r.locked || (r.opts?.[0]) || '';
    onChange({ ...fee, feeType:ft, billingCycle:bc, billingCycleLocked:!!r.locked, isLogistics:ft==='Logistics Fee', pricingModel:'flat' });
  };

  const updSlab = (si, field, val) => {
    const slabs = fee.slabs.map((s,i) => i===si ? {...s,[field]:val} : s);
    if (field==='to' && fee.slabs[si+1]) slabs[si+1] = {...slabs[si+1], from:String(parseInt(val||0)+1)};
    u('slabs', slabs);
  };

  const s6 = { borderColor:'#e2e8f0' };
  const inp = 'w-full text-xs px-2 py-1.5 rounded-lg border focus:outline-none bg-white';

  return (
    <div className="border rounded-xl p-4 mb-3 bg-slate-50" style={{ borderColor:'#e2e8f0' }}>
      <div className="flex justify-between mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-faint">Fee row {idx+1}</span>
        <button type="button" onClick={onRemove} className="text-xs font-medium text-red-500">✕ Remove</button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">Fee type *</div>
          <select value={fee.feeType} onChange={e=>handleFeeType(e.target.value)} className={inp} style={s6}>
            <option value="">Select…</option>
            {FEE_TYPES.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">
            Billing cycle{fee.billingCycleLocked && <span className="text-green-500 normal-case tracking-normal"> (auto)</span>}
          </div>
          {fee.billingCycleLocked
            ? <input value={fee.billingCycle} readOnly className={inp} style={{ ...s6, background:'#f8fafc', color:'#64748b' }}/>
            : <select value={fee.billingCycle} onChange={e=>u('billingCycle',e.target.value)} className={inp} style={s6}>
                <option value="">Select…</option>
                {cycleOpts.map(o => <option key={o}>{o}</option>)}
              </select>
          }
        </div>
        {canGrad && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">Pricing model</div>
            <div className="flex gap-1">
              {['flat','graduated'].map(pm => (
                <button key={pm} type="button" onClick={()=>u('pricingModel',pm)}
                  className="flex-1 text-xs py-1.5 rounded-lg font-semibold border transition-all"
                  style={fee.pricingModel===pm ? {background:NAVY,color:'#fff',borderColor:NAVY} : {background:'#f8fafc',color:'#64748b',borderColor:'#e2e8f0'}}>
                  {pm==='flat'?'Flat':'Graduated'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Logistics URL */}
      {fee.isLogistics && (
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">Rate card URL</div>
          <input value={fee.logisticsRateCard||''} onChange={e=>u('logisticsRateCard',e.target.value)} className={`${inp} w-full`} style={s6}/>
          <p className="text-[10px] mt-1 text-brand-faint">Renders as "As per rate card" in PDF</p>
        </div>
      )}

      {/* Graduated slabs */}
      {!fee.isLogistics && fee.pricingModel==='graduated' && (
        <div className="mb-3 rounded-lg p-3 bg-slate-100 border border-slate-200">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-2 text-slate-600">Slab tiers</div>
          <div className="grid gap-1 mb-1" style={{ gridTemplateColumns:'1fr 1fr 1fr 1.2fr 20px' }}>
            {['From','To','Rate','Rate type',''].map((h,i) => (
              <div key={i} className="text-[9px] font-bold uppercase tracking-wider text-brand-faint">{h}</div>
            ))}
          </div>
          {(fee.slabs||[]).map((sl,si) => (
            <div key={sl.id} className="grid gap-1 mb-1.5 items-center" style={{ gridTemplateColumns:'1fr 1fr 1fr 1.2fr 20px' }}>
              <input value={sl.from} readOnly={si>0} onChange={e=>updSlab(si,'from',e.target.value)} className={`${inp} font-mono`} style={{...s6,background:si>0?'#f8fafc':'#fff'}}/>
              <input value={sl.to} onChange={e=>updSlab(si,'to',e.target.value)} placeholder="∞" className={`${inp} font-mono`} style={s6}/>
              <input value={sl.rate} onChange={e=>updSlab(si,'rate',e.target.value)} placeholder="0.00" className={`${inp} font-mono`} style={s6}/>
              <select value={sl.rateType} onChange={e=>updSlab(si,'rateType',e.target.value)} className={`${inp}`} style={s6}>
                {slabRateOpts.map(o => <option key={o}>{o}</option>)}
              </select>
              <button type="button" onClick={()=>{ if((fee.slabs||[]).length>1) u('slabs',(fee.slabs||[]).filter((_,i)=>i!==si)); }} className="text-xs text-red-500">✕</button>
            </div>
          ))}
          <button type="button" onClick={()=>u('slabs',[...(fee.slabs||[]),{id:uid(),from:String(parseInt((fee.slabs||[]).at(-1)?.to||'0')+1),to:'',rate:'',rateType:'₹ per unit'}])} className="text-xs font-medium mt-1" style={{color:T}}>+ Add slab tier</button>
        </div>
      )}

      {/* Commercial value */}
      {!fee.isLogistics && fee.pricingModel!=='graduated' && (
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">Commercial value *</div>
          <input value={fee.commercialValue||''} onChange={e=>u('commercialValue',e.target.value)}
            placeholder={isOT?'e.g. 50000':'e.g. 25000 per cycle'}
            className={`${inp} w-full font-mono`} style={s6}/>
          {cycles && fee.commercialValue && (
            <p className="text-[10px] mt-1 text-green-600">
              ✓ {parseFloat(fee.commercialValue).toLocaleString('en-IN')} × {cycles} cycles = {(parseFloat(fee.commercialValue)*cycles).toLocaleString('en-IN')} over term
            </p>
          )}
        </div>
      )}

      {/* Step-up pricing */}
      {canStep && !fee.isLogistics && fee.pricingModel==='flat' && (
        <div className="mb-3">
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer mb-2 text-slate-600">
            <input type="checkbox" checked={fee.stepUpPricing||false} onChange={e=>u('stepUpPricing',e.target.checked)}/> Step-up pricing
          </label>
          {fee.stepUpPricing && (
            <div className="rounded-lg p-3 bg-amber-50 border border-amber-200">
              {(fee.stepUpValues||[]).map((sv,i) => (
                <div key={sv.id||i} className="flex gap-2 mb-2 items-center">
                  <input value={sv.label} onChange={e=>u('stepUpValues',(fee.stepUpValues||[]).map((s,j)=>j===i?{...s,label:e.target.value}:s))}
                    placeholder="e.g. 1 Jul 2025 – 28 Feb 2026" className="flex-1 text-xs px-2 py-1 rounded border" style={{borderColor:'#fcd34d'}}/>
                  <input value={sv.value} onChange={e=>u('stepUpValues',(fee.stepUpValues||[]).map((s,j)=>j===i?{...s,value:e.target.value}:s))}
                    placeholder="Amount" className="w-28 text-xs px-2 py-1 rounded border font-mono" style={{borderColor:'#fcd34d'}}/>
                  <button type="button" onClick={()=>u('stepUpValues',(fee.stepUpValues||[]).filter((_,j)=>j!==i))} className="text-xs text-red-500">✕</button>
                </div>
              ))}
              <button type="button" onClick={()=>u('stepUpValues',[...(fee.stepUpValues||[]),{id:uid(),label:'',value:''}])}
                className="text-xs font-medium text-amber-800">+ Add period</button>
            </div>
          )}
        </div>
      )}

      {/* Usage cycle — visible for all non-one-time fees */}
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

      {/* Bottom meta row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          ['inclusions','Inclusions','e.g. 6,000 bags'],
          ['unitMetric','Unit / metric',null,UNIT_METRICS],
          ['paymentTrigger','Payment trigger',null,PAY_TRIGGERS],
        ].map(([key,lbl,ph,opts]) => (
          <div key={key}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-1 text-brand-faint">{lbl}</div>
            {opts
              ? <select value={fee[key]||''} onChange={e=>u(key,e.target.value)} className={inp} style={s6}>
                  {opts.map(o => <option key={o} value={o}>{o||'— None —'}</option>)}
                </select>
              : <input value={fee[key]||''} onChange={e=>u(key,e.target.value)} placeholder={ph} className={`${inp} w-full`} style={s6}/>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SERVICE BLOCK ──────────────────────────────────────────────────────────
function SvcBlock({ svc, idx, onChange, onRemove, termMonths, ro, currency }) {
  const letter = String.fromCharCode(97 + idx);
  const addFee    = () => onChange({ ...svc, fees:[...(svc.fees||[]), newFee()] });
  const updFee    = (fi,u) => onChange({ ...svc, fees:svc.fees.map((f,i)=>i===fi?u:f) });
  const remFee    = fi => onChange({ ...svc, fees:svc.fees.filter((_,i)=>i!==fi) });

  return (
    <div className="border rounded-2xl mb-4 overflow-hidden" style={{ borderColor:'#e2e8f0' }}>
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-brand-faint">{letter}.</span>
          {ro
            ? <span className="text-sm font-semibold text-navy">{svc.name||'—'}</span>
            : <select value={svc.name||''} onChange={e=>onChange({...svc,name:e.target.value})}
                className="text-sm font-semibold border-none bg-transparent focus:outline-none cursor-pointer text-navy">
                <option value="">Select service…</option>
                {SERVICES.map(s => <option key={s}>{s}</option>)}
              </select>
          }
        </div>
        {!ro && <button type="button" onClick={onRemove} className="text-xs font-medium text-red-500">Remove</button>}
      </div>
      <div className="p-5">
        {(svc.fees||[]).map((fee,fi) => (
          ro
            ? <div key={fee.id} className="border rounded-xl p-3 mb-2 text-xs bg-slate-50" style={{ borderColor:'#e2e8f0' }}>
                <span className="font-semibold text-navy">{fee.feeType}</span> · {fee.billingCycle} · {fee.isLogistics?'As per rate card':fee.pricingModel==='graduated'?'Variable':fee.commercialValue||'—'}
                {fee.inclusions && <span className="text-brand-muted"> · Inclusions: {fee.inclusions}</span>}
              </div>
            : <FeeRow key={fee.id} fee={fee} idx={fi} onChange={u=>updFee(fi,u)} onRemove={()=>remFee(fi)} termMonths={termMonths} currency={currency}/>
        ))}
        {!ro && (
          <button type="button" onClick={addFee}
            className="w-full text-sm font-medium py-2.5 rounded-xl border-2 border-dashed transition-all border-slate-200 text-slate-500 hover:border-teal hover:text-teal">
            + Add fee row to {svc.name||'service'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── STEP FEES ──────────────────────────────────────────────────────────────
export default function StepFees({ form, set, ro }) {
  const services   = form.services_fees || [];
  const termMonths = form.of_term_months || 12;

  const addSvc  = () => set('services_fees', [...services, { id:uid(), name:'', fees:[newFee()] }]);
  const updSvc  = (i,s) => set('services_fees', services.map((sv,j)=>j===i?s:sv));
  const remSvc  = i => set('services_fees', services.filter((_,j)=>j!==i));
  const isBundle= services.length > 1;

  useEffect(() => {
    if (ro) return;
    const { arrText, committed } = calcMetrics(services, termMonths);
    const ofv = calcOFValue(services, termMonths);
    // Batch update — avoid loops by setting directly
    if (form.arr_text !== arrText || form.committed_revenue !== committed || form.of_value !== ofv) {
      set('arr_text', arrText);
      set('committed_revenue', committed || '');
      set('of_value', ofv || '');
    }
  }, [JSON.stringify(services), termMonths]); // eslint-disable-line

  return (
    <div>
      {/* Bundle badge */}
      <div className={`flex items-center justify-between mb-4 px-4 py-3 rounded-xl border ${isBundle?'bg-green-50 border-green-200':'bg-slate-50 border-slate-200'}`}>
        <span className={`text-sm font-semibold ${isBundle?'text-green-800':'text-slate-500'}`}>
          Bundle: <strong>{isBundle?'Yes':'No'}</strong>
        </span>
        <span className={`text-xs font-bold ${isBundle?'text-green-700':'text-brand-faint'}`}>
          {services.length} service{services.length!==1?'s':''}
        </span>
      </div>

      {services.map((svc,i) => (
        <SvcBlock key={svc.id} svc={svc} idx={i} termMonths={termMonths} ro={ro} currency={form.committed_currency||'INR'}
          onChange={s=>!ro&&updSvc(i,s)} onRemove={()=>!ro&&remSvc(i)}/>
      ))}

      {!ro && (
        <button type="button" onClick={addSvc}
          className="w-full py-3 text-sm font-semibold rounded-xl border-2 border-dashed transition-all mb-5"
          style={{ borderColor:T, color:T }}>
          + Add service
        </button>
      )}

      {/* Revenue metrics */}
      <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
        <SHdr c="Revenue metrics"/>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Lbl c="OF value (auto)"/>
            <input value={form.of_value||''} onChange={e=>!ro&&set('of_value',e.target.value)}
              disabled={ro} className="field-input font-mono"/>
          </div>
          <div className="col-span-2">
            <Lbl c="ARR breakdown (auto)"/>
            <textarea rows={3} value={form.arr_text||''} onChange={e=>!ro&&set('arr_text',e.target.value)}
              disabled={ro} className="field-input resize-none text-xs font-mono"/>
          </div>
        </div>
        <div>
          <Lbl c="Committed revenue (auto)"/>
          <input value={form.committed_revenue||''} onChange={e=>!ro&&set('committed_revenue',e.target.value)}
            disabled={ro} className="field-input font-mono"/>
        </div>
      </div>
    </div>
  );
}
