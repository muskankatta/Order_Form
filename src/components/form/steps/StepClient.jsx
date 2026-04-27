import { useEffect } from 'react';
import { Inp, Sel, TA, SHdr, FileUpload } from '../../ui/index.jsx';
import { SEGMENTS, SALES_TEAMS, LEAD_TYPES, LEAD_CATS, SALE_TYPES,
         COUNTRIES, SOW_REQUIRED_TYPES, SOW_REFERENCE_TYPES } from '../../../constants/formOptions.js';
import { SALES_REPS } from '../../../constants/users.js';
import { useAuth } from '../../../context/AuthContext.jsx';

const REGIONS = ['MEA', 'SEA & RoW'];

const ENTITIES = [
  { value: 'fynd', label: 'Shopsense Retail Technologies Limited (Fynd)' },
  { value: 'yavi', label: 'Yavi Technologies FZCO' },
];

// Validate tax number: alphanumeric only, 3–30 chars
function isValidTaxNumber(val) {
  return /^[A-Z0-9\-]{3,30}$/.test(val);
}

export default function StepClient({ form, set, ro }) {
  const { user } = useAuth();
  const u = (k,v) => !ro && set(k,v);

  const needsSoW = SOW_REQUIRED_TYPES.has(form.sale_type);
  const needsRef = SOW_REFERENCE_TYPES.has(form.sale_type);
  const cats = LEAD_CATS[form.lead_type] || [];

  const teamReps = form.sales_team ? SALES_REPS.filter(r => r.team === form.sales_team) : SALES_REPS;
  const sortedReps = [...teamReps].sort((a,b) => a.name.localeCompare(b.name));
  const isGlobal = form.sales_team === 'Global';

  const isYavi = form.entity === 'yavi';
  // For Yavi OFs: tax_number mandatory (non-India entity), GSTIN/PAN optional
  // For Fynd OFs: country-based logic (India = PAN mandatory, others = tax_number mandatory)
  const isIndia = !isYavi && (!form.country || form.country === 'India');

  const handleRepSelect = email => {
    const rep = SALES_REPS.find(r => r.email === email);
    if (!rep) return;
    u('sales_rep_name', rep.name);
    u('sales_rep_email', rep.email);
    u('slack_id', rep.slack);
    if (rep.team) u('sales_team', rep.team);
    if (rep.region) u('region', rep.region);
  };

  const handleTeamChange = v => {
    u('sales_team', v);
    if (v !== 'Global') u('region', '');
    if (form.sales_rep_email) {
      const rep = SALES_REPS.find(r => r.email === form.sales_rep_email);
      if (rep && rep.team !== v) {
        u('sales_rep_name', ''); u('sales_rep_email', ''); u('slack_id', ''); u('region', '');
      }
    }
  };

  const handleEntityChange = v => {
    u('entity', v);
    // Yavi OFs default to Global team & USD currency
    if (v === 'yavi') {
      if (!form.sales_team) u('sales_team', 'Global');
      if (!form.committed_currency) u('committed_currency', 'USD');
      // Clear India-specific tax fields
      u('gstin', '');
      u('pan', '');
    }
    if (v === 'fynd') {
      u('tax_number', '');
    }
  };

  const handleCountryChange = v => {
    u('country', v);
    if (v === 'India') {
      u('tax_number', '');
    }
  };

  useEffect(() => {
    if (!ro && user?.role === 'sales' && !user?.isUniversal && user?.email && !form.sales_rep_email) {
      handleRepSelect(user.email);
    }
  }, [user?.email]); // eslint-disable-line

  const handleLeadTypeChange = v => {
    u('lead_type', v);
    u('lead_category', '');
    u('lead_name', '');
  };

  return (
    <div>
      {/* ── Entity selector — must be filled first ── */}
      <SHdr c="Entity"/>
      <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
        Select the entity issuing this Order Form. This controls the letterhead, T&amp;C, and signatory on the generated document.
      </div>
      <div className="grid grid-cols-2 gap-x-6 mb-2">
        <Sel
          label="Issuing Entity"
          req
          value={form.entity || ''}
          onChange={handleEntityChange}
          options={ENTITIES}
          disabled={ro}
          hint={form.entity === 'yavi' ? 'Yavi Technologies FZCO · Dubai CommerCity' : form.entity === 'fynd' ? 'Shopsense Retail Technologies Ltd. · Mumbai' : ''}
        />
        {/* Entity badge */}
        <div className="flex items-end pb-4">
          {form.entity === 'yavi' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200">
              <span className="text-xs font-bold text-indigo-700">YAVI</span>
              <span className="text-xs text-indigo-500">OF series: OFYT-XXXX</span>
            </div>
          )}
          {form.entity === 'fynd' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200">
              <span className="text-xs font-bold text-teal-700">FYND</span>
              <span className="text-xs text-teal-500">OF series: OFFY-XXXX</span>
            </div>
          )}
        </div>
      </div>

      <SHdr c="Customer information"/>
      <div className="grid grid-cols-2 gap-x-6">
        <Inp label="Customer name (legal entity)" req value={form.customer_name} onChange={v=>u('customer_name',v)} disabled={ro}/>
        <Inp label="Brand / trade name" req value={form.brand_name} onChange={v=>u('brand_name',v)} disabled={ro}/>
        <div className="col-span-2">
          <TA label="Customer billing address" req value={form.billing_address} onChange={v=>u('billing_address',v)} disabled={ro} rows={2}/>
        </div>

        {/* Country — only shown for Fynd OFs (controls tax field type) */}
        {!isYavi && (
          <Sel label="Country" req value={form.country} onChange={handleCountryChange} options={COUNTRIES} disabled={ro}/>
        )}

        {/* GSTIN — optional for both; hidden for Yavi */}
        {!isYavi && (
          <div className="mb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
              Customer GSTIN <span className="text-slate-400">(optional)</span>
            </label>
            <input
              value={form.gstin||''}
              onChange={e => { const val=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,15); u('gstin',val); }}
              placeholder="27AADCB2230M1ZT"
              className="field-input font-mono"
              style={{ borderColor: form.gstin
                ? (/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z0-9]{1}$/.test(form.gstin) ? '#4ade80' : '#fca5a5')
                : '#e2e8f0' }}
              maxLength={15} disabled={ro}
            />
            {form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z0-9]{1}$/.test(form.gstin) && (
              <p className="text-xs mt-1 text-red-500">Format: 2 digits + 5 letters + 4 digits + 1 letter + 1 digit + Z + 1 alphanumeric</p>
            )}
            {form.gstin && /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z0-9]{1}$/.test(form.gstin) && (
              <p className="text-xs mt-1 text-green-600">✓ Valid GSTIN format</p>
            )}
          </div>
        )}

        {/* PAN — mandatory for Fynd/India, optional for Fynd/non-India, hidden for Yavi */}
        {!isYavi && (
          <div className="mb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
              Customer PAN
              {isIndia
                ? <span className="text-red-400 ml-1">*</span>
                : <span className="text-slate-400 ml-1">(optional)</span>
              }
            </label>
            <input
              value={form.pan||''}
              onChange={e => { const val=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10); u('pan',val); }}
              placeholder="AADCB2230M"
              className="field-input font-mono"
              style={{ borderColor: form.pan
                ? (/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(form.pan) ? '#4ade80' : '#fca5a5')
                : '#e2e8f0' }}
              maxLength={10} disabled={ro}
            />
            {form.pan && !/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(form.pan) && (
              <p className="text-xs mt-1 text-red-500">Format: 5 letters + 4 digits + 1 letter</p>
            )}
            {form.pan && /^[A-Z]{5}\d{4}[A-Z]{1}$/.test(form.pan) && (
              <p className="text-xs mt-1 text-green-600">✓ Valid PAN format</p>
            )}
          </div>
        )}

        {/* Tax / VAT Number — mandatory for Yavi, mandatory for Fynd non-India */}
        {(isYavi || !isIndia) && (
          <div className={`mb-4 ${!isYavi ? 'col-span-2' : ''}`}>
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
              {isYavi ? 'Tax / VAT / TRN Number' : 'Tax / VAT Number'} <span className="text-red-400">*</span>
            </label>
            <input
              value={form.tax_number||''}
              onChange={e => {
                const val = e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g,'').slice(0,30);
                u('tax_number', val);
              }}
              placeholder={isYavi ? 'e.g. 104789269800003' : 'e.g. AE100234567, GB123456789'}
              className="field-input font-mono"
              style={{ borderColor: form.tax_number
                ? (isValidTaxNumber(form.tax_number) ? '#4ade80' : '#fca5a5')
                : '#e2e8f0' }}
              maxLength={30} disabled={ro}
            />
            {form.tax_number && !isValidTaxNumber(form.tax_number) && (
              <p className="text-xs mt-1 text-red-500">Alphanumeric only (letters, digits, hyphens) · 3–30 characters</p>
            )}
            {form.tax_number && isValidTaxNumber(form.tax_number) && (
              <p className="text-xs mt-1 text-green-600">✓ Valid tax number format</p>
            )}
            {isYavi && (
              <p className="text-xs mt-1 text-brand-faint">VAT / TRN number for Yavi Technologies FZCO client</p>
            )}
            {!isYavi && (
              <p className="text-xs mt-1 text-brand-faint">
                Enter the applicable local tax identifier — VAT, TRN, GST, etc. · Country: {form.country}
              </p>
            )}
          </div>
        )}
      </div>

      <SHdr c="Sales information"/>
      <div className="grid grid-cols-2 gap-x-6">
        <Sel label="Segment" req value={form.segment} onChange={v=>u('segment',v)} options={SEGMENTS} disabled={ro}/>
        <Sel label="Sales team" req value={form.sales_team} onChange={handleTeamChange} options={SALES_TEAMS} disabled={ro}
          hint="Selecting a team filters the rep dropdown below"/>
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
            Sales rep <span className="text-red-400">*</span>
          </label>
          <select value={form.sales_rep_email||''} onChange={e=>handleRepSelect(e.target.value)}
            disabled={ro || (!user?.isUniversal && user?.role === 'sales')} className="field-input cursor-pointer">
            <option value="">Select rep…</option>
            {sortedReps.map(r => <option key={r.email} value={r.email}>{r.name}</option>)}
          </select>
          {form.sales_team && (
            <p className="text-xs mt-1 text-brand-faint">
              Showing {sortedReps.length} rep{sortedReps.length!==1?'s':''} from {form.sales_team} team
            </p>
          )}
        </div>
        <Inp label="Slack ID (auto)" value={form.slack_id} disabled mono/>

        {isGlobal && (
          <div className="mb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
              Region <span className="text-red-400">*</span>
            </label>
            <select value={form.region||''} onChange={e=>u('region',e.target.value)} disabled={ro} className="field-input cursor-pointer">
              <option value="">Select region…</option>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {form.region && (
              <p className="text-xs mt-1 text-brand-faint">
                {form.region === 'MEA' ? 'Middle East & Africa' : 'South East Asia & Rest of World'}
                {form.sales_rep_email && SALES_REPS.find(r=>r.email===form.sales_rep_email)?.region !== form.region && (
                  <span className="text-amber-600 ml-1">· Manually overridden</span>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <SHdr c="Lead & sale classification"/>
      <div className="grid grid-cols-2 gap-x-6">
        <Sel label="Sale type" req value={form.sale_type} onChange={v=>u('sale_type',v)} options={SALE_TYPES} disabled={ro}/>
        <Sel label="Sales channel" req value={form.lead_type} onChange={v=>handleLeadTypeChange(v)} options={LEAD_TYPES} disabled={ro}/>

        {form.lead_type === 'Direct' && (
          <div className="mb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
              Lead category <span className="text-red-400">*</span>
            </label>
            <select value={form.lead_category||''} onChange={e=>u('lead_category',e.target.value)} disabled={ro} className="field-input cursor-pointer">
              <option value="">Select…</option>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}

        {form.lead_type === 'Indirect' && (
          <Inp label="Partner name" req value={form.lead_name} onChange={v=>u('lead_name',v)}
            disabled={ro} placeholder="e.g. Prince Consulting"
            hint="Name of the partner who referred this deal"/>
        )}
      </div>

      {form.sale_type && (
        <>
          <SHdr c="Scope of Work (SoW)"/>
          <div className={`p-4 rounded-xl mb-4 text-sm ${needsSoW ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-slate-50 border border-slate-200 text-slate-500'}`}>
            {needsSoW ? `⚠️ A signed SoW is mandatory for ${form.sale_type}.` : 'No SoW required for this sale type.'}
          </div>
          {needsSoW && <FileUpload label="Signed Scope of Work (PDF)" req value={form.sow_document} onChange={v=>u('sow_document',v)} disabled={ro} hint="PDF only · Max 10 MB"/>}
          {needsRef  && <FileUpload label={`Previous SoW for reference (${form.sale_type})`} req value={form.sow_reference_document} onChange={v=>u('sow_reference_document',v)} disabled={ro} hint="Upload the earlier SoW being superseded"/>}
        </>
      )}
    </div>
  );
}
