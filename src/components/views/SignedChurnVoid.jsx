import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Btn, Lbl, Sel, TA, Inp, MultiSelect, Toast } from '../ui/index.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { FINANCE_USERS } from '../../constants/users.js';
import { fmtDate, uid } from '../../utils/dates.js';
import { useToast } from '../../hooks/useToast.js';
import { db, isConfigured } from '../../firebase.js';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';

const NAVY = '#1B2B4B';

export function SignedOFs() {
  const { forms, markSigned, applyDealStatus } = useForms();
  const { user }   = useAuth();
  const navigate   = useNavigate();
  const { toast, show, hide } = useToast();
  const [cvTab,       setCvTab]      = useState('unsigned');
  const [signingData, setSigningData] = useState({});
  const [cvRequests,  setCvRequests]  = useState([]);

  useEffect(() => {
    if (!isConfigured || !db) return;
    const unsub = onSnapshot(collection(db, 'churn_void_requests'), snap => {
      setCvRequests(
        snap.docs.map(d => d.data())
          .filter(r => !r.actioned)
          .sort((a,b) => (b.requested_at||'').localeCompare(a.requested_at||''))
      );
    });
    return () => unsub();
  }, []);

  const approved = forms.filter(f => f.status === 'approved' && !f.signed_date);
  const signed   = forms.filter(f => f.signed_date || f.status === 'signed');

  const updateField = (id, field, val) =>
    setSigningData(d => ({ ...d, [id]: { ...(d[id]||{}), [field]: val } }));

  const handleMarkSigned = async (f) => {
    const data = signingData[f.id] || {};
    if (!data.date) { alert('Enter signing date first.'); return; }
    await markSigned(f.id, data.date, data.link || '');
    show(f.of_number + ' marked as signed \u2713');
  };

  const handleApply = async (r) => {
    const form = forms.find(f => f.id === r.form_id || f.of_number === r.of_number);
    if (!form) { alert('Order Form not found.'); return; }
    await applyDealStatus(form.id, {
      status: r.status_requested.toLowerCase(),
      ...(r.status_requested === 'Void'  ? { is_void:true,  of_value:0, committed_revenue:0 } : {}),
      ...(r.status_requested === 'Churn' ? { is_churn:true } : {}),
      status_change_comment: r.reason,
      status_changed_by: user?.name,
      status_changed_at: new Date().toISOString(),
    });
    if (isConfigured && db) {
      await updateDoc(doc(db, 'churn_void_requests', r.id), {
        actioned: true, actioned_by: user?.name, actioned_at: new Date().toISOString(),
      });
    }
    show('Status applied \u2014 ' + r.status_requested + ' \u2713');
  };

  const handleDismiss = async (r) => {
    if (!confirm('Dismiss this request without applying?')) return;
    if (isConfigured && db) {
      await updateDoc(doc(db, 'churn_void_requests', r.id), {
        actioned: true, actioned_by: user?.name, actioned_at: new Date().toISOString(), rejected: true,
      });
    }
    show('Request dismissed');
  };

  const thCls = "text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-brand-faint bg-slate-50";

  const tabs = [
    { id:'unsigned', lbl:'Pending Signing' + (approved.length ? ' (' + approved.length + ')' : '') },
    { id:'requests', lbl:'Churn/Void Requests' + (cvRequests.length ? ' (' + cvRequests.length + ')' : '') },
    { id:'signed',   lbl:'Signed (' + signed.length + ')' },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-6" style={{ color:NAVY }}>Signed Order Forms</h2>

      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setCvTab(t.id)}
            className="px-4 py-2 text-sm font-semibold rounded-xl border transition-all"
            style={cvTab===t.id
              ? {background:NAVY,color:'#fff',borderColor:NAVY}
              : {background:'#f8fafc',color:'#64748b',borderColor:'#e2e8f0'}}>
            {t.lbl}
          </button>
        ))}
      </div>

      {cvTab === 'unsigned' && (
        approved.length === 0
          ? <Card className="p-12 text-center text-slate-300">No OFs pending signing \uD83C\uDF89</Card>
          : <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr>
                  {['OF#','Customer','Value','Approved On','Signing Date','Signed PDF Link','Action'].map(h => (
                    <th key={h} className={thCls}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {approved.map(f => {
                    const data = signingData[f.id] || {};
                    const sentDate = f.approved_at || f.submitted_at;
                    const daysSince = sentDate ? Math.floor((new Date()-new Date(sentDate))/86400000) : null;
                    const overdue = daysSince !== null && daysSince >= 30;
                    return (
                      <tr key={f.id} className={'border-b border-slate-50 last:border-0 ' + (overdue?'bg-red-50':'')}>
                        <td className="px-4 py-3 font-mono font-bold" style={{color:NAVY}}>
                          {f.of_number}
                          {overdue && <span className="ml-2 text-xs text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full font-bold">{daysSince}d</span>}
                        </td>
                        <td className="px-4 py-3 cursor-pointer hover:underline font-medium" style={{color:NAVY}} onClick={()=>navigate('/form/'+f.id)}>{f.customer_name}</td>
                        <td className="px-4 py-3 text-xs">{f.committed_currency} {Number(f.committed_revenue||0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-xs text-brand-muted">{fmtDate(f.approved_at?.split('T')[0])}</td>
                        <td className="px-4 py-3">
                          <input type="date" value={data.date||''} onChange={e=>updateField(f.id,'date',e.target.value)}
                            className="field-input text-xs" style={{borderColor:'#e2e8f0',width:'140px'}}/>
                        </td>
                        <td className="px-4 py-3">
                          <input type="url" value={data.link||''} onChange={e=>updateField(f.id,'link',e.target.value)}
                            placeholder="Paste signed PDF link\u2026"
                            className="field-input text-xs" style={{borderColor:'#e2e8f0',width:'200px'}}/>
                        </td>
                        <td className="px-4 py-3">
                          <Btn size="sm" variant="success" disabled={!data.date} onClick={()=>handleMarkSigned(f)}>
                            Mark signed
                          </Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
      )}

      {cvTab === 'requests' && (
        <div>
          <p className="text-sm text-brand-muted mb-4">Requests filed by RevOps. Review and apply or dismiss each one.</p>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr>
                {['OF#','Customer','Request','Churn Amount','Reason','Filed By','Date','Action'].map(h => (
                  <th key={h} className={thCls}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {cvRequests.length===0 && (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-300">No pending Churn/Void requests \uD83C\uDF89</td></tr>
                )}
                {cvRequests.map(r => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-mono font-bold text-sm" style={{color:NAVY}}>{r.of_number||'\u2014'}</td>
                    <td className="px-4 py-3 text-sm font-medium" style={{color:NAVY}}>{r.customer_name}</td>
                    <td className="px-4 py-3">
                      <span className={'text-xs px-2 py-1 rounded-full font-bold ' + (r.status_requested==='Void'?'bg-red-100 text-red-700':'bg-orange-100 text-orange-700')}>
                        {r.status_requested}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-muted">{r.churn_value||'\u2014'}</td>
                    <td className="px-4 py-3 text-xs text-brand-muted" style={{maxWidth:'180px'}}>{r.reason||'\u2014'}</td>
                    <td className="px-4 py-3 text-xs text-brand-muted">{r.requested_by}</td>
                    <td className="px-4 py-3 text-xs text-brand-muted">{r.requested_at?.split('T')[0]}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={()=>handleApply(r)} className="text-xs font-medium px-2 py-1 rounded-lg bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors">Apply</button>
                        <button onClick={()=>handleDismiss(r)} className="text-xs font-medium px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors">Dismiss</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {cvTab === 'signed' && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr>
              {['OF#','Customer','Value','Signed On','Signed PDF'].map(h => (
                <th key={h} className={thCls}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {signed.length===0 && <tr><td colSpan={5} className="text-center py-12 text-slate-300">No signed OFs yet.</td></tr>}
              {signed.map(f => (
                <tr key={f.id} className="border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50" onClick={()=>navigate('/form/'+f.id)}>
                  <td className="px-4 py-3 font-mono font-bold" style={{color:NAVY}}>{f.of_number}</td>
                  <td className="px-4 py-3 font-medium" style={{color:NAVY}}>{f.customer_name}</td>
                  <td className="px-4 py-3 text-xs">{f.committed_currency} {Number(f.committed_revenue||0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-xs text-brand-muted">{fmtDate(f.signed_date)}</td>
                  <td className="px-4 py-3 text-xs">
                    {f.signed_of_link
                      ? <a href={f.signed_of_link} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="font-medium hover:underline" style={{color:'#00C3B5'}}>View signed PDF</a>
                      : <span className="text-slate-300">\u2014</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}

export function ChurnVoidRequest() {
  const { forms, submitChurnVoidRequest } = useForms();
  const { user }  = useAuth();
  const { toast, show, hide } = useToast();
  const [req, setReq] = useState({
    customer:'', of_number:'', status_requested:'Churn',
    churn_value:'', reason:'', finance_dris:[],
  });
  const u = (k,v) => setReq(r => ({...r,[k]:v}));

 const approvedForms = forms.filter(
  f => f.status === 'approved' || f.status === 'signed' || f.signed_date
);
  const customerNames = [...new Set(approvedForms.map(f=>f.customer_name?.trim()))]
    .filter(Boolean).sort((a,b)=>a.localeCompare(b));
  const relevantOFs = approvedForms
    .filter(f => !req.customer || f.customer_name?.trim()===req.customer?.trim())
    .sort((a,b)=>(a.of_number||'').localeCompare(b.of_number||''));

  const handleSubmit = async () => {
  try {
    if (!req.customer || !req.of_number || !req.status_requested || !req.reason || !req.finance_dris.length) {
      alert('Please fill all required fields, including reason, and select at least one Finance DRI.');
      return;
    }

    const form = forms.find(
      f => f.customer_name?.trim() === req.customer?.trim() && f.of_number === req.of_number
    );

    const reqId = uid();

    if (isConfigured && db) {
      await setDoc(doc(db, 'churn_void_requests', reqId), {
        id: reqId,
        form_id: form?.id || '',
        of_number: req.of_number,
        customer_name: req.customer,
        status_requested: req.status_requested,
        churn_value: req.churn_value || '',
        reason: req.reason,
        finance_dris: req.finance_dris,
        requested_by: user?.name || '',
        requested_at: new Date().toISOString(),
        actioned: false,
      });
    }

    await submitChurnVoidRequest({
      form: form || { customer_name: req.customer, of_number: req.of_number },
      statusRequested: req.status_requested,
      churnValue: req.churn_value,
      reason: req.reason,
      financeDris: req.finance_dris,
    });

    show('Request submitted — Finance will be notified via Slack ✓');

    setReq({
      customer: '',
      of_number: '',
      status_requested: 'Churn',
      churn_value: '',
      reason: '',
      finance_dris: [],
    });

  } catch (err) {
    console.error('Churn/Void submit failed:', err);
    alert(err?.message || 'Failed to submit request.');
  }
};
    setReq({customer:'',of_number:'',status_requested:'Churn',churn_value:'',reason:'',finance_dris:[]});
  };

    return (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{color:NAVY}}>Churn / Void Request</h2>
      <p className="text-sm text-brand-muted mb-6">
        File a request to Finance to mark a deal as Churn or Void.
        Finance will review it in <strong>Signed OFs → Churn/Void Requests</strong>.
      </p>

      <Card className="p-6 max-w-2xl">
        <div className="grid grid-cols-2 gap-x-4">
          <Sel
            label="Client / Customer"
            req
            options={customerNames.map(n => ({ value: n, label: n }))}
            value={req.customer}
            onChange={v => {
              u('customer', v);
              u('of_number', '');
            }}
          />
          <Sel
            label="Order Form #"
            req
            options={relevantOFs.map(f => ({
              value: f.of_number,
              label: f.of_number + ' — ' + f.customer_name
            }))}
            value={req.of_number}
            onChange={v => u('of_number', v)}
            hint={!req.customer ? 'Select a customer first' : ''}
          />
        </div>

        <div className="mb-4">
          <Lbl c="Status requested" req />
          <div className="flex gap-3">
            {['Churn', 'Void'].map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => u('status_requested', opt)}
                className="px-5 py-2 text-sm font-semibold rounded-lg border transition-all"
                style={
                  req.status_requested === opt
                    ? { background:'#1B2B4B', color:'#fff', borderColor:'#1B2B4B' }
                    : { background:'#f8fafc', color:'#64748b', borderColor:'#e2e8f0' }
                }
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {req.status_requested === 'Churn' && (
          <Inp
            label="Churn amount (portion of OF value)"
            value={req.churn_value}
            onChange={v => u('churn_value', v)}
            placeholder="e.g. 150000"
            mono
            hint="Enter the portion of the contracted OF value that should be considered churned."
          />
        )}

        {req.status_requested === 'Void' && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            Warning: Marking as Void will set the OF value to zero.
          </div>
        )}

        <TA
          label="Reason / justification"
          req
          value={req.reason}
          onChange={v => u('reason', v)}
          rows={4}
        />

        <MultiSelect
          label="Notify Finance DRI(s)"
          req
          options={FINANCE_USERS.map(u => ({ value: u.email, label: u.name }))}
          value={req.finance_dris}
          onChange={v => u('finance_dris', v)}
        />

        <p className="text-xs text-brand-faint mb-4">
          Selected Finance DRIs will receive a Slack message and see the request in their Signed OFs page.
        </p>

        <Btn onClick={handleSubmit}>Submit request →</Btn>
      </Card>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  );
}
