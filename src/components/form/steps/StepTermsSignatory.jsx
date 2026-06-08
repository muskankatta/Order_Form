import { TA, SHdr, Inp } from '../../ui/index.jsx';
import { GAAS_PAYMENT_TRIGGERS, GAAS_PAYMENT_NETS, isSkuService } from '../../../constants/formOptions.js';

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

// ── Default Important Notes text ──────────────────────────────────────────────
const FYND_DEFAULT_NOTES =
`1. Entire Agreement — This Order Form, along with its accompanying schedules, annexures, Standard Operating Procedures (SOPs), Terms of Service (TOS), and Privacy Policy, if any, collectively constitute the entire agreement between the Parties (hereinafter "Agreement"). It supersedes and replaces all prior negotiations, discussions, understandings, writings, and agreements related to the subject matter herein.

2. Term — The term of this Order Form (hereinafter referred to as the "Order Form Term") includes the initial Service Period and all subsequent Renewal Terms (if applicable). The Order Form becomes effective on the commencement date of the Service Period and shall continue until the end of the Order Form Term. Renewal shall be subject to the then-current list price prevailing at the time of renewal.

3. Extension Fees — If the Client avails any of the Extension Service(s), they shall be charged an Extension Fee for that Service(s) over and above the Fees mentioned above in the Order Form.

4. Fees and Payment Terms —
a. The Client agrees to pay the fees outlined in this Order Form upon its execution and subsequently according to the Billing Frequency specified herein.
b. All fees are exclusive of applicable taxes, which will be charged separately as per prevailing laws.
c. Except for one-time fees, all recurring fees will be subject to a minimum increment of 8% on the then-current list price, as notified by Fynd at the time of renewal.
d. In the event that the Client terminates this Order Form before the expiration of the Initial Term or any then-current Renewal Term—except where such termination is due to Fynd's uncured material breach as defined in the Terms of Service—the Client shall remain liable to pay the remaining fees due for the rest of the respective term, upon termination.

5. Publicity Rights — By signing this Order Form, the Client grants Fynd the right, for the Term of this Order Form and thereafter, to use the Client's name, logo, trademark(s), and other brand identifiers for the purposes of publicity, public relations (PR), marketing, promotional, or branding activities, or otherwise disclosing its association with the Client, in any medium or format.

6. Validity — This Order Form shall remain valid for a period of seven (7) working days from the date of issuance. If not signed and returned within this period, the Order Form shall be deemed null and void unless extended in writing by Fynd.`;

const YAVI_DEFAULT_NOTES =
`1. Ownership & Licensing — Shopsense Retail Technologies Limited ("Fynd") is the owner and licensor of the Software/Platform availed as Service(s) by the Client under this Order Form. Fynd has granted Yavi Technologies with licence to resell the Service(s) in the capacity of an exclusive authorized reseller by way of an independent licence agreement.

2. Agreement Scope — This Order Form shall be read together with schedules, annexures, SOP(s), SoW(s), and/or any written documents executed between the Parties, read along with the online terms and policy documents of Fynd with respect to the Service(s) being availed by the Client and shall constitute the entire understanding and agreement between the parties and replaces all prior understandings, negotiations, discussions, writings and agreements with respect to the subject matter hereof.

3. Term — The Service Period and all applicable Renewal Tenures are collectively referred to herein as the "Order Form Term". This Order Form is effective on the date the Service Period commences until the end of the Order Form Term. Renewal will be applicable on then-current list price.

4. Fees — Client will be charged the fees set forth in this Order Form upon its execution and in accordance with the applicable Billing Frequency (as defined above) thereafter. All fees (commercial value) that Client is charged, including the fees set forth in this Order Form, will be exclusive of taxes. If Client terminates this Order Form prior to the expiration of the Initial Term or then-current Renewal Term (except to the extent such termination is due to Fynd's failure to cure a material breach in accordance with the Agreement (as defined in TOS)), then Client is responsible for paying the fees set forth in this Order Form for the remaining portion of the Initial Term or then-current Renewal Term upon termination. All fees except one time fee will be applicable for a minimal increment of 8% on then-current list price (shared by Fynd to Client) upon Renewal Term.

5. Validity — This Order Form shall remain valid for a period of seven (7) working days from the date of issuance. If not signed and returned within this period, the Order Form shall be deemed null and void unless extended in writing by Fynd.`;

export { FYND_DEFAULT_NOTES, YAVI_DEFAULT_NOTES };

function isGaaSForm(form) {
  return (form.services_fees || []).some(s => isSkuService(s.name));
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
            <strong>Note:</strong> Appears in the PDF between Service Details and the Terms &amp; Conditions.
          </div>
          <TA label="Special terms" value={form.special_terms} onChange={v=>u('special_terms',v)} disabled={ro} rows={8}/>
        </>
      )}
    </div>
  );
}

export function StepSignatory({ form, set, ro }) {
  const u = (k,v) => !ro && set(k,v);

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

      {form.entity === 'yavi' && (
        <div className="mt-3 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs">
          <strong>Yavi OF</strong> — The generated PDF will use the Yavi Technologies FZCO letterhead and T&amp;C.
        </div>
      )}
    </div>
  );
}

// ── Step 6: Important Notes — Finance-editable T&C ────────────────────────────
export function StepNotes({ form, set, ro }) {
  const u = (k,v) => !ro && set(k,v);
  const isYavi = form.entity === 'yavi'
    || (form.of_number || '').startsWith('OFYT')
    || (form.of_number || '').startsWith('OF-YT-');
  const defaultNotes = isYavi ? YAVI_DEFAULT_NOTES : FYND_DEFAULT_NOTES;

  // Show saved value if exists, otherwise show the default text
  const displayValue = form.important_notes != null ? form.important_notes : defaultNotes;

  return (
    <div>
      <SHdr c="Important Notes (Terms & Conditions)"/>

      {ro ? (
        <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
          🔒 <span>These terms are set by Finance and will appear in the generated PDF. Only Finance can edit this section.</span>
        </div>
      ) : (
        <div className="mb-4 p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs">
          ✏️ <strong>Finance edit mode</strong> — Changes here will appear under "Important Notes" in the generated PDF. Each numbered clause should be on its own line.
        </div>
      )}

      <div className="relative">
        <textarea
          value={displayValue}
          onChange={e => u('important_notes', e.target.value)}
          disabled={ro}
          rows={20}
          className="field-input w-full font-mono text-xs leading-relaxed"
          style={{
            borderColor: ro ? '#e2e8f0' : '#00C3B5',
            background: ro ? '#f8fafc' : '#fff',
            color: ro ? '#64748b' : '#1e293b',
            resize: 'vertical',
            whiteSpace: 'pre-wrap',
          }}
        />
      </div>

      {!ro && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {displayValue.length} characters · line breaks are preserved in the PDF
          </p>
          <button
            type="button"
            onClick={() => u('important_notes', defaultNotes)}
            className="text-xs text-slate-400 hover:text-red-500 underline transition-colors"
          >
            ↺ Reset to default {isYavi ? 'Yavi' : 'Fynd'} T&C
          </button>
        </div>
      )}

      {/* Preview of what entity's T&C is being used */}
      <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
        {form.important_notes != null
          ? '✓ Using custom Important Notes saved by Finance.'
          : `ℹ️ No custom notes saved yet — PDF will use the default ${isYavi ? 'Yavi' : 'Fynd'} T&C shown above.`
        }
      </div>
    </div>
  );
}
