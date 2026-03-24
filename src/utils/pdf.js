import { fmtDate } from './dates.js';
import { getSym } from './formatting.js';

export const openPDF = form => {
  const sym  = getSym(form.committed_currency || 'INR');
  const svcs = form.services_fees || [];
  const isBundle = svcs.length > 1;

  const feeRow = fee => {
    let cv = '';
    if (fee.isLogistics)
      cv = `<a href="${fee.logisticsRateCard || '#'}" style="color:#00897b">As per rate card</a>`;
    else if (fee.pricingModel === 'graduated')
      cv = (fee.slabs || []).map(s =>
        `${s.from||0}–${s.to||'∞'}: ${s.rate||0}${s.rateType !== '₹ per unit' ? '%' : sym} per unit`
      ).join('<br/>');
    else if (fee.stepUpPricing && fee.stepUpValues?.length)
      cv = (fee.stepUpValues).map(sv =>
        `${sv.label}: ${sym}${parseFloat(sv.value||0).toLocaleString('en-IN')}`
      ).join('<br/>');
    else
      cv = fee.commercialValue
        ? `${sym}${parseFloat(fee.commercialValue||0).toLocaleString('en-IN')}`
        : '—';

    return `<tr>
      <td>${fee.feeType||'—'}</td>
      <td>${fee.billingCycle||'—'}</td>
      <td>${cv}</td>
      <td>${fee.inclusions||''}</td>
      <td>${[fee.unitMetric, fee.paymentTrigger].filter(Boolean).join(' · ') || '—'}</td>
    </tr>`;
  };

  const svcHtml = svcs.map((svc, i) => `
    <div style="margin-bottom:18px">
      <div style="background:#f0f4f8;padding:6px 14px;font-weight:700;font-size:10.5px;border:1px solid #ddd;border-bottom:none">
        ${String.fromCharCode(97+i)}. ${svc.name||'—'}
      </div>
      <table>
        <thead><tr><th>Fee Type</th><th>Billing Cycle</th><th>Commercial Value</th><th>Inclusions</th><th>Charged On</th></tr></thead>
        <tbody>${(svc.fees||[]).map(feeRow).join('')}</tbody>
      </table>
    </div>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>OF ${form.of_number || 'DRAFT'}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:36px 44px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2.5px solid #1B2B4B}
h1{font-size:14px;font-weight:900;text-align:center;margin-bottom:16px;letter-spacing:2px;text-transform:uppercase}
h2{font-size:10.5px;font-weight:700;background:#1B2B4B;color:#fff;padding:6px 14px;margin:16px 0 0}
table{width:100%;border-collapse:collapse;font-size:10.5px}
th{background:#f0f4f8;font-weight:700;text-align:left;padding:6px 10px;border:1px solid #ccc}
td{padding:5px 10px;border:1px solid #e0e0e0;vertical-align:top}
.kv td:first-child{background:#f8f9fa;font-weight:600;width:33%}
.st-block{padding:10px 14px;border:1px solid #ddd;font-size:10.5px;line-height:1.7;white-space:pre-wrap}
.sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}
.sign-box{border:1px solid #ccc;border-radius:4px;padding:14px}
.sign-box h4{font-size:10px;font-weight:700;color:#1B2B4B;text-transform:uppercase;margin-bottom:10px}
.sign-line{border-bottom:1px solid #999;margin:24px 0 8px}
.footer{margin-top:20px;font-size:9px;color:#aaa;text-align:center;border-top:1px solid #eee;padding-top:8px}
@media print{button{display:none}h2,.sign-box h4{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hdr">
  <div style="display:flex;align-items:center;gap:14px">
    <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
      <path d="M50 8C28 8 12 26 12 48C12 70 33 87 50 96C67 87 88 70 88 48C88 26 72 8 50 8Z" stroke="#1B2B4B" stroke-width="5.5" fill="none"/>
      <path d="M37 48L50 33L63 48L54.5 57L54.5 72L45.5 72L45.5 57Z" fill="#1B2B4B"/>
    </svg>
    <div>
      <div style="font-size:26px;font-weight:900;color:#1B2B4B">Fynd</div>
      <div style="font-weight:700;font-size:10.5px">Shopsense Retail Technologies Limited</div>
      <div style="font-size:9.5px;color:#444;line-height:1.65">
        1st Floor, Wework Vijay Diamond, Andheri East, Mumbai – 400 093<br/>
        CIN: U52100MH2012PLC236314 | GSTN: 27AALCA0442L1ZM | PAN: AALCA0442L
      </div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:9.5px;font-weight:700;color:#64748b;letter-spacing:1.5px;text-transform:uppercase">Order Form</div>
    <div style="font-size:20px;font-weight:900;font-family:monospace;color:#1B2B4B">${form.of_number || '[ PENDING ]'}</div>
    <div style="font-size:9.5px;color:#666">Date: ${fmtDate(form.submitted_at?.split('T')[0])}</div>
  </div>
</div>
<h1>ORDER FORM</h1>
<h2>A. Client &amp; Order Form Details</h2>
<table class="kv" style="margin-bottom:1px">
<tr><td>Client Name</td><td><strong>${form.customer_name||'—'}</strong></td><td>OF Number</td><td><strong>${form.of_number||'PENDING'}</strong></td></tr>
<tr><td>Brand / Trade Name</td><td>${form.brand_name||'—'}</td><td>Currency</td><td>${form.committed_currency||'INR'}</td></tr>
<tr><td>Billing Address</td><td>${(form.billing_address||'—').replace(/\n/g,'<br/>')}</td><td>OF Value</td><td><strong>${sym}${parseFloat(form.of_value||0).toLocaleString('en-IN')}</strong></td></tr>
<tr><td>Tax Details</td><td>GST: ${form.gstin||'—'} · PAN: ${form.pan||'—'}</td><td>Sales Channel</td><td>${form.lead_type||'—'}</td></tr>
<tr><td>Billing Email</td><td>${form.billing_email||'—'}</td><td>Start Date</td><td>${fmtDate(form.start_date)}</td></tr>
<tr><td>OF Term</td><td>${form.of_term||'—'}</td><td>End Date</td><td>${fmtDate(form.end_date)}</td></tr>
<tr><td>PO Required</td><td>${form.po_required||'No'}</td><td>Auto Renewal</td><td>${form.auto_renewal||'No'} (${form.renewal_term||'NA'})</td></tr>
<tr><td>Payment Terms</td><td colspan="3">${form.payment_terms||'—'}</td></tr>
<tr><td>Client Rep</td><td>${form.client_rep_name||'—'} · ${form.client_rep_mobile||'—'} · ${form.client_rep_email||'—'}</td><td>Sales Rep</td><td>${form.sales_rep_name||'—'} · ${form.sales_rep_email||'—'}</td></tr>
</table>
<h2>B. Service Details${isBundle ? ' — Bundle: Yes' : ''}</h2>
${svcHtml}
${form.special_terms ? `<h2>C. Special Terms</h2><div class="st-block">${form.special_terms}</div>` : ''}
<div style="font-size:11px;font-weight:700;margin-top:18px;margin-bottom:6px">Terms &amp; Conditions:</div>
<div style="font-size:10px;line-height:1.8;color:#333">
<strong>1. Entire Agreement</strong> — This Order Form, along with its accompanying schedules, annexures, SOPs, TOS, and Privacy Policy collectively constitute the entire agreement.
<a href="https://console.fynd.com/terms-and-conditions" style="color:#00897b">T&amp;C</a> ·
<a href="https://console.fynd.com/privacy-policy" style="color:#00897b">Privacy Policy</a><br/>
<strong>2. Term</strong> — The Order Form Term includes the initial Service Period and all Renewal Terms (if applicable). Renewal is subject to the then-current list price.<br/>
<strong>3. Extension Fees</strong> — Extension Service(s) shall incur an Extension Fee above the Fees in this OF.
<a href="https://drive.google.com/file/d/1vIHalH7yX1kUFtCxI8xMlSrIRO0wI7SX/view?usp=sharing" style="color:#00897b">Extension Rate Card</a><br/>
<strong>4. Fees and Payment Terms</strong> — All fees exclusive of applicable taxes. Recurring fees subject to minimum 8% increment at renewal. Termination before expiry: remaining fees remain payable.<br/>
<strong>5. Publicity Rights</strong> — Client grants Fynd the right to use its name, logo, and trademarks for marketing and PR purposes.<br/>
<strong>6. Validity</strong> — This OF is valid for 7 working days from issuance.
</div>
<div style="margin-top:18px;font-size:11px;font-weight:700;margin-bottom:6px">Authorization:</div>
<div class="sign-grid">
  <div class="sign-box">
    <h4>For: ${form.customer_name||'Client'}</h4>
    <div class="sign-line"></div>
    <div><strong>${form.signatory_name||'________________________'}</strong></div>
    <div style="color:#555;margin-top:3px">${form.signatory_designation||'Authorised Signatory'}</div>
    <div style="color:#aaa;font-size:9.5px;margin-top:2px">${form.signatory_email||''}</div>
    <div style="margin-top:10px;color:#999;font-size:9.5px">Date: _______________</div>
  </div>
  <div class="sign-box">
    <h4>For: Shopsense Retail Technologies Limited</h4>
    <div class="sign-line"></div>
    <div><strong>Sreeraman Mohan Girija</strong></div>
    <div style="color:#555;margin-top:3px">Whole-time Director</div>
    <div style="color:#aaa;font-size:9.5px;margin-top:2px">legal@gofynd.com</div>
    <div style="margin-top:10px;color:#999;font-size:9.5px">Date: _______________</div>
  </div>
</div>
<div class="footer">OF#: ${form.of_number||'PENDING'} · Generated: ${new Date().toLocaleString('en-IN')} · Shopsense Retail Technologies Limited</div>
<div style="text-align:center;margin-top:16px">
  <button onclick="window.print()" style="background:#1B2B4B;color:#fff;border:none;padding:10px 28px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">🖨 Print / Save as PDF</button>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
};
