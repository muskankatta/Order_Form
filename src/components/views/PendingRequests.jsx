import { useNavigate } from 'react-router-dom';
import { Card, StatusPill } from '../ui/index.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtShort } from '../../utils/dates.js';

const NAVY = '#1B2B4B';

function Section({ title, subtitle, color, forms, onSelect, emptyMsg }) {
  return (
    <div className="mb-8">
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
                  {/* Show rejection comment if any */}
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

export default function PendingRequests() {
  const { user }  = useAuth();
  const { forms } = useForms();
  const navigate  = useNavigate();

  const onSelect = f => navigate(`/form/${f.id}`);

  const isSales   = user?.role === 'sales'  && !user?.isUniversal;
  const isRevops  = user?.role === 'revops' && !user?.isUniversal;
  const isFinance = user?.role === 'finance'&& !user?.isUniversal;

  // ── SALES view ─────────────────────────────────────────────────────────────
  const salesDrafts    = forms.filter(f => f.status==='draft' && (!isSales || f.sales_rep_email===user.email));
  const salesRejected  = forms.filter(f => f.status==='revops_rejected' && (!isSales || f.sales_rep_email===user.email));
  const salesRenewal   = forms.filter(f => f.is_renewal && f.status==='draft' && (!isSales || f.sales_rep_email===user.email));

  // ── REVOPS view ─────────────────────────────────────────────────────────────
  const revopsPending  = forms.filter(f => f.status==='submitted');
  const revopsRejected = forms.filter(f => f.status==='submitted' && f.finance_comment); // sent back by finance

  // ── FINANCE view ─────────────────────────────────────────────────────────────
  const financePending = forms.filter(f => f.status==='revops_approved');

  // ── UNIVERSAL view — shows everything ──────────────────────────────────────
  const allPending = forms.filter(f => ['draft','submitted','revops_approved','revops_rejected'].includes(f.status));

  const totalCount = user?.isUniversal ? allPending.length
    : isSales   ? salesDrafts.length + salesRejected.length
    : isRevops  ? revopsPending.length
    : isFinance ? financePending.length
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={{ color:NAVY }}>Pending Requests</h2>
        <p className="text-sm text-brand-muted mt-0.5">
          {totalCount} item{totalCount!==1?'s':''} requiring your attention
        </p>
      </div>

      {/* ── SALES ── */}
      {(isSales || user?.isUniversal) && (
        <>
          {salesRenewal.length > 0 && (
            <Section
              title="Renewal drafts to review"
              subtitle="Auto-created when contracts expired — review, update dates/fees, then submit"
              color="#7c3aed"
              forms={salesRenewal}
              onSelect={onSelect}
              emptyMsg="No renewal drafts"
            />
          )}
          <Section
            title="Rejected by RevOps — needs resubmission"
            subtitle="These were reviewed and sent back. Fix the issues then resubmit."
            color="#ef4444"
            forms={salesRejected}
            onSelect={onSelect}
            emptyMsg="No rejected forms ✓"
          />
          <Section
            title="Drafts in progress"
            subtitle="Saved drafts not yet submitted for review"
            color="#94a3b8"
            forms={salesDrafts.filter(f => !f.is_renewal)}
            onSelect={onSelect}
            emptyMsg="No drafts in progress"
          />
        </>
      )}

      {/* ── REVOPS ── */}
      {(isRevops || user?.isUniversal) && (
        <>
          <Section
            title="Submitted by Sales — pending your review"
            subtitle="Review these Order Forms and approve to Finance or reject back to Sales"
            color="#f59e0b"
            forms={revopsPending}
            onSelect={onSelect}
            emptyMsg="No forms pending review ✓"
          />
          {revopsRejected.length > 0 && (
            <Section
              title="Sent back by Finance — needs RevOps attention"
              subtitle="Finance has returned these with comments — review and resubmit"
              color="#ef4444"
              forms={revopsRejected}
              onSelect={onSelect}
              emptyMsg="None"
            />
          )}
        </>
      )}

      {/* ── FINANCE ── */}
      {(isFinance || user?.isUniversal) && (
        <Section
          title="Approved by RevOps — pending Finance approval"
          subtitle="Assign OF number and give final approval"
          color="#3b82f6"
          forms={financePending}
          onSelect={onSelect}
          emptyMsg="No forms pending approval ✓"
        />
      )}
    </div>
  );
}
