import { useEffect } from 'react';
import { Inp, Sel, TA, SHdr, FileUpload } from '../../ui/index.jsx';
import { SEGMENTS, SALES_TEAMS, LEAD_TYPES, LEAD_CATS, SALE_TYPES,
         COUNTRIES, SOW_REQUIRED_TYPES, SOW_REFERENCE_TYPES } from '../../../constants/formOptions.js';
import { SALES_REPS } from '../../../constants/users.js';
import { useAuth } from '../../../context/AuthContext.jsx';

export default function StepClient({ form, set, ro }) {
  const { user } = useAuth();
  const u = (k,v) => !ro && set(k,v);
  const needsSoW = SOW_REQUIRED_TYPES.has(form.sale_type);
  const needsRef = SOW_REFERENCE_TYPES.has(form.sale_type);
  const cats = LEAD_CATS[form.lead_type] || [];
  const sortedReps = [...SALES_REPS].sort((a,b) => a.name.localeCompare(b.name));

  const handleRepSelect = email => {
    const rep = SALES_REPS.find(r => r.email === email);
    if (!rep) return;
    u('sales_rep_name', rep.name);
    u('sales_rep_email', rep.email);
    u('slack_id', rep.slack);
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
      <SHdr c="Customer information"/>
      <div className="grid grid-cols-2 gap-x-6">
        <Inp label="Customer name (legal entity)" req value={form.customer_name} onChange={v=>u('customer_name',v)} disabled={ro}/>
        <Inp label="Brand / trade name" req value={form.brand_name} onChange={v=>u('brand_name',v)} disabled={ro}/>
        <div className="col-span-2"><TA label="Customer billing address" req value={form.billing_address} onChange={v=>u('billing_address',v)} disabled={ro} rows={2}/></div>
        <Inp label="Customer GSTIN" value={form.gstin} onChange={v=>u('gstin',v)} disabled={ro} placeholder="27AADCB2230M1ZT" mono/>
        <Inp label="Customer PAN" value={form.pan} onChange={v=>u('pan',v)} disabled={ro} placeholder="AADCB2230M" mono/>
        <Sel label="Country" req value={form.country} onChange={v=>u('country',v)} options={COUNTRIES} disabled={ro}/>
      </div>

      <SHdr c="Sales information"/>
      <div className="grid grid-cols-2 gap-x-6">
        <Sel label="Segment" req value={form.segment} onChange={v=>u('segment',v)} options={SEGMENTS} disabled={ro}/>
        <Sel label="Sales team" req value={form.sales_team} onChange={v=>u('sales_team',v)} options={SALES_TEAMS} disabled={ro}/>
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
            Sales rep <span className="text-red-400">*</span>
          </label>
          <select value={form.sales_rep_email||''} onChange={e=>handleRepSelect(e.target.value)}
            disabled={ro || (!user?.isUniversal && user?.role === 'sales')} className="field-input cursor-pointer">
            <option value="">Select rep…</option>
            {sortedReps.map(r => <option key={r.email} value={r.email}>{r.name}</option>)}
          </select>
        </div>
        <Inp label="Slack ID (auto)" value={form.slack_id} disabled mono/>
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
            <select value={form.lead_category||''} onChange={e=>u('lead_category',e.target.value)}
              disabled={ro} className="field-input cursor-pointer">
              <option value="">Select…</option>
              {cats.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}

        {form.lead_type === 'Indirect' && (
          <Inp label="Partner name" req value={form.lead_name} onChange={v=>u('lead_name',v)}
            disabled={ro} placeholder="e.g. Shweta Lamba / Prince Consulting"
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
