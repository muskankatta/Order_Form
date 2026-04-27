import { TA, SHdr, Inp } from '../../ui/index.jsx';
import { GAAS_PAYMENT_TRIGGERS, GAAS_PAYMENT_NETS } from '../../../constants/formOptions.js';

const NAVY = '#1B2B4B'; const T = '#00C3B5';

// ── Entity signatory configs ──────────────────────────────────────────────────
const ENTITY_SIGNATORIES = {
  yavi: {
    label:       'Yavi Technologies FZCO signatory (pre-filled)',
    labelColor:  'text-indigo-800',
    bgColor:     'bg-indigo-50 border border-indigo-200',
    name:        'Vishesh Kumar',
    designation: 'Founding Director',
    email:       'accounts@yavitechnologies.com',
  },
  fynd: {
    label:       'Fynd signatory (pre-filled)',
    labelColor:  'text-green-800',
    bgColor:     'bg-green-50 border border-green-200',
    name:        'Sreeraman Mohan Girija',
    designation: 'Whole-time Director',
    email:       'legal@gofynd.com',
  },
};

function isGaaSForm(form) {
  return (form.services_fees || []).some(s => s.name === 'GaaS');
}

export function StepTerms({ form, set, ro }) {
  const u = (k,v) => !ro && set(k,v);
  const gaas = isGaaSForm(form);

  const setPaymentTrigger = v => {
    u('gaas_payment_trigger', v);
    u('payment_terms', v && form.gaas_payment_net ? v + '-' + form.gaas_payment_net : v);
  };
  const setPaymentNet = v => {
    u('gaas_payment_net', v);
    u('payment_terms', form.gaas_payment_trigger && v ? form.gaas_payment_trigger + '-' + v : v);
  };

  return (
    <div>
      {gaas ? (
        <>
          {/* GaaS-specific: delivery date + term + payment terms */}
          <SHdr c="Order Confirmation Details"/>
          <div className="mb-3 p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs">
            GaaS Order — these fields replace the standard start/end date and payment terms.
          </div>
          <div className="grid grid-cols-2 gap-x-6">
            <div className="mb-4">
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
                Expected Delivery Date <span className="text-red-400">*</span>
              </label>
              <input type="date" value={form.expected_delivery_date||''} onChange={e=>u('expected_delivery_date',e.target.value)}
                disabled={ro} className="field-input" style={{borderColor:'#e2e8f0'}}/>
            </div>
            <div className="mb-4">
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
                Order Form Term <span className="text-red-400">*</span>
              </label>
              <input type="text" value={form.of_term||''} onChange={e=>u('of_term',e.target.value)}
                disabled={ro} placeholder="e.g. 1 Month" className="field-input" style={{borderColor:'#e2e8f0'}}/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 mb-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
                Payment Trigger <span className="text-red-400">*</span>
              </label>
              <select value={form.gaas_payment_trigger||''} onChange={e=>setPaymentTrigger(e.target.value)}
                disabled={ro} className="field-input cursor-pointer">
                <option value="">Select…</option>
                {GAAS_PAYMENT_TRIGGERS.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
                Net Terms <span className="text-red-400">*</span>
              </label>
              <select value={form.gaas_payment_net||''} onChange={e=>setPaymentNet(e.target.value)}
                disabled={ro} className="field-input cursor-pointer">
                <option value="">Select…</option>
                {GAAS_PAYMENT_NETS.map(n=><option key={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {form.payment_terms && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
              <span className="text-xs text-brand-faint">Combined payment terms:</span>
              <span className="text-sm font-bold" style={{color:NAVY}}>{form.payment_terms}</span>
            </div>
          )}

          <SHdr c="Special terms & comments"/>
          <TA label="Special terms (optional)" value={form.special_terms} onChange={v=>u('special_terms',v)} disabled={ro} rows={5}/>
        </>
      ) : (
        <>
          <SHdr c="Special terms & comments"/>
          <div className="mb-4 p-4 rounded-xl text-sm bg-amber-50 border border-amber-200 text-amber-800">
            <strong>Note:</strong> Appears in the PDF/Word document between Service Details and the Terms &amp; Conditions.
          </div>
          <TA label="Special terms" value={form.special_terms} onChange={v=>u('special_terms',v)} disabled={ro} rows={8}/>
        </>
      )}
    </div>
  );
}

export function StepSignatory({ form, set, ro }) {
  const u = (k,v) => !ro && set(k,v);

  // Determine entity signatory — default to Fynd if not set
  const entityKey = form.entity === 'yavi' ? 'yavi' : 'fynd';
  const sig = ENTITY_SIGNATORIES[entityKey];

  return (
    <div>
      <SHdr c="Authorised signatory (customer)"/>
      <div className="grid grid-cols-2 gap-x-6">
        {[
          ['signatory_name','Signatory name',true,'text',''],
          ['signatory_designation','Signatory designation',true,'text','e.g. Director, CEO'],
          ['signatory_email','Signatory email',true,'email',''],
          ['customer_cc','Customer CC email',false,'email',''],
        ].map(([key,lbl,req,type,ph]) => (
          <div key={key} className="mb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
              {lbl}{req && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            <input type={type} value={form[key]||''} placeholder={ph} disabled={ro}
              onChange={e=>u(key,e.target.value)}
              className="field-input"
              style={{ borderColor:'#e2e8f0' }}/>
          </div>
        ))}
      </div>

      {/* Entity-aware issuer signatory */}
      <div className={`mt-2 p-4 rounded-xl ${sig.bgColor}`}>
        <div className={`text-xs font-bold uppercase tracking-wider mb-3 ${sig.labelColor}`}>
          {sig.label}
        </div>
        <div className="grid grid-cols-3 gap-x-4">
          {[['Name', sig.name], ['Designation', sig.designation], ['Email', sig.email]].map(([l,v]) => (
            <div key={l} className="mb-4">
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">{l}</label>
              <input value={v} readOnly className="field-input" style={{ background:'#f8fafc', color:'#64748b', borderColor:'#e2e8f0' }}/>
            </div>
          ))}
        </div>
      </div>

      {/* Entity badge reminder */}
      {form.entity === 'yavi' && (
        <div className="mt-3 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs">
          <strong>Yavi OF</strong> — The generated PDF and Word document will use the Yavi Technologies FZCO letterhead and T&amp;C.
        </div>
      )}
    </div>
  );
}
