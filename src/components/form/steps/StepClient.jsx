import { useEffect, useState } from 'react';
import { Inp, Sel, TA, SHdr } from '../../ui/index.jsx';
import { SEGMENTS, SALES_TEAMS, LEAD_TYPES, LEAD_CATS, SALE_TYPES,
         COUNTRIES, SOW_REQUIRED_TYPES, SOW_REFERENCE_TYPES } from '../../../constants/formOptions.js';
import { SALES_REPS } from '../../../constants/users.js';
import { useAuth } from '../../../context/AuthContext.jsx';

const REGIONS = ['MEA', 'SEA & RoW'];

const ENTITIES = [
  { value: 'fynd', label: 'Shopsense Retail Technologies Limited (Fynd)' },
  { value: 'yavi', label: 'Yavi Technologies FZCO' },
];

const LEAD_NAME_LABEL = {
  'Inside Sales/Pre-Sales': 'Rep / Contact name',
  'Event':                  'Event name',
};

function isValidTaxNumber(val) {
  return /^[A-Z0-9\-]{3,30}$/.test(val);
}

function isValidUrl(v) {
  if (!v) return false;
  try {
    const url = new URL(v.trim());
    return /^https?:$/.test(url.protocol);
  } catch {
    return false;
  }
}

const looksLikeDrive = v => /(drive|docs)\.google\.com/i.test(v || '');

const toTitleCase = v => v.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

