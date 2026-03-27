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
        // Fix: currency sym before the number, dynamic rate type label
        `${s.from||0}–${s.to||'∞'}: ${s.rateType?.startsWith('%') ? s.rate+' '+s.rateType : sym+s.rate+' '+(s.rateType||'per unit').replace(/^[₹$£€\s]+/,'').trim()}`
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
    <div>
      <svg width="140" height="48" viewBox="0 0 1480 500" xmlns="http://www.w3.org/2000/svg" style="display:block;margin-bottom:6px">
        <path fill="#1B2B4B" d="M486.63,66.3l-60.2-50.01c-26.11-21.7-63.99-21.7-90.09,0l-72.83,60.49-72.77-60.49c-26.11-21.7-63.93-21.73-90.06-.06l-60.35,50.07C17.46,85.27,4.25,113.43,4.25,143.15v124.55c0,29.66,13.19,57.79,36,76.75l159.36,132.49c37,30.75,90.68,30.75,127.65,0l159.36-132.49c22.83-18.98,36.03-47.13,36.03-76.81v-124.54c0-29.66-13.21-57.82-36.03-76.79ZM475.67,259.41c0,20.94-9.34,40.82-25.43,54.21l-141.74,117.84c-26.11,21.7-63.99,21.7-90.12,0l-141.74-117.84c-16.09-13.39-25.4-33.27-25.4-54.21v-108c0-20.97,9.34-40.85,25.49-54.24l42.7-35.41c15.24-12.66,37.32-12.63,52.53.03l54.79,45.55-79.96,66.39c-19.76,16.44-19.79,46.78-.03,63.22l90.24,75.2c15.24,12.69,37.35,12.72,52.59.03l90.5-75.23c19.76-16.44,19.76-46.78,0-63.22l-43.94-36.52c-2.18-1.81-5.33-1.81-7.51,0l-27.57,22.9c-2.83,2.35-2.83,6.69,0,9.03l32.68,27.17c5.67,4.7,5.67,13.36,0,18.06l-62.9,52.33c-4.38,3.61-10.69,3.61-15.04-.03l-62.72-52.27c-5.64-4.7-5.64-13.36.03-18.06l50.77-42.17,12.1-10.04,44.25-36.76,35.15-29.19,19.7-16.39c15.24-12.66,37.32-12.66,52.53,0l42.61,35.38c16.09,13.39,25.43,33.24,25.43,54.21v108.03Z"/>
        <g fill="#1B2B4B">
          <path d="M707.33,52.27h113c2.89,0,5.23,2.34,5.23,5.23v34.2c0,2.89-2.34,5.23-5.23,5.23h-106.41c-22.39,0-40.55,18.15-40.55,40.55v36.15c0,2.89,2.34,5.23,5.23,5.23h117.67c2.89,0,5.23,2.34,5.23,5.23v31.72c0,2.89-2.34,5.23-5.23,5.23h-117.67c-2.89,0-5.23,2.34-5.23,5.23v120.64c0,2.89-2.34,5.23-5.23,5.23h-36.68c-2.89,0-5.23-2.34-5.23-5.23v-213.55c0-44.79,36.31-81.1,81.1-81.1Z"/>
          <path d="M1219.88,150.75c-13.51-12.13-31.99-18.2-55.42-18.2-.64,0-1.28.01-1.92.03-.62-.01-1.24-.03-1.87-.03-22.97,0-43.83,9.05-59.2,23.78-1.66,1.59-4.42.42-4.42-1.88v-10.88c0-2.89-2.34-5.23-5.23-5.23h-34.2c-2.89,0-5.23,2.34-5.23,5.23v203.35c0,2.89,2.34,5.23,5.23,5.23h36.68c2.89,0,5.23-2.34,5.23-5.23v-120.91c0-7.72,1.24-15.02,3.72-21.92,2.48-6.89,5.93-12.89,10.34-17.99,4.41-5.1,9.78-9.1,16.13-11.99,6.34-2.89,13.51-4.34,21.51-4.34,14.06,0,24.4,3.79,31.02,11.37,6.62,7.59,10.2,19.79,10.75,36.6v129.18c0,2.89,2.34,5.23,5.23,5.23h36.68c2.89,0,5.23-2.34,5.23-5.23v-141.58c0-24.26-6.76-42.46-20.26-54.59Z"/>
          <path d="M1017.79,143.51v227.99c0,44.8-36.31,81.11-81.09,81.11h-90.01c-2.89,0-5.24-2.35-5.24-5.24v-34.19c0-2.89,2.35-5.24,5.24-5.24h83.41c22.4,0,43.02-18.59,43.02-40.99v-30.86c0-2.32-2.78-3.54-4.47-1.93-15.37,14.69-36.21,23.73-59.15,23.73-.63,0-1.25-.01-1.88-.03-.63.01-1.27.03-1.9.03-23.43,0-41.91-6.06-55.43-18.19-13.51-12.15-20.27-30.33-20.27-54.6v-141.59c0-2.88,2.35-5.23,5.24-5.23h36.68c2.89,0,5.23,2.35,5.23,5.23v129.19c.56,16.81,4.14,29.02,10.76,36.59,6.62,7.59,16.96,11.37,31.02,11.37,7.99,0,15.17-1.45,21.5-4.34,6.34-2.89,11.73-6.89,16.13-11.99,4.41-5.11,7.86-11.1,10.34-17.99,2.48-6.9,3.72-14.21,3.72-21.93v-120.91c0-2.88,2.35-5.23,5.23-5.23h36.69c2.88,0,5.23,2.35,5.23,5.23Z"/>
          <path d="M1428.61,57.51v97.02c0,2.3-2.75,3.48-4.41,1.89-7.86-7.55-17.16-13.6-27.44-17.73-.34-.16-.7-.33-1.1-.49-23.44-9.76-53.14-4.57-53.14-4.57v.02c-6.73,1.03-13.4,2.79-20,5.32-11.17,4.28-21.09,10.96-29.78,20.06-8.68,9.1-15.65,20.68-20.89,34.74-5.24,14.06-7.86,30.75-7.86,50.04,0,15.99,2.07,30.95,6.2,44.87,4.14,13.93,10.34,25.99,18.61,36.19,8.27,10.2,18.67,18.27,31.22,24.19,12.54,5.93,27.22,8.89,44.04,8.89.43,0,.85-.03,1.28-.03.69.02,1.38.03,2.07.03,22.98,0,43.85-9.06,59.22-23.8,1.66-1.6,4.42-.43,4.42,1.88v10.9c0,2.89,2.34,5.23,5.23,5.23h34.2c2.89,0,5.23-2.34,5.23-5.23V57.51c0-2.89-2.34-5.23-5.23-5.23h-36.68c-2.89,0-5.23,2.34-5.23,5.23ZM1325.42,297.98c-4.83-6.89-8.41-14.75-10.75-23.57-2.35-8.82-3.52-17.78-3.52-26.88,0-9.65,1.03-19.09,3.1-28.33,2.07-9.23,5.51-17.51,10.34-24.81,4.82-7.3,11.02-13.23,18.61-17.78,7.58-4.55,16.89-6.82,27.92-6.82,18.2,0,32.6,6.62,43.22,19.85,10.61,13.23,15.92,31.71,15.92,55.42,0,9.38-1.18,18.55-3.52,27.5-2.35,8.96-5.93,17.03-10.75,24.19-4.83,7.17-11.03,12.96-18.61,17.37-7.59,4.41-16.61,6.62-27.09,6.62s-19.02-2.07-26.47-6.2c-7.44-4.14-13.58-9.65-18.4-16.54Z"/>
        </g>
      </svg>
      <div style="font-weight:700;font-size:10.5px;color:#1B2B4B">Shopsense Retail Technologies Limited</div>
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
<tr><td>OF Term</td><td>${form.of_term || (form.of_term_months ? form.of_term_months+' Months' : '—')}</td><td>End Date</td><td>${fmtDate(form.end_date)}</td></tr>
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
  <button onclick="window.print()" style="background:#1B2B4B;color:#fff;border:none;padding:10px 28px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">
  🖨 Print / Save as combined PDF ${form.attachments?.length ? `(OF + ${form.attachments.length} attachment${form.attachments.length>1?'s':''})` : ''}
