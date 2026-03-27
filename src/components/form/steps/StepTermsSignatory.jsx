import { TA, SHdr } from '../../ui/index.jsx';
import { MultiFileUpload } from '../../ui/index.jsx';

export function StepTerms({ form, set, ro }) {
  const u = (k,v) => !ro && set(k,v);
  return (
    <div>
      <SHdr c="Special terms & comments"/>
      <div className="mb-4 p-4 rounded-xl text-sm bg-amber-50 border border-amber-200 text-amber-800">
        <strong>Note:</strong> Appears in the PDF between Section B (Service Details) and Terms &amp; Conditions.
      </div>
      <TA label="Special terms" value={form.special_terms} onChange={v=>u('special_terms',v)} disabled={ro} rows={8}/>

      <SHdr c="Additional attachments (optional)"/>
      <div className="mb-4 p-4 rounded-xl text-sm bg-slate-50 border border-slate-200 text-slate-600">
        Attach any supporting documents — proposed SoW, rate cards, proposals, etc. PDF only, max 10 MB each.
      </div>
      <MultiFileUpload
        label="Attachments"
        value={form.attachments || []}
        onChange={v => u('attachments', v)}
        disabled={ro}
        hint="These are stored with the Order Form for reference. Not included in the PDF."
      />
    </div>
  );
}

export function StepSignatory({ form, set, ro }) {
  const u = (k,v) => !ro && set(k,v);
  return (
    <div>
      <SHdr c="Authorised signatory (customer)"/>
      <div className="grid grid-cols-2 gap-x-6">
        <div import="Inp" />
      </div>
      {/* inlined to avoid circular import */}
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

      <div className="mt-2 p-4 rounded-xl bg-green-50 border border-green-200">
        <div className="text-xs font-bold uppercase tracking-wider mb-3 text-green-800">Fynd signatory (pre-filled)</div>
        <div className="grid grid-cols-3 gap-x-4">
          {[['Name','Sreeraman Mohan Girija'],['Designation','Whole-time Director'],['Email','legal@gofynd.com']].map(([l,v]) => (
            <div key={l} className="mb-4">
              <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">{l}</label>
              <input value={v} readOnly className="field-input" style={{ background:'#f8fafc', color:'#64748b', borderColor:'#e2e8f0' }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