// ── SoW link field — Sales Rep pastes a Google Drive link; any role can open it ──
function SowLink({ label, req, value, onChange, ro, hint }) {
  const val = (value || '').trim();
  const valid = isValidUrl(val);
  const drive = valid && looksLikeDrive(val);

  return (
    <div className="mb-4">
      <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
        {label}{req && <span className="text-red-400 ml-1">*</span>}
      </label>

      {ro ? (
        val ? (
          <a href={val} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-sm font-medium hover:bg-teal-100 break-all">
            🔗 Open Scope of Work
          </a>
        ) : (
          <input value="— no link provided —" readOnly className="field-input" style={{ background:'#f8fafc', color:'#94a3b8' }}/>
        )
      ) : (
        <>
          <input
            type="url"
            value={val}
            onChange={e => onChange(e.target.value.trim())}
            placeholder="https://drive.google.com/…"
            className="field-input font-mono text-sm"
            style={{ borderColor: val ? (valid ? '#4ade80' : '#fca5a5') : '#e2e8f0' }}
          />
          {val && !valid && <p className="text-xs mt-1 text-red-500">Enter a valid link starting with https://</p>}
          {valid && !drive && <p className="text-xs mt-1 text-amber-600">This doesn't look like a Google Drive / Docs link — double-check it.</p>}
          {valid && (
            <a href={val} target="_blank" rel="noopener noreferrer" className="inline-block text-xs mt-1 text-teal-600 hover:underline">
              ↗ Open link in new tab
            </a>
          )}
        </>
      )}

      {hint && <p className="text-xs mt-1 text-brand-faint">{hint}</p>}
    </div>
  );
}

export default function StepClient({ form, set, ro }) {
  const { user } = useAuth();
  const u = (k,v) => !ro && set(k,v);

  const needsSoW = SOW_REQUIRED_TYPES.has(form.sale_type);
  const needsRef = SOW_REFERENCE_TYPES.has(form.sale_type);
  const cats = LEAD_CATS[form.lead_type] || [];

  // ── Custom country ────────────────────────────────────────────────────────
  const countriesList = Array.isArray(COUNTRIES)
    ? COUNTRIES.map(c => typeof c === 'string' ? c : c.value)
    : [];
  const isStoredCustomCountry = !!(form.country && !countriesList.includes(form.country));
  const [customCountry, setCustomCountry] = useState(isStoredCustomCountry);

  // ── Custom sales rep ──────────────────────────────────────────────────────
  const [customRep, setCustomRep] = useState(form.is_custom_rep === true);

  const teamReps = form.sales_team ? SALES_REPS.filter(r => r.team === form.sales_team) : SALES_REPS;
  const sortedReps = [...teamReps].sort((a,b) => a.name.localeCompare(b.name));
  const isGlobal = form.sales_team === 'Global';

  const isYavi  = form.entity === 'yavi';
  const isIndia = !isYavi && form.country === 'India';

  const leadNameLabel = LEAD_NAME_LABEL[form.lead_category] || null;

  const handleRepSelect = email => {
    if (email === '__custom__') {
      setCustomRep(true);
      u('is_custom_rep', true);
      u('sales_rep_name', '');
      u('sales_rep_email', '');
      u('slack_id', '');
      return;
    }
    const rep = SALES_REPS.find(r => r.email === email);
    if (!rep) return;
    setCustomRep(false);
    u('is_custom_rep', false);
    u('sales_rep_name', rep.name);
    u('sales_rep_email', rep.email);
    u('slack_id', rep.slack);
    if (rep.team) u('sales_team', rep.team);
    if (rep.region) u('region', rep.region);
  };

  const handleTeamChange = v => {
    u('sales_team', v);
    if (v !== 'Global') u('region', '');
    if (!customRep && form.sales_rep_email) {
      const rep = SALES_REPS.find(r => r.email === form.sales_rep_email);
      if (rep && rep.team !== v) {
        u('sales_rep_name', ''); u('sales_rep_email', ''); u('slack_id', ''); u('region', '');
      }
    }
  };

  const handleEntityChange = v => {
    u('entity', v);
    if (v === 'yavi') {
      if (!form.sales_team) u('sales_team', 'Global');
      if (!form.committed_currency) u('committed_currency', 'USD');
      u('gstin', '');
      u('pan', '');
    }
    if (v === 'fynd') {
      u('tax_number', '');
    }
  };

  const handleCountryChange = v => {
    if (v === '__others__') {
      setCustomCountry(true);
      u('country', '');
      return;
    }
    setCustomCountry(false);
    u('country', v);
    if (v === 'India') u('tax_number', '');
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

  const handleLeadCategoryChange = v => {
    u('lead_category', v);
    u('lead_name', '');
  };

  return (
    <div>
      {/* ── Entity selector ── */}
      <SHdr c="Entity"/>
      <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
        Select the entity issuing this Order Form. This controls the letterhead, T&amp;C, and signatory on the generated document.
      </div>
      <div className="grid grid-cols-2 gap-x-6 mb-2">
        <Sel label="Issuing Entity" req value={form.entity || ''} onChange={handleEntityChange} options={ENTITIES} disabled={ro}
          hint={form.entity === 'yavi' ? 'Yavi Technologies FZCO · Dubai CommerCity' : form.entity === 'fynd' ? 'Shopsense Retail Technologies Ltd. · Mumbai' : ''}/>
        <div className="flex items-end pb-4">
          {form.entity === 'yavi' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200">
              <span className="text-xs font-bold text-indigo-700">YAVI</span>
              <span className="text-xs text-indigo-500">OF series: OF-YT-XXXX</span>
            </div>
          )}
          {form.entity === 'fynd' && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200">
              <span className="text-xs font-bold text-teal-700">FYND</span>
              <span className="text-xs text-teal-500">OF series: OF-FY-XXXX</span>
            </div>
          )}
        </div>
      </div>

      <SHdr c="Customer information"/>
      <div className="grid grid-cols-2 gap-x-6">
        <Inp label="Customer name (legal entity)" req value={form.customer_name} onChange={v=>u('customer_name',v)} onBlur={v=>u('customer_name',toTitleCase(v))} disabled={ro}/>
        <Inp label="Brand / trade name" req value={form.brand_name} onChange={v=>u('brand_name',v)} onBlur={v=>u('brand_name',toTitleCase(v))} disabled={ro}/>
        <div className="col-span-2">
          <TA label="Customer billing address" req value={form.billing_address} onChange={v=>u('billing_address',v)} disabled={ro} rows={2}/>
        </div>

        {/* ── Country ── */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
            Country
            {!isYavi && <span className="text-red-400 ml-1">*</span>}
            {isYavi  && <span className="text-slate-400 ml-1">(for records)</span>}
          </label>
          {ro
            ? <input value={form.country||''} readOnly className="field-input" style={{background:'#f8fafc',color:'#64748b'}}/>
            : <>
                <select
                  value={customCountry ? '__others__' : (form.country||'')}
                  onChange={e => handleCountryChange(e.target.value)}
                  className="field-input cursor-pointer">
                  <option value="">Select…</option>
                  {(Array.isArray(COUNTRIES) ? COUNTRIES : []).map(c => {
                    const val = typeof c === 'string' ? c : c.value;
                    const lbl = typeof c === 'string' ? c : c.label;
                    return <option key={val} value={val}>{lbl}</option>;
                  })}
                  <option value="__others__">Others…</option>
                </select>
                {customCountry && (
                  <input value={form.country||''} onChange={e => u('country', e.target.value)}
                    placeholder="Enter country name…" className="field-input mt-1.5"
                    style={{ borderColor:'#00C3B5' }}/>
                )}
              </>
          }
        </div>

        {!isYavi && (
          <div className="mb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
              Customer GSTIN <span className="text-slate-400">(optional)</span>
            </label>
            <input value={form.gstin||''}
              onChange={e => { const val=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,15); u('gstin',val); }}
              placeholder="27AADCB2230M1ZT" className="field-input font-mono"
              style={{ borderColor: form.gstin ? (/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z0-9]{1}$/.test(form.gstin) ? '#4ade80' : '#fca5a5') : '#e2e8f0' }}
              maxLength={15} disabled={ro}/>
            {form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z0-9]{1}$/.test(form.gstin) && (
              <p className="text-xs mt-1 text-red-500">Format: 2 digits + 5 letters + 4 digits + 1 letter + 1 digit + Z + 1 alphanumeric</p>
            )}
            {form.gstin && /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z0-9]{1}$/.test(form.gstin) && (
              <p className="text-xs mt-1 text-green-600">✓ Valid GSTIN format</p>
            )}
          </div>
        )}

        {!isYavi && (
          <div className="mb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
              Customer PAN
              {isIndia ? <span className="text-red-400 ml-1">*</span> : <span className="text-slate-400 ml-1">(optional)</span>}
            </label>
            <input value={form.pan||''}
              onChange={e => { const val=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10); u('pan',val); }}
              placeholder="AADCB2230M" className="field-input font-mono"
              style={{ borderColor: form.pan ? (/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(form.pan) ? '#4ade80' : '#fca5a5') : '#e2e8f0' }}
              maxLength={10} disabled={ro}/>
            {form.pan && !/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(form.pan) && (
              <p className="text-xs mt-1 text-red-500">Format: 5 letters + 4 digits + 1 letter</p>
            )}
            {form.pan && /^[A-Z]{5}\d{4}[A-Z]{1}$/.test(form.pan) && (
              <p className="text-xs mt-1 text-green-600">✓ Valid PAN format</p>
            )}
          </div>
        )}

        {(isYavi || !isIndia) && (
          <div className={`mb-4 ${!isYavi ? 'col-span-2' : ''}`}>
            <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
              {isYavi ? 'Tax / VAT / TRN Number' : 'Tax / VAT Number'} <span className="text-red-400">*</span>
            </label>
            <input value={form.tax_number||''}
              onChange={e => { const val = e.target.value.toUpperCase().replace(/[^A-Z0-9\-]/g,'').slice(0,30); u('tax_number', val); }}
              placeholder={isYavi ? 'e.g. 104789269800003' : 'e.g. AE100234567, GB123456789'}
              className="field-input font-mono"
              style={{ borderColor: form.tax_number ? (isValidTaxNumber(form.tax_number) ? '#4ade80' : '#fca5a5') : '#e2e8f0' }}
              maxLength={30} disabled={ro}/>
            {form.tax_number && !isValidTaxNumber(form.tax_number) && (
              <p className="text-xs mt-1 text-red-500">Alphanumeric only (letters, digits, hyphens) · 3–30 characters</p>
            )}
            {form.tax_number && isValidTaxNumber(form.tax_number) && (
              <p className="text-xs mt-1 text-green-600">✓ Valid tax number format</p>
            )}
            {isYavi  && <p className="text-xs mt-1 text-brand-faint">VAT / TRN number for Yavi Technologies FZCO client</p>}
            {!isYavi && <p className="text-xs mt-1 text-brand-faint">Enter the applicable local tax identifier — VAT, TRN, GST, etc. · Country: {form.country}</p>}
          </div>
        )}
      </div>

      <SHdr c="Sales information"/>
      <div className="grid grid-cols-2 gap-x-6">
        <Sel label="Segment" req value={form.segment} onChange={v=>u('segment',v)} options={SEGMENTS} disabled={ro}/>
        <Sel label="Sales team" req value={form.sales_team} onChange={handleTeamChange} options={SALES_TEAMS} disabled={ro}
          hint="Selecting a team filters the rep dropdown below"/>

        {/* ── Sales rep ── */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
            Sales rep <span className="text-red-400">*</span>
          </label>
          {ro ? (
            <input value={form.sales_rep_name||''} readOnly className="field-input" style={{background:'#f8fafc',color:'#64748b'}}/>
          ) : (
            <>
              <select
                value={customRep ? '__custom__' : (form.sales_rep_email||'')}
                onChange={e => handleRepSelect(e.target.value)}
                disabled={!user?.isUniversal && user?.role === 'sales'}
                className="field-input cursor-pointer">
                <option value="">Select rep…</option>
                {sortedReps.map(r => <option key={r.email} value={r.email}>{r.name}</option>)}
                <option value="__custom__">Others (not in list)…</option>
              </select>
              {!customRep && form.sales_team && (
                <p className="text-xs mt-1 text-brand-faint">
                  Showing {sortedReps.length} rep{sortedReps.length!==1?'s':''} from {form.sales_team} team
                </p>
              )}
              {customRep && (
                <div className="mt-2 p-3 rounded-xl border border-teal-200 bg-teal-50 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700 mb-1">Custom Sales Rep</p>
                  <input value={form.sales_rep_name||''} onChange={e=>u('sales_rep_name',e.target.value)}
                    placeholder="Full name *" className="field-input text-xs" style={{borderColor:'#99f6e4'}}/>
                  <input type="email" value={form.sales_rep_email||''} onChange={e=>u('sales_rep_email',e.target.value)}
                    placeholder="Email address *" className="field-input text-xs font-mono" style={{borderColor:'#99f6e4'}}/>
                  <input value={form.slack_id||''} onChange={e=>u('slack_id',e.target.value)}
                    placeholder="Slack Member ID (e.g. U01ABCD23EF)" className="field-input text-xs font-mono" style={{borderColor:'#99f6e4'}}/>
                  <p className="text-[10px] text-teal-600">Slack ID used for notifications. Find it in Slack → Profile → ⋯ → Copy member ID.</p>
                </div>
              )}
            </>
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
                {form.sales_rep_email && !customRep && SALES_REPS.find(r=>r.email===form.sales_rep_email)?.region !== form.region && (
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
            <select value={form.lead_category||''} onChange={e=>handleLeadCategoryChange(e.target.value)} disabled={ro} className="field-input cursor-pointer">
              <option value="">Select…</option>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}

        {form.lead_type === 'Direct' && leadNameLabel && (
          <Inp label={leadNameLabel} req value={form.lead_name||''} onChange={v=>u('lead_name',v)} disabled={ro}
            placeholder={form.lead_category === 'Event' ? 'e.g. Shoptalk 2025' : 'e.g. Priya Sharma'}
            hint={form.lead_category === 'Event' ? 'Name of the event where the lead was sourced' : 'Name of the inside sales rep or pre-sales contact'}/>
        )}

        {form.lead_type === 'Indirect' && (
          <Inp label="Partner name" req value={form.lead_name} onChange={v=>u('lead_name',v)}
            disabled={ro} placeholder="e.g. Prince Consulting" hint="Name of the partner who referred this deal"/>
        )}
      </div>

      {form.sale_type && (
        <>
          <SHdr c="Scope of Work (SoW)"/>
          <div className={`p-4 rounded-xl mb-4 text-sm ${needsSoW ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-slate-50 border border-slate-200 text-slate-500'}`}>
            {needsSoW
              ? `⚠️ A signed SoW is mandatory for ${form.sale_type}. Paste the Google Drive link to the signed document below.`
              : 'No SoW required for this sale type.'}
          </div>
          {needsSoW && (
            <SowLink
              label="Signed Scope of Work — Google Drive link"
              req
              value={form.sow_link}
              onChange={v=>u('sow_link', v)}
              ro={ro}
              hint="Paste a shareable Google Drive / Docs link. Set sharing so anyone at Fynd with the link can open it — every role (Sales, RevOps, Finance) views the SoW through this link."
            />
          )}
          {needsRef && (
            <SowLink
              label={`Previous SoW for reference (${form.sale_type}) — Google Drive link`}
              req
              value={form.sow_reference_link}
              onChange={v=>u('sow_reference_link', v)}
              ro={ro}
              hint="Paste the Google Drive link to the earlier SoW being superseded."
            />
          )}
        </>
      )}
    </div>
  );
}