</button>
</div>
</body></html>`;

  const hasAttachments = (form.attachments||[]).length > 0;

const attachmentsJson = JSON.stringify(
  (form.attachments||[]).map(a => ({ name:a.name, data:a.data }))
);

const mergedHtml = html.replace(
  '</body></html>',
  `
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
  <script>
  const ATTACHMENTS = ${attachmentsJson};

  async function generateCombined() {
    const btn = document.getElementById('printBtn');
    const status = document.getElementById('statusMsg');
    btn.disabled = true;

    try {
      const { PDFDocument } = PDFLib;
      const { jsPDF } = window.jspdf;
      const merged = await PDFDocument.create();

      // Step 1 — Render OF HTML to PDF using jsPDF + html2canvas
      status.textContent = 'Rendering Order Form…';
      const content = document.getElementById('of-content');
      const canvas = await html2canvas(content, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let y = 0;
      let remaining = imgH;
      while (remaining > 0) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, -y, imgW, imgH);
        y += pageH;
        remaining -= pageH;
      }
      const ofBytes = pdf.output('arraybuffer');
      const ofPdf = await PDFDocument.load(ofBytes);
      const ofPages = await merged.copyPages(ofPdf, ofPdf.getPageIndices());
      ofPages.forEach(p => merged.addPage(p));

      // Step 2 — Merge attachments
      for (let i = 0; i < ATTACHMENTS.length; i++) {
        const att = ATTACHMENTS[i];
        status.textContent = 'Adding attachment ' + (i+1) + ' of ' + ATTACHMENTS.length + '…';
        try {
          const base64 = att.data.split(',')[1];
          const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          const attPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const pages = await merged.copyPages(attPdf, attPdf.getPageIndices());
          pages.forEach(p => merged.addPage(p));
        } catch(e) { console.warn('Could not add', att.name, e); }
      }

      // Step 3 — Download combined PDF
      status.textContent = 'Preparing download…';
      const mergedBytes = await merged.save();
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Combined_OF.pdf';
      a.click();
      URL.revokeObjectURL(url);

      status.textContent = '✓ Combined PDF downloaded!';
      btn.textContent = '⬇ Download again';
      btn.disabled = false;
      btn.onclick = generateCombined;

    } catch(e) {
      console.error(e);
      status.textContent = 'Error: ' + e.message + ' — try Print instead.';
      btn.textContent = '🖨 Print / Save as PDF';
      btn.disabled = false;
      btn.onclick = () => window.print();
    }
  }

  window.onload = () => {
    if (ATTACHMENTS.length > 0) generateCombined();
  };
  </script>

  <div id="statusMsg" style="text-align:center;margin:8px auto;font-family:Arial,sans-serif;font-size:13px;color:#64748b"></div>
  </body></html>`
);

// Wrap content in id for html2canvas targeting
const finalHtml = mergedHtml.replace(
  '<body>',
  '<body><div id="of-content">'
).replace(
  '<div id="statusMsg"',
  '</div><div id="statusMsg"'
).replace(
  `<button onclick="window.print()"`,
  `<button id="printBtn" onclick="${hasAttachments ? 'generateCombined()' : 'window.print()'}"`
).replace(
  hasAttachments
    ? `🖨 Print / Save as combined PDF (OF + ${form.attachments.length} attachment${form.attachments.length>1?'s':''})`
    : '🖨 Print / Save as PDF',
  hasAttachments
    ? `⬇ Download Combined PDF (OF + ${form.attachments.length} attachment${form.attachments.length>1?'s':''})`
    : '🖨 Print / Save as PDF'
);

const w = window.open('', '_blank');
w.document.write(finalHtml);
w.document.close();
