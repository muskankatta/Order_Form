import { useState } from 'react';
import { Inp, Sel, SHdr, CurrSel, Toggle } from '../../ui/index.jsx';
import { OF_TERMS, PAY_TERMS, RENEWAL_FREQS } from '../../../constants/formOptions.js';
import { addMonthsMinus1, fmtDate } from '../../../utils/dates.js';

export default function StepCommercial({ form, set, ro }) {
  const u = (k,v) => !ro && set(k,v);

  // ── Custom OF term ────────────────────────────────────────────────────────
  const standardMonths = OF_TERMS.map(t => t.months);
  const isStoredCustomTerm = !!(form.of_term_months && !standardMonths.includes(Number(form.of_term_months)));
  const [showCustomTerm, setShowCustomTerm] = useState(isStoredCustomTerm);

  // ── Custom payment terms ──────────────────────────────────────────────────
  const isStoredCustomPay = !!(form.payment_terms && !PAY_TERMS.includes(form.payment_terms));
  const [showCustomPayTerm, setShowCustomPayTerm] = useState(isStoredCustomPay);
  const netDays = isStoredCustomPay && form.payment_terms?.startsWith('Net ')
    ? form.payment_terms.slice(4) : '';

  const handleStart = v => {
    if (ro) return;
    const m = parseInt(form.of_term_months) || 0;
    set('start_date', v);
    if (m) set('end_date', addMonthsMinus1(v, m));
  };

  const handleTerm = v => {
    if (ro) return;
    if (v === '__custom__') {
      setShowCustomTerm(true);
      set('of_term_months', '');
      set('of_term', '');
      set('end_date', '');
      return;
    }
    setShowCustomTerm(false);
    const m = parseInt(v) || 0;
    const label = OF_TERMS.find(t => t.months === m)?.label || `${m} Months`;
    set('of_term_months', m);
    set('of_term', label);
    if (form.start_date) set('end_date', addMonthsMinus1(form.start_date, m));
  };

  const handleCustomTermMonths = v => {
    if (ro) return;
    const m = parseInt(v) || 0;
    set('of_term_months', m || '');
    set('of_term', m ? m + ' Months' : '');
    if (form.start_date && m) set('end_date', addMonthsMinus1(form.start_date, m));
    else if (!m) set('end_date', '');
  };

  const handleAR = v => {
    if (ro) return;
    set('auto_renewal', v);
    if (v === 'No') set('renewal_term', 'NA');
    else if (form.renewal_term === 'NA') set('renewal_term', '');
  };

  const handlePayTerm = v => {
    if (ro) return;
    if (v === '__custom__') {
      setShowCustomPayTerm(true);
      set('payment_terms', '');
      return;
    }
    setShowCustomPayTerm(false);
    set('payment_terms', v);
  };

  const handleNetDays = v => {
    if (ro) return;
    const n = v.replace(/[^0-9]/g, '');
    set('payment_terms', n ? 'Net ' + n : '');
  };

  return (
    <div>
      <SHdr c="Client representative"/>
      <div className="grid grid-cols-3 gap-x-4">
        <Inp label="Name" req value={form.client_rep_name} onChange={v=>u('client_rep_name',v)} disabled={ro}/>
        <Inp label="Mobile number" value={form.client_rep_mobile} onChange={v=>u('client_rep_mobile',v)} disabled={ro} placeholder="+91 98765 43210"/>
        <Inp label="Email" req type="email" value={form.client_rep_email} onChange={v=>u('client_rep_email',v)} disabled={ro}/>
      </div>
      <div className="grid grid-cols-3 gap-x-4">
        <Inp label="Billing email" req type="email" value={form.billing_email} onChange={v=>u('billing_email',v)} disabled={ro}/>
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">PO required</label>
          <Toggle value={form.po_required} onChange={v=>u('po_required',v)} disabled={ro}/>
        </div>
      </div>

      <SHdr c="Service period"/>
      <div className="grid grid-cols-3 gap-x-4">
        <Inp label="Start date" req type="date" value={form.start_date} onChange={handleStart} disabled={ro}/>

        {/* OF Term */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
            Order Form term <span className="text-red-400">*</span>
          </label>
          {ro
            ? <input value={form.of_term||''} readOnly className="field-input" style={{background:'#f8fafc',color:'#64748b'}}/>
            : <>
                <select
                  value={showCustomTerm ? '__custom__' : (form.of_term_months||'')}
                  onChange={e => handleTerm(e.target.value)}
                  className="field-input cursor-pointer">
                  <option value="">Select…</option>
                  {OF_TERMS.map(t => <option key={t.months} value={t.months}>{t.label}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
                {showCustomTerm && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="number" min="1" max="240"
                      value={form.of_term_months || ''}
                      onChange={e => handleCustomTermMonths(e.target.value)}
                      placeholder="e.g. 18"
                      className="field-input w-24 font-mono"
                      style={{ borderColor:'#00C3B5' }}
                    />
                    <span className="text-xs text-slate-500 font-medium">Months</span>
                    {form.of_term_months > 0 && (
                      <span className="text-xs text-green-600 font-semibold">{form.of_term}</span>
                    )}
                  </div>
                )}
              </>
          }
        </div>

        {/* End date */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">End date (auto)</label>
          <input value={form.end_date||''} readOnly className="field-input" style={{ background:'#f8fafc', color:'#64748b' }}/>
          {form.start_date && form.end_date && (
            <p className="text-xs mt-1 text-green-600">✓ {fmtDate(form.start_date)} → {fmtDate(form.end_date)}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-4">
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
            Auto renewal <span className="text-red-400">*</span>
          </label>
          <Toggle value={form.auto_renewal} onChange={handleAR} disabled={ro}/>
        </div>
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
            Renewal frequency <span className="text-red-400">*</span>
          </label>
          {form.auto_renewal === 'No'
            ? <input value="NA" readOnly className="field-input" style={{ background:'#f8fafc', color:'#64748b' }}/>
            : <select value={form.renewal_term||''} onChange={e=>u('renewal_term',e.target.value)}
                disabled={ro} className="field-input cursor-pointer">
                <option value="">Select…</option>
                {RENEWAL_FREQS.map(o => <option key={o}>{o}</option>)}
              </select>
          }
        </div>
      </div>

      <SHdr c="Billing & payment"/>
      <div className="grid grid-cols-3 gap-x-4">
        <CurrSel value={form.committed_currency||'INR'} onChange={v=>u('committed_currency',v)} disabled={ro}/>

        {/* Payment Terms */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
            Payment terms <span className="text-red-400">*</span>
          </label>
          {ro
            ? <input value={form.payment_terms||''} readOnly className="field-input" style={{ background:'#f8fafc', color:'#64748b' }}/>
            : <>
                <select
                  value={showCustomPayTerm ? '__custom__' : (form.payment_terms||'')}
                  onChange={e => handlePayTerm(e.target.value)}
                  className="field-input cursor-pointer">
                  <option value="">Select…</option>
                  {PAY_TERMS.map(o => <option key={o}>{o}</option>)}
                  <option value="__custom__">Net (Custom)…</option>
                </select>
                {showCustomPayTerm && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-2 rounded-l-lg border border-r-0 border-slate-200 whitespace-nowrap">Net</span>
                    <input
                      type="number" min="1"
                      value={netDays}
                      onChange={e => handleNetDays(e.target.value)}
                      placeholder="30"
                      className="field-input font-mono rounded-l-none"
                      style={{ borderColor:'#00C3B5' }}
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">days</span>
                  </div>
                )}
                {showCustomPayTerm && form.payment_terms && (
                  <p className="text-xs mt-1 text-green-600 font-semibold">→ {form.payment_terms}</p>
                )}
              </>
          }
        </div>
      </div>
    </div>
  );
}
