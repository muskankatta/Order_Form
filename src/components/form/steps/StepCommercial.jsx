import { Inp, Sel, SHdr, CurrSel, Toggle } from '../../ui/index.jsx';
import { OF_TERMS, PAY_TERMS, RENEWAL_FREQS } from '../../../constants/formOptions.js';
import { addMonthsMinus1, fmtDate } from '../../../utils/dates.js';

export default function StepCommercial({ form, set, ro }) {
  const u = (k,v) => !ro && set(k,v);

  const handleStart = v => {
    if (ro) return;
    const m = parseInt(form.of_term_months) || 0;
    set('start_date', v);
    if (m) set('end_date', addMonthsMinus1(v, m));
  };

  const handleTerm = v => {
    if (ro) return;
    const m = parseInt(v) || 0;
    const label = OF_TERMS.find(t => t.months === m)?.label || `${m} Months`;
    set('of_term_months', m);
    set('of_term', label);
    if (form.start_date) set('end_date', addMonthsMinus1(form.start_date, m));
  };

  const handleAR = v => {
    if (ro) return;
    set('auto_renewal', v);
    if (v === 'No') set('renewal_term', 'NA');
    else if (form.renewal_term === 'NA') set('renewal_term', '');
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
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
            Order Form term <span className="text-red-400">*</span>
          </label>
          <select value={form.of_term_months||''} onChange={e=>handleTerm(e.target.value)}
            disabled={ro} className="field-input cursor-pointer">
            <option value="">Select…</option>
            {OF_TERMS.map(t => <option key={t.months} value={t.months}>{t.label}</option>)}
          </select>
        </div>
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
        <Sel label="Payment terms" req value={form.payment_terms} onChange={v=>u('payment_terms',v)} options={PAY_TERMS} disabled={ro}/>
      </div>
    </div>
  );
}
