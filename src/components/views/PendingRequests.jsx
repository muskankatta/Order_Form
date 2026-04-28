import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Card, StatusPill } from '../ui/index.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { REVOPS_USERS, FINANCE_USERS } from '../../constants/users.js';
import { fmtShort } from '../../utils/dates.js';
import { db } from '../../firebase.js';
import { collection, getDocs, query, where } from 'firebase/firestore';

const NAVY = '#1B2B4B';

// ── OF Section (unchanged) ────────────────────────────────────────────────────
function Section({ title, subtitle, color, forms, onSelect, emptyMsg, sectionRef }) {
  return (
    <div className="mb-8" ref={sectionRef}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-1 h-6 rounded-full" style={{ background: color }}/>
        <div>
          <h3 className="font-bold text-sm" style={{ color: NAVY }}>{title}</h3>
          {subtitle && <p className="text-xs text-brand-muted">{subtitle}</p>}
        </div>
        <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full text-white"
          style={{ background: color }}>{forms.length}</span>
      </div>
      {forms.length === 0
        ? <div className="py-8 text-center text-sm text-slate-300 bg-slate-50 rounded-2xl">{emptyMsg}</div>
        : <Card className="overflow-hidden">
            {forms.map((f, i) => (
              <div key={f.id} onClick={() => onSelect(f)}
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                style={{ borderBottom: i < forms.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" style={{ color: NAVY }}>{f.customer_name}</span>
                    {f.of_number && (
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {f.of_number}
                      </span>
                    )}
                    {f.is_renewal && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">
                        Renewal
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-brand-muted mt-0.5">
                    {(f.services_fees||[]).map(s=>s.name).filter(Boolean).join(', ')||'—'}
                    {' · '}{f.committed_currency||'INR'} {Number(f.committed_revenue||0).toLocaleString('en-IN')||'—'}
                    {' · '}{f.sales_rep_name}
                  </div>
                  {f.status==='submitted' && f.revops_approvers?.length > 0 && (
                    <div className="text-xs mt-1 text-brand-faint">
                      Primary RevOps: <strong>{(REVOPS_USERS.find(u=>u.email===f.revops_approvers[0])||{}).name || f.revops_approvers[0]}</strong>
                      {f.revops_approvers.length > 1 && <span className="ml-1 text-slate-300">+{f.revops_approvers.length-1} CC</span>}
                    </div>
                  )}
                  {f.status==='revops_approved' && f.finance_approvers?.length > 0 && (
                    <div className="text-xs mt-1 text-brand-faint">
                      Primary Finance: <strong>{(FINANCE_USERS.find(u=>u.email===f.finance_approvers[0])||{}).name || f.finance_approvers[0]}</strong>
                      {f.finance_approvers.length > 1 && <span className="ml-1 text-slate-300">+{f.finance_approvers.length-1} CC</span>}
                    </div>
                  )}
                  {(f.revops_comment || f.finance_comment) && (
                    <div className="text-xs mt-1 px-2 py-1 rounded-lg bg-red-50 text-red-600 border border-red-100 inline-block">
                      💬 {f.revops_comment || f.finance_comment}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <div className="text-right">
                    <StatusPill status={f.status}/>
                    <div className="text-[10px] text-brand-faint mt-1">
                      {fmtShort(f.submitted_at || f.created_at)}
                    </div>
                  </div>
                  <span className="text-slate-300">›</span>
                </div>
              </div>
            ))}
          </Card>
      }
    </div>
  );
}

// ── PI Section ────────────────────────────────────────────────────────────────
const PI_SYM = cur => cur==='USD'?'$':cur==='AED'?'AED\u00A0':'\u20B9';
const PI_AMT = (n,cur) => PI_SYM(cur)+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});

function PISection({ pis, onSelect, sectionRef }) {
  return (
    <div className="mb-8" ref={sectionRef}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-1 h-6 rounded-full" style={{ background:'#8b5cf6' }}/>
        <div>
          <h3 className="font-bold text-sm" style={{ color: NAVY }}>Proforma Invoices — pending your approval</h3>
          <p className="text-xs text-brand-muted">Review and approve or reject these PIs</p>
        </div>
        <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full text-white"
          style={{ background:'#8b5cf6' }}>{pis.length}</span>
      </div>
      {pis.length === 0
        ? <div className="py-8 text-center text-sm text-slate-300 bg-slate-50 rounded-2xl">No PIs pending approval ✓</div>
        : <Card className="overflow-hidden">
            {pis.map((pi, i) => (
              <div key={pi.id} onClick={() => onSelect(pi)}
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                style={{ borderBottom: i < pis.length-1 ? '1px solid #f1f5f9' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm" style={{ color: NAVY }}>{pi.pi_number}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background:'#fef3c7', color:'#92400e' }}>Pending Approval</span>
                    <span className="text-xs px-2 py-0.5 rounded font-semibold"
                      style={{ background:'#f1f5f9', color:'#475569' }}>
                      {pi.entity==='yavi'?'Yavi':'Fynd'}
                    </span>
                  </div>
                  <div className="text-xs text-brand-muted mt-0.5">
                    {pi.customer_name}
                    {pi.of_number && <span className="ml-1 font-mono text-slate-400">· {pi.of_number}</span>}
                    {' · '}<strong>{PI_AMT(pi.grand_total, pi.currency)}</strong>
                  </div>
                  {pi.revops_approvers_names?.length > 0 && (
                    <div className="text-xs mt-1 text-brand-faint">
                      Assigned to: <strong>{pi.revops_approvers_names[0]}</strong>
                      {pi.revops_approvers_names.length > 1 && (
                        <span className="ml-1 text-slate-300">+{pi.revops_approvers_names.length-1} CC</span>
                      )}
                    </div>
                  )}
                  <div className="text-xs mt-0.5 text-brand-faint">
                    Raised by {pi.created_by_name}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-brand-faint">🧾 Proforma Invoice</div>
                  </div>
                  <span className="text-slate-300">›</span>
                </div>
              </div>
            ))}
          </Card>
      }
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PendingRequests() {
  const { user }  = useAuth();
  const { forms } = useForms();
  const navigate  = useNavigate();
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section');

  const revopsRef   = useRef(null);
  const financeRef  = useRef(null);
  const draftsRef   = useRef(null);
  const renewalsRef = useRef(null);
  const piRef       = useRef(null);

  const [pendingPIs, setPendingPIs] = useState([]);

  // Load pending PIs for RevOps / Universal
  useEffect(() => {
    if (!db) return;
    if (user?.role !== 'revops' && !user?.isUniversal) return;
    getDocs(query(collection(db,'proforma_invoices'), where('status','==','submitted')))
      .then(snap => {
        const all = [];
        snap.forEach(d => all.push({ id:d.id, ...d.data() }));
        // RevOps sees only PIs assigned to them; Universal sees all
        setPendingPIs(user?.isUniversal
          ? all
          : all.filter(pi => (pi.revops_approvers||[]).includes(user.email))
        );
      })
      .catch(e => console.warn('PI load error:', e));
  }, [user]);

  useEffect(() => {
    const refMap = {
      revops:   revopsRef,
      finance:  financeRef,
      drafts:   draftsRef,
      renewals: renewalsRef,
      pi:       piRef,
    };
    const ref = refMap[section];
    if (ref?.current) {
      setTimeout(() => ref.current.scrollIntoView({ behavior:'smooth', block:'start' }), 150);
    }
  }, [section]);

  const [q, setQ] = useState('');
  const onSelect = f => navigate(`/form/${f.id}`);
  const onSelectPI = pi => navigate('/proforma-invoices');

  const search = forms => !q ? forms : forms.filter(f =>
    [f.customer_name, f.of_number, f.brand_name, f.sales_rep_name]
      .some(v => v?.toLowerCase().includes(q.toLowerCase()))
  );

  const searchPIs = pis => !q ? pis : pis.filter(pi =>
    [pi.customer_name, pi.pi_number, pi.of_number, pi.created_by_name]
      .some(v => v?.toLowerCase().includes(q.toLowerCase()))
  );

  const isSales   = user?.role === 'sales'  && !user?.isUniversal;
  const isRevops  = user?.role === 'revops' && !user?.isUniversal;
  const isFinance = user?.role === 'finance'&& !user?.isUniversal;

  const salesDrafts    = forms.filter(f => f.status==='draft' && (!isSales || f.sales_rep_email===user.email));
  const salesRejected  = forms.filter(f => f.status==='revops_rejected' && (!isSales || f.sales_rep_email===user.email));
  const salesRenewal   = forms.filter(f => f.is_renewal && f.status==='draft' && (!isSales || f.sales_rep_email===user.email));

  const revopsPending  = forms.filter(f => f.status==='submitted');
  const revopsRejected = forms.filter(f => f.status==='submitted' && f.finance_comment);

  const financePending = forms.filter(f => f.status==='revops_approved');

  const allPending = forms.filter(f => ['draft','submitted','revops_approved','revops_rejected'].includes(f.status));

  const totalCount = user?.isUniversal
    ? allPending.length + pendingPIs.length
    : isSales   ? salesDrafts.length + salesRejected.length
    : isRevops  ? revopsPending.length + pendingPIs.length
    : isFinance ? financePending.length
    : 0;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold" style={{ color:NAVY }}>Pending Requests</h2>
        <p className="text-sm text-brand-muted mt-0.5">
          {totalCount} item{totalCount!==1?'s':''} requiring your attention
        </p>
      </div>
      <input value={q} onChange={e=>setQ(e.target.value)}
        placeholder="🔍 Search customer, OF#, PI#, rep…"
        className="w-full text-sm border rounded-xl px-4 py-2.5 focus:outline-none border-slate-200 mb-6"/>

      {/* ── SALES ── */}
      {(isSales || user?.isUniversal) && (
        <>
          {salesRenewal.length > 0 && (
            <Section
              title="Renewal drafts to review"
              subtitle="Auto-created when contracts expired — review, update dates/fees, then submit"
              color="#7c3aed"
              forms={search(salesRenewal)}
              onSelect={onSelect}
              emptyMsg="No renewal drafts"
              sectionRef={renewalsRef}
            />
          )}
          <Section
            title="Rejected by RevOps — needs resubmission"
            subtitle="These were reviewed and sent back. Fix the issues then resubmit."
            color="#ef4444"
            forms={search(salesRejected)}
            onSelect={onSelect}
            emptyMsg="No rejected forms ✓"
          />
          <Section
            title="Drafts in progress"
            subtitle="Saved drafts not yet submitted for review"
            color="#94a3b8"
            forms={search(salesDrafts.filter(f => !f.is_renewal))}
            onSelect={onSelect}
            emptyMsg="No drafts in progress"
            sectionRef={draftsRef}
          />
        </>
      )}

      {/* ── REVOPS — OFs ── */}
      {(isRevops || user?.isUniversal) && (
        <>
          <Section
            title="Submitted by Sales — pending your review"
            subtitle="Review these Order Forms and approve to Finance or reject back to Sales"
            color="#f59e0b"
            forms={search(revopsPending)}
            onSelect={onSelect}
            emptyMsg="No forms pending review ✓"
            sectionRef={revopsRef}
          />
          {revopsRejected.length > 0 && (
            <Section
              title="Sent back by Finance — needs RevOps attention"
              subtitle="Finance has returned these with comments — review and resubmit"
              color="#ef4444"
              forms={search(revopsRejected)}
              onSelect={onSelect}
              emptyMsg="None"
            />
          )}
        </>
      )}

      {/* ── REVOPS — PIs ── */}
      {(isRevops || user?.isUniversal) && (
        <PISection
          pis={searchPIs(pendingPIs)}
          onSelect={onSelectPI}
          sectionRef={piRef}
        />
      )}

      {/* ── FINANCE ── */}
      {(isFinance || user?.isUniversal) && (
        <Section
          title="Approved by RevOps — pending Finance approval"
          subtitle="Assign OF number and give final approval"
          color="#3b82f6"
          forms={search(financePending)}
          onSelect={onSelect}
          emptyMsg="No forms pending approval ✓"
          sectionRef={financeRef}
        />
      )}
    </div>
  );
}
