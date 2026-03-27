import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Btn, StatusPill, Lbl, TA, MultiSelect, Toast } from '../ui/index.jsx';
import StepClient from '../form/steps/StepClient.jsx';
import StepCommercial from '../form/steps/StepCommercial.jsx';
import StepFees from '../form/steps/StepFees.jsx';
import { StepTerms, StepSignatory } from '../form/steps/StepTermsSignatory.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { FINANCE_USERS, REVOPS_USERS } from '../../constants/users.js';
import { fmtDate, fmtShort } from '../../utils/dates.js';
import { openPDF } from '../../utils/pdf.js';
import { useToast } from '../../hooks/useToast.js';

const NAVY='#1B2B4B'; const T='#00C3B5';
const TABS = [{id:'client',lbl:'Client'},{id:'commercial',lbl:'Commercial'},{id:'fees',lbl:'Fees'},{id:'terms',lbl:'Terms'},{id:'signatory',lbl:'Signatory'}];

export default function FormDetail({ form: initial }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { forms, revopsApprove, revopsReject, financeApprove, financeReject, markSigned, applyDealStatus, cloneForm, deleteDraft } = useForms();
  const { toast, show, hide } = useToast();

  const form     = forms.find(f => f.id === initial.id) || initial;
  const [tab,    setTab]   = useState('client');
  const [edit,   setEdit]  = useState(false);
  const [ef,     setEf]    = useState({...form});
  const [ofNum,  setOfNum] = useState(form.of_number||'');
  const [cmt,    setCmt]   = useState('');
  const [finDRIs,setFinDRIs]= useState([]);
  const [sigDate,setSigDate]= useState('');

  const live = edit ? ef : form;
  const set  = (k,v) => setEf(prev => ({...prev,[k]:v}));

  const canEdit   = (user?.isUniversal) || (user?.role==='revops'&&form.status==='submitted') || (user?.role==='finance'&&form.status==='revops_approved');
  const canDelete = (user?.isUniversal) || (user?.role==='sales'&&form.status==='draft') || (user?.role==='revops'&&form.status==='submitted') || (user?.role==='finance'&&form.status==='revops_approved');

  const tabContent = {
    client:     <StepClient     form={live} set={set} ro={!edit}/>,
    commercial: <StepCommercial form={live} set={set} ro={!edit}/>,
    fees:       <StepFees       form={live} set={set} ro={!edit}/>,
    terms:      <StepTerms      form={live} set={set} ro={!edit}/>,
    signatory:  <StepSignatory  form={live} set={set} ro={!edit}/>,
  };

  const handleRevopsApprove = async () => {
    if (!finDRIs.length) { alert('Select at least one Finance DRI.'); return; }
    await revopsApprove(form.id, { editedForm: edit?ef:{}, comment:cmt, financeApprovers:finDRIs });
    show('Sent to Finance!'); setEdit(false);
  };

  const handleFinanceApprove = async () => {
    if (!ofNum) { alert('Enter OF Number first.'); return; }
    await financeApprove(form.id, { ofNumber:ofNum, comment:cmt, editedForm:edit?ef:{} });
    show(`✓ Approved! OF# ${ofNum}`); setEdit(false);
  };

  const handleMarkSigned = async () => {
    if (!sigDate) { alert('Enter signing date.'); return; }
    await markSigned(form.id, sigDate);
    show('Marked as signed ✓');
  };

  const handleClone = async () => {
    const clone = await cloneForm(form);
    show('Cloned! Redirecting to new draft…');
    setTimeout(() => navigate(`/form/${clone.id}`), 1000);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this draft? This cannot be undone.')) return;
    await deleteDraft(form.id);
    navigate('/dashboard');
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-brand-faint">←</button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold" style={{ color:NAVY }}>{form.customer_name}</h2>
              <StatusPill status={form.status}/>
              {form.of_number && (
                <span className="font-mono text-sm font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-800">{form.of_number}</span>
              )}
            </div>
            <p className="text-sm mt-0.5 text-brand-faint">{form.brand_name} · {form.sales_rep_name} · {fmtShort(form.submitted_at)}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && <Btn variant="ghost" size="sm" onClick={() => { setEdit(e=>!e); setEf({...form}); }}>{edit?'✕ Cancel':'✏️ Edit'}</Btn>}
          {canDelete && !['approved','signed'].includes(form.status) && <Btn variant="ghost" size="sm" onClick={handleDelete}>🗑 Delete</Btn>}
          {(user?.role==='sales'||user?.role==='revops'||user?.isUniversal) && (
            <Btn variant="ghost" size="sm" onClick={handleClone}>📋 Clone</Btn>
          )}
          <Btn variant="ghost" size="sm" onClick={() => openPDF(live)}>📄 Preview PDF</Btn>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-slate-100">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all"
            style={tab===t.id ? {background:'#fff',color:NAVY,boxShadow:'0 1px 3px rgba(0,0,0,0.08)'} : {color:'#94a3b8'}}>
            {t.lbl}
          </button>
        ))}
      </div>

      <Card className="p-6">{tabContent[tab]}</Card>

      {/* SoW downloads */}
      {(form.sow_document || form.sow_reference_document) && 
      {(form.attachments||[]).length > 0 && (
  <Card className="mt-4 p-5">
    <p className="text-xs font-bold uppercase tracking-widest mb-3 text-brand-faint">Additional Attachments</p>
    <div className="flex gap-3 flex-wrap">
      {(form.attachments||[]).map((f,i) => (
        <a key={i} href={f.data} download={f.name}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-100 transition-colors">
          📎 {f.name}
        </a>
      ))}
    </div>
  </Card>
)}
        <Card className="mt-4 p-5">
          <p className="text-xs font-bold uppercase tracking-widest mb-3 text-brand-faint">Scope of Work Documents</p>
          <div className="flex gap-3 flex-wrap">
            {form.sow_document && (
              <a href={form.sow_document.data} download={form.sow_document.name}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium hover:bg-green-100 transition-colors">
                📎 {form.sow_document.name}
              </a>
            )}
            {form.sow_reference_document && (
              <a href={form.sow_reference_document.data} download={form.sow_reference_document.name}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium hover:bg-amber-100 transition-colors">
                📎 Ref: {form.sow_reference_document.name}
              </a>
            )}
          </div>
        </Card>
      )}

      {/* Universal — submit draft on behalf of Sales Rep */}
      {user?.isUniversal && form.status==='draft' && (
        <Card className="mt-4 p-6">
          <h3 className="font-bold mb-2" style={{ color:NAVY }}>🚀 Submit draft (Universal)</h3>
          <p className="text-sm text-brand-muted mb-4">You can finalise this draft and submit it for RevOps review on behalf of the Sales Rep.</p>
          {edit && <div className="mb-4 p-3 rounded-xl text-sm bg-blue-50 border border-blue-200 text-blue-700">ℹ️ Save edits first, then submit.</div>}
          <MultiSelect
            label="Select RevOps reviewer(s)"
            req
            options={REVOPS_USERS.map(u => ({ value:u.email, label:u.name }))}
            value={finDRIs}
            onChange={setFinDRIs}
          />
          <div className="flex gap-3 flex-wrap mt-2">
            {edit && <Btn variant="navy" onClick={async () => { await revopsApprove(form.id,{editedForm:ef,comment:'',financeApprovers:[]}); setEdit(false); show('Edits saved!'); }}>💾 Save edits</Btn>}
            <Btn onClick={async () => {
              if (!finDRIs.length) { alert('Select at least one RevOps reviewer.'); return; }
              const now = new Date().toISOString();
              await revopsApprove(form.id, {
                editedForm: { ...form, status:'submitted', submitted_at: now, revops_approvers: finDRIs },
                comment: 'Submitted by Universal user',
                financeApprovers: [],
              });
              show('Draft submitted for RevOps review!');
            }}>Submit for RevOps review →</Btn>
          </div>
        </Card>
      )}

      {/* RevOps review panel */}
      {(user?.role==='revops'||user?.isUniversal) && form.status==='submitted' && (
        <Card className="mt-4 p-6">
          <h3 className="font-bold mb-4" style={{ color:NAVY }}>🔍 RevOps review</h3>
          {edit && <div className="mb-4 p-3 rounded-xl text-sm bg-blue-50 border border-blue-200 text-blue-700">ℹ️ Save edits first, then approve or reject.</div>}
          <TA label="Review comment (optional)" value={cmt} onChange={setCmt}/>
          <MultiSelect
            label="Forward to Finance DRI(s)"
            req
            options={FINANCE_USERS.map(u => ({ value:u.email, label:u.name }))}
            value={finDRIs}
            onChange={setFinDRIs}
          />
          <div className="flex gap-3 flex-wrap mt-2">
            {edit && <Btn variant="navy" onClick={() => { revopsApprove(form.id,{editedForm:ef,comment:cmt,financeApprovers:finDRIs}); setEdit(false); show('Edits saved!'); }}>💾 Save edits</Btn>}
            <Btn variant="success" onClick={handleRevopsApprove}>✓ Approve → Finance</Btn>
            <Btn variant="danger"  onClick={async () => { await revopsReject(form.id,{comment:cmt}); show('Form rejected.','error'); }}>✕ Reject</Btn>
          </div>
        </Card>
      )}

      {/* Finance panel */}
      {(user?.role==='finance'||user?.isUniversal) && form.status==='revops_approved' && (
        <Card className="mt-4 p-6">
          <h3 className="font-bold mb-4" style={{ color:NAVY }}>💼 Finance approval</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Lbl c="OF Number" req/>
              <input value={ofNum} onChange={e=>setOfNum(e.target.value)} placeholder="OF-FY-0XXX"
                className="w-full text-base border-2 rounded-lg px-3 py-2 font-mono font-bold focus:outline-none"
                style={{ borderColor:T, color:NAVY }}/>
            </div>
          </div>
          <TA label="Finance comment (optional)" value={cmt} onChange={setCmt}/>
          <div className="flex gap-3">
            <Btn onClick={handleFinanceApprove}>✓ Approve &amp; assign OF#</Btn>
            <Btn variant="danger" onClick={async () => { await financeReject(form.id,{comment:cmt}); show('Sent back to queue.','error'); }}>↩ Send back</Btn>
          </div>
        </Card>
      )}

      {/* Approved — mark signed */}
      {(user?.role==='finance'||user?.isUniversal) && form.status==='approved' && (
        <Card className="mt-4 p-6">
          <h3 className="font-bold mb-4 text-green-800">✅ Mark as signed</h3>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Lbl c="Signing date" req/>
              <input type="date" value={sigDate} onChange={e=>setSigDate(e.target.value)} className="field-input" style={{ borderColor:'#e2e8f0' }}/>
            </div>
            <Btn variant="success" onClick={handleMarkSigned}>Mark Signed ✍️</Btn>
            <Btn variant="ghost" size="sm" onClick={() => openPDF(form)}>📄 Download PDF</Btn>
          </div>
        </Card>
      )}

      {/* Signed */}
      {form.status === 'signed' && (
        <div className="mt-4 rounded-2xl p-5 flex items-center justify-between bg-green-50 border border-green-200">
          <div>
            <p className="font-bold text-green-800">✍️ Signed</p>
            <p className="text-sm mt-0.5 text-green-700">Signed on {fmtDate(form.signed_date)} · OF# <strong className="font-mono">{form.of_number}</strong></p>
          </div>
          <Btn onClick={() => openPDF(form)}>📄 Download PDF</Btn>
        </div>
      )}

      {/* Audit trail */}
      <Card className="mt-4 p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest mb-3 text-brand-faint">Audit trail</p>
        <div className="space-y-2">
          {form.submitted_at && (
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="w-20 shrink-0 text-slate-300">{fmtDate(form.submitted_at.split('T')[0])}</span>
              Submitted by <strong>{form.sales_rep_name}</strong>
            </div>
          )}
          {form.revops_reviewed_at && (
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="w-20 shrink-0 text-slate-300">{fmtDate(form.revops_reviewed_at.split('T')[0])}</span>
              RevOps {form.status==='revops_rejected'?'rejected':'approved'}{form.revops_comment && ` — "${form.revops_comment}"`}
            </div>
          )}
          {form.approved_at && (
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="w-20 shrink-0 text-slate-300">{fmtDate(form.approved_at.split('T')[0])}</span>
              Finance approved · <strong className="font-mono">{form.of_number}</strong>
            </div>
          )}
          {form.signed_date && (
            <div className="flex gap-3 text-xs text-slate-500">
              <span className="w-20 shrink-0 text-slate-300">{fmtDate(form.signed_date)}</span>
              Signed
            </div>
          )}
        </div>
      </Card>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}
