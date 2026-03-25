import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, StatusPill, Btn, Lbl, Sel, TA, Inp, MultiSelect, Toast } from '../ui/index.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { FINANCE_USERS } from '../../constants/users.js';
import { fmtDate } from '../../utils/dates.js';
import { useToast } from '../../hooks/useToast.js';

const NAVY='#1B2B4B';

// ── SIGNED OFs ─────────────────────────────────────────────────────────────
export function SignedOFs() {
  const { forms, markSigned } = useForms();
  const navigate = useNavigate();
  const { toast, show, hide } = useToast();

  const approved = forms.filter(f => f.status==='approved' && !f.signed_date);
  const signed   = forms.filter(f => f.signed_date || f.status==='signed');
  const [signingData, setSigningData] = useState({}); // { [id]: { date, link } }

  const updateField = (id, field, val) =>
    setSigningData(d => ({ ...d, [id]: { ...(d[id]||{}), [field]: val } }));

  const handleMarkSigned = async (f) => {
    const data = signingData[f.id] || {};
    if (!data.date) { alert('Enter signing date first.'); return; }
    await markSigned(f.id, data.date, data.link || '');
    show(`${f.of_number} marked as signed ✓`);
  };

  const thCls = "text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-brand-faint bg-slate-50";

  return (
    <div>
      <h2 className="text-xl font-bold mb-6" style={{ color:NAVY }}>Signed Order Forms</h2>

      {approved.length > 0 && (
        <>
          <h3 className="font-semibold text-sm mb-3 text-amber-700">⏳ Approved but not yet signed ({approved.length})</h3>
          <Card className="overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead><tr>
                {['OF#','Customer','Value','Approved On','Signing Date','Signed PDF Link','Action'].map(h=><th key={h} className={thCls}>{h}</th>)}
              </tr></thead>
              <tbody>
                {approved.map(f => {
                  const data = signingData[f.id] || {};
                  // Flag overdue (30+ days)
                  const sentDate = f.approved_at || f.submitted_at;
                  const daysSince = sentDate ? Math.floor((new Date()-new Date(sentDate))/86400000) : null;
                  const overdue = daysSince !== null && daysSince >= 30;
                  return (
                    <tr key={f.id} className={`border-b border-slate-50 last:border-0 ${overdue?'bg-red-50':''}`}>
                      <td className="px-4 py-3 font-mono font-bold text-navy">
                        {f.of_number}
                        {overdue && <span className="ml-2 text-xs text-red-600 font-bold bg-red-100 px-1.5 py-0.5 rounded-full">{daysSince}d</span>}
                      </td>
                      <td className="px-4 py-3 cursor-pointer hover:underline font-medium" style={{ color:NAVY }}
                          onClick={()=>navigate(`/form/${f.id}`)}>{f.customer_name}</td>
                      <td className="px-4 py-3 text-xs">{f.committed_currency} {Number(f.committed_revenue||0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-xs text-brand-muted">{fmtDate(f.approved_at?.split('T')[0])}</td>
                      <td className="px-4 py-3">
                        <input type="date" value={data.date||''} onChange={e=>updateField(f.id,'date',e.target.value)}
                          className="field-input text-xs" style={{ borderColor:'#e2e8f0', width:'140px' }}/>
                      </td>
                      <td className="px-4 py-3">
                        <input type="url" value={data.link||''} onChange={e=>updateField(f.id,'link',e.target.value)}
                          placeholder="Paste signed PDF link…"
                          className="field-input text-xs" style={{ borderColor:'#e2e8f0', width:'220px' }}/>
                      </td>
                      <td className="px-4 py-3">
                        <Btn size="sm" variant="success" disabled={!data.date}
                          onClick={() => handleMarkSigned(f)}>
                          ✍️ Mark signed
                        </Btn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      <h3 className="font-semibold text-sm mb-3 text-green-700">✅ Signed ({signed.length})</h3>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr>
            {['OF#','Customer','Value','Signed On','Signed PDF'].map(h=><th key={h} className={thCls}>{h}</th>)}
          </tr></thead>
          <tbody>
            {signed.length===0 && <tr><td colSpan={5} className="text-center py-12 text-slate-300">No signed OFs yet.</td></tr>}
            {signed.map(f => (
              <tr key={f.id} className="border-b border-slate-50 last:border-0 cursor-pointer hover:bg-slate-50"
                  onClick={()=>navigate(`/form/${f.id}`)}>
                <td className="px-4 py-3 font-mono font-bold" style={{ color:NAVY }}>{f.of_number}</td>
                <td className="px-4 py-3 font-medium" style={{ color:NAVY }}>{f.customer_name}</td>
                <td className="px-4 py-3 text-xs">{f.committed_currency} {Number(f.committed_revenue||0).toLocaleString('en-IN')}</td>
                <td className="px-4 py-3 text-xs text-brand-muted">{fmtDate(f.signed_date)}</td>
                <td className="px-4 py-3 text-xs">
                  {f.signed_of_link
                    ? <a href={f.signed_of_link} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                        className="text-teal font-medium hover:underline">📎 View signed PDF</a>
                    : <span className="text-slate-300">—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}

// ── CHURN/VOID REQUEST ─────────────────────────────────────────────────────
export function ChurnVoidRequest() {
  const { forms, submitChurnVoidRequest } = useForms();
  const { toast, show, hide } = useToast();
  const [req, setReq] = useState({
    customer:'', of_number:'', status_requested:'Churn',
    churn_value:'', reason:'', finance_dris:[],
  });
  const u = (k,v) => setReq(r => ({...r,[k]:v}));
  const approvedForms = forms.filter(f => ['approved','signed'].includes(f.status));

  const handleSubmit = async () => {
    if (!req.customer || !req.status_requested || !req.finance_dris.length) {
      alert('Please fill all required fields and select at least one Finance DRI.');
      return;
    }
    const form = forms.find(f => f.customer_name===req.customer || f.of_number===req.of_number);
    await submitChurnVoidRequest({ form:form||{customer_name:req.customer,of_number:req.of_number}, statusRequested:req.status_requested, churnValue:req.churn_value, reason:req.reason });
    show('Request sent to Finance via Slack ✓');
    setReq({ customer:'', of_number:'', status_requested:'Churn', churn_value:'', reason:'', finance_dris:[] });
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{ color:NAVY }}>Churn / Void Request</h2>
      <p className="text-sm text-brand-muted mb-6">File a request to Finance to mark a deal as Churn or Void.</p>
      <Card className="p-6 max-w-2xl">
        <div className="grid grid-cols-2 gap-x-4">
          <Sel label="Client / Customer" req
            options={[...new Set(approvedForms.map(f=>f.customer_name))].map(n=>({value:n,label:n}))}
            value={req.customer} onChange={v=>u('customer',v)}/>
          <Sel label="Order Form #" req
            options={approvedForms.filter(f=>!req.customer||f.customer_name===req.customer).map(f=>({value:f.of_number,label:f.of_number}))}
            value={req.of_number} onChange={v=>u('of_number',v)}/>
        </div>
        <div className="mb-4">
          <Lbl c="Status requested" req/>
          <div className="flex gap-3">
            {['Churn','Void'].map(opt => (
              <button key={opt} type="button" onClick={()=>u('status_requested',opt)}
                className="px-5 py-2 text-sm font-semibold rounded-lg border transition-all"
                style={req.status_requested===opt
                  ? {background:'#1B2B4B',color:'#fff',borderColor:'#1B2B4B'}
                  : {background:'#f8fafc',color:'#64748b',borderColor:'#e2e8f0'}}>
                {opt}
              </button>
            ))}
          </div>
        </div>
        {req.status_requested==='Churn' && (
          <Inp label="Churn amount (portion of OF value)" value={req.churn_value} onChange={v=>u('churn_value',v)} placeholder="e.g. 150000" mono/>
        )}
        {req.status_requested==='Void' && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            ⚠️ Marking as Void will set the OF value to <strong>zero</strong>.
          </div>
        )}
        <TA label="Reason / justification" req value={req.reason} onChange={v=>u('reason',v)} rows={4}/>
        <MultiSelect
          label="Notify Finance DRI(s)" req
          options={FINANCE_USERS.map(u=>({value:u.email,label:u.name}))}
          value={req.finance_dris} onChange={v=>u('finance_dris',v)}/>
        <p className="text-xs text-brand-faint mb-4">Selected Finance DRIs will receive a Slack message.</p>
        <Btn onClick={handleSubmit}>Submit request →</Btn>
      </Card>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}
