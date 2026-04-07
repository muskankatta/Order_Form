import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Btn, ErrorBanner } from '../ui/index.jsx';
import StepClient from './steps/StepClient.jsx';
import StepCommercial from './steps/StepCommercial.jsx';
import StepFees from './steps/StepFees.jsx';
import { StepTerms, StepSignatory } from './steps/StepTermsSignatory.jsx';
import { MultiSelect } from '../ui/index.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useFormWizard } from '../../hooks/useFormWizard.js';
import { REVOPS_USERS } from '../../constants/users.js';
import { FORM_STEPS } from '../../constants/status.js';
import { getFY } from '../../utils/dates.js';
import { sendEmail, svcNames } from '../../utils/email.js';

const T = '#00C3B5'; const NAVY = '#1B2B4B';

export default function FormWizard({ initial = null, onSaved }) {
  const { saveDraft, submitForm } = useForms();
  const navigate = useNavigate();
  const { step, setStep, form, set, validate, errors } = useFormWizard(initial);
  const [revopsApprovers, setRevopsApprovers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const stepProps = { form, set, ro: false };
  const comps = [
    <StepClient   {...stepProps}/>,
    <StepCommercial {...stepProps}/>,
    <StepFees     {...stepProps}/>,
    <StepTerms    {...stepProps}/>,
    <StepSignatory {...stepProps}/>,
  ];

  const handleDraft = async () => {
    await saveDraft(form);
    onSaved?.();
    navigate('/dashboard');
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!revopsApprovers.length) { alert('Please select at least one RevOps reviewer.'); return; }
    setSubmitting(true);
    try {
      await submitForm(form, revopsApprovers);
      sendEmail(
        [form.sales_rep_email, ...revopsApprovers].filter(Boolean).join(','),
        '[Fynd OF] New Submission — ' + form.customer_name,
        'A new Order Form has been submitted and is pending RevOps review.\n\n' +
        'Customer: ' + form.customer_name + '\n' +
        'Brand: ' + form.brand_name + '\n' +
        'Sales Rep: ' + form.sales_rep_name + '\n' +
        'Service(s): ' + svcNames(form) + '\n' +
        'OF Value: ' + (form.committed_currency || 'INR') + ' ' + Number(form.of_value || 0).toLocaleString('en-IN') + '\n' +
        'Start Date: ' + (form.start_date || '—') + '\n\n' +
        'Log in to review:\nhttps://muskankatta.github.io/Order_Form/'
      );
      navigate('/dashboard');
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      {/* Step tabs */}
      <div className="flex items-center gap-1 mb-7 flex-wrap">
        {FORM_STEPS.map((s,i) => (
          <div key={s.id} className="flex items-center gap-1">
            <button onClick={() => setStep(i)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all"
              style={i===step ? {background:NAVY, color:'#fff'} : {background:'#f1f5f9', color:'#94a3b8'}}>
              {s.icon} {s.lbl}
            </button>
            {i < FORM_STEPS.length-1 && (
              <div className="w-3 h-px" style={{ background:i<step?T:'#e2e8f0' }}/>
            )}
          </div>
        ))}
      </div>

      <ErrorBanner errors={errors}/>

      <Card className="p-6">{comps[step]}</Card>

      {/* RevOps approver selection — only on last step */}
      {step === FORM_STEPS.length - 1 && (
        <Card className="p-5 mt-4">
          <MultiSelect
            label="Select RevOps reviewer(s) — first selected is Primary DRI"
            req
            options={REVOPS_USERS.map(u => ({ value:u.email, label:u.name }))}
            value={revopsApprovers}
            onChange={setRevopsApprovers}
          />
          {revopsApprovers.length > 0 && (
            <div className="mt-2 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
              <strong>Primary DRI:</strong> {(REVOPS_USERS.find(u=>u.email===revopsApprovers[0])||{}).name || revopsApprovers[0]} — will review and approve/reject
              {revopsApprovers.length > 1 && (
                <span className="ml-2 text-blue-500">
                  · CC: {revopsApprovers.slice(1).map(e=>(REVOPS_USERS.find(u=>u.email===e)||{}).name||e).join(', ')} (notified only)
                </span>
              )}
            </div>
          )}
          {!revopsApprovers.length && (
            <p className="text-xs text-amber-600 mt-1">At least one RevOps reviewer is required to submit.</p>
          )}
        </Card>
      )}

      {/* Footer */}
      <div className="flex justify-between mt-5">
        <div className="flex gap-2">
          {step > 0 && <Btn variant="ghost" onClick={() => setStep(s=>s-1)}>← Back</Btn>}
          <Btn variant="ghost" size="sm" onClick={handleDraft}>💾 Save draft</Btn>
        </div>
        {step < FORM_STEPS.length - 1
          ? <Btn onClick={() => setStep(s=>s+1)}>Next →</Btn>
          : <Btn onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit for review →'}
            </Btn>
        }
      </div>
    </div>
  );
}
