import { fmtDate } from './dates.js';
import { getSym } from './formatting.js';

// ── Load html-docx-js from CDN on demand ─────────────────────────────────────
function loadHtmlDocx() {
  return new Promise(function(resolve, reject) {
    if (window.htmlDocx) { resolve(window.htmlDocx); return; }
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html-docx-js@0.3.1/dist/html-docx.js';
    s.onload  = function() { resolve(window.htmlDocx); };
    s.onerror = function() { reject(new Error('Failed to load html-docx-js')); };
    document.head.appendChild(s);
  });
}

// ── Yavi header (base64 PNG embedded) ────────────────────────────────────────
// Keep in sync with pdf.js YAVI_HEADER_IMG constant
import { YAVI_HEADER_IMG } from './yaviHeader.js';

// ── Fee row HTML ──────────────────────────────────────────────────────────────
function feeRowHtml(fee, sym) {
  var cv = '';
  if (fee.isLogistics) {
    cv = 'As per rate card';
  } else if (fee.pricingModel === 'graduated') {
    cv = (fee.slabs || []).map(function(s) {
      return (s.from||0) + '\u2013' + (s.to||'\u221e') + ': ' +
        (s.rateType && s.rateType.startsWith('%') ? s.rate + s.rateType : sym + s.rate);
    }).join('; ');
  } else if (fee.stepUpPricing && fee.stepUpValues && fee.stepUpValues.length) {
    cv = fee.stepUpValues.map(function(sv) {
      return sv.label + ': ' + sym + parseFloat(sv.value||0).toLocaleString('en-IN');
    }).join('; ');
  } else {
    cv = fee.commercialValue
      ? sym + parseFloat(fee.commercialValue||0).toLocaleString('en-IN')
      : '\u2014';
  }
  return '<tr>' +
    '<td>' + (fee.feeType||'\u2014') + '</td>' +
    '<td>' + (fee.billingCycle||'\u2014') + '</td>' +
    '<td>' + cv + '</td>' +
    '<td>' + (fee.inclusions||'') + '</td>' +
    '<td>' + ([fee.unitMetric, fee.paymentTrigger].filter(Boolean).join(' \u00b7 ') || '\u2014') + '</td>' +
    '</tr>';
}

// ── Build the full HTML document string ──────────────────────────────────────
function buildDocHtml(form) {
  var isYavi   = form.entity === 'yavi';
  var sym      = getSym(form.committed_currency || (isYavi ? 'USD' : 'INR'));
  var svcs     = form.services_fees || [];
  var isBundle = svcs.length > 1;
  var ofNum    = form.of_number || 'DRAFT';
  var custName = form.customer_name || '\u2014';
  var sigName  = form.signatory_name || '________________________';
  var sigDesig = form.signatory_designation || 'Authorised Signatory';
  var sigEmail = form.signatory_email || '';

  var entitySignatoryName  = isYavi ? 'Vishesh Kumar'                : 'Sreeraman Mohan Girija';
  var entitySignatoryDesig = isYavi ? 'Founding Director'            : 'Whole-time Director';
  var entitySignatoryLabel = isYavi ? 'For: Yavi Technologies FZCO'  : 'For: Shopsense Retail Technologies Limited';
  var entitySalesRepLabel  = isYavi ? 'Sales Rep (Yavi Technologies)': 'Sales Rep (Fynd)';
  var footerEntity         = isYavi ? 'Yavi Technologies FZCO'       : 'Shopsense Retail Technologies Limited';

  // ── Letterhead ──────────────────────────────────────────────────────────
  var hdrHtml;
  if (isYavi) {
    hdrHtml =
      '<div style="border-bottom:2.5pt solid #1B2B4B;margin-bottom:16pt;padding-bottom:10pt">' +
      '<img src="' + YAVI_HEADER_IMG + '" style="width:100%;max-width:600pt" alt="Yavi Technologies FZCO"/>' +
      '</div>';
  } else {
    hdrHtml =
      '<table style="width:100%;border:none;margin-bottom:16pt;border-bottom:2.5pt solid #1B2B4B;padding-bottom:10pt"><tr>' +
      '<td style="border:none;vertical-align:top;width:55%">' +
      '<p style="font-weight:bold;font-size:11pt;color:#1B2B4B;margin:0">Shopsense Retail Technologies Limited</p>' +
      '<p style="font-size:8.5pt;color:#444;margin:2pt 0 0">1st Floor, Wework Vijay Diamond, Andheri East, Mumbai \u2013 400 093</p>' +
      '<p style="font-size:8.5pt;color:#444;margin:1pt 0 0">CIN: U52100MH2012PLC236314 | GSTN: 27AALCA0442L1ZM | PAN: AALCA0442L</p>' +
      '</td>' +
      '<td style="border:none;vertical-align:top;text-align:right;width:45%">' +
      '<p style="font-size:8pt;font-weight:bold;color:#64748b;letter-spacing:1pt;text-transform:uppercase;margin:0">Order Form</p>' +
      '<p style="font-size:18pt;font-weight:900;color:#1B2B4B;margin:2pt 0;font-family:Courier New">' + ofNum + '</p>' +
      '<p style="font-size:8.5pt;color:#666;margin:0">Date: ' + fmtDate(form.submitted_at ? form.submitted_at.split('T')[0] : '') + '</p>' +
      '</td>' +
      '</tr></table>';
  }

  // ── Tax row ─────────────────────────────────────────────────────────────
  var taxRowHtml = isYavi
    ? '<tr><td>Tax Details</td><td colspan="3">' + (form.tax_number||'\u2014') + '</td></tr>'
    : '<tr><td>Tax Details</td><td>GST: ' + (form.gstin||'\u2014') + ' &middot; PAN: ' + (form.pan||'\u2014') + '</td><td>Sales Channel</td><td>' + (form.lead_type||'\u2014') + '</td></tr>';

  // ── Service tables ───────────────────────────────────────────────────────
  var svcHtml = svcs.map(function(svc, i) {
    return '<p style="background:#1B2B4B;color:white;padding:4pt 10pt;font-weight:bold;font-size:9.5pt;margin:10pt 0 0">' +
      String.fromCharCode(97+i) + '. ' + (svc.name||'\u2014') + '</p>' +
      '<table style="width:100%;border-collapse:collapse;font-size:9.5pt">' +
      '<thead><tr style="background:#f0f4f8">' +
      '<th style="border:1pt solid #ccc;padding:4pt 8pt;text-align:left">Fee Type</th>' +
      '<th style="border:1pt solid #ccc;padding:4pt 8pt;text-align:left">Billing Cycle</th>' +
      '<th style="border:1pt solid #ccc;padding:4pt 8pt;text-align:left">Commercial Value</th>' +
      '<th style="border:1pt solid #ccc;padding:4pt 8pt;text-align:left">Inclusions</th>' +
      '<th style="border:1pt solid #ccc;padding:4pt 8pt;text-align:left">Charged On</th>' +
      '</tr></thead><tbody>' +
      (svc.fees||[]).map(function(f) { return feeRowHtml(f, sym); }).join('') +
      '</tbody></table>';
  }).join('');

  // ── T&C ─────────────────────────────────────────────────────────────────
  var tcHtml;
  if (isYavi) {
    tcHtml =
      '<p style="font-size:9.5pt;margin:6pt 0 3pt"><strong>1. Ownership &amp; Licensing</strong> &mdash; ' +
      'Shopsense Retail Technologies Limited (&ldquo;Fynd&rdquo;) is the owner and licensor of the Software/Platform availed as Service(s) by the Client under this Order Form. ' +
      'Fynd has granted Yavi Technologies with licence to resell the Service(s) in the capacity of an exclusive authorized reseller by way of an independent licence agreement.</p>' +
      '<p style="font-size:9.5pt;margin:6pt 0 3pt"><strong>2. Agreement Scope</strong> &mdash; ' +
      'This Order Form shall be read together with schedules, annexures, SOP(s), SoW(s), and/or any written documents executed between the Parties, read along with the online terms and policy documents of Fynd with respect to the Service(s) being availed by the Client and shall constitute the entire understanding and agreement between the parties and replaces all prior understandings, negotiations, discussions, writings and agreements with respect to the subject matter hereof.</p>' +
      '<p style="font-size:9.5pt;margin:6pt 0 3pt"><strong>3. Term</strong> &mdash; ' +
      'The Service Period and all applicable Renewal Tenures are collectively referred to herein as the &ldquo;Order Form Term&rdquo;. This Order Form is effective on the date the Service Period commences until the end of the Order Form Term. Renewal will be applicable on then-current list price.</p>' +
      '<p style="font-size:9.5pt;margin:6pt 0 3pt"><strong>4. Fees</strong> &mdash; ' +
      'Client will be charged the fees set forth in this Order Form upon its execution and in accordance with the applicable Billing Frequency (as defined above) thereafter. All fees (commercial value) that Client is charged, including the fees set forth in this Order Form, will be exclusive of taxes. If Client terminates this Order Form prior to the expiration of the Initial Term or then-current Renewal Term (except to the extent such termination is due to Fynd&rsquo;s failure to cure a material breach in accordance with the Agreement (as defined in TOS)), then Client is responsible for paying the fees set forth in this Order Form for the remaining portion of the Initial Term or then-current Renewal Term upon termination. All fees except one time fee will be applicable for a minimal increment of 8% on then-current list price (shared by Fynd to Client) upon Renewal Term.</p>' +
      '<p style="font-size:9.5pt;margin:6pt 0 3pt"><strong>5. Validity</strong> &mdash; ' +
      'This Order Form shall remain valid for a period of seven (7) working days from the date of issuance. If not signed and returned within this period, the Order Form shall be deemed null and void unless extended in writing by Fynd.</p>';
  } else {
    tcHtml =
      '<p style="font-size:9.5pt;margin:6pt 0 3pt"><strong>1. Entire Agreement</strong> &mdash; ' +
      'This Order Form, along with its accompanying schedules, annexures, Standard Operating Procedures (SOPs), Terms of Service (TOS), and Privacy Policy, if any, collectively constitute the entire agreement between the Parties (hereinafter &ldquo;Agreement&rdquo;). It supersedes and replaces all prior negotiations, discussions, understandings, writings, and agreements related to the subject matter herein.</p>' +
      '<p style="font-size:9.5pt;margin:6pt 0 3pt"><strong>2. Term</strong> &mdash; ' +
      'The term of this Order Form (hereinafter referred to as the &ldquo;Order Form Term&rdquo;) includes the initial Service Period and all subsequent Renewal Terms (if applicable). The Order Form becomes effective on the commencement date of the Service Period and shall continue until the end of the Order Form Term. Renewal shall be subject to the then-current list price prevailing at the time of renewal.</p>' +
      '<p style="font-size:9.5pt;margin:6pt 0 3pt"><strong>3. Extension Fees</strong> &mdash; ' +
      'If the Client avails any of the Extension Service(s), they shall be charged an Extension Fee for that Service(s) over and above the Fees mentioned above in the Order Form. See Extension Rate Card for details.</p>' +
      '<p style="font-size:9.5pt;margin:6pt 0 3pt"><strong>4. Fees and Payment Terms</strong> &mdash; ' +
      'a. The Client agrees to pay the fees outlined in this Order Form upon its execution and subsequently according to the Billing Frequency specified herein. ' +
      'b. All fees are exclusive of applicable taxes, which will be charged separately as per prevailing laws. ' +
      'c. Except for one-time fees, all recurring fees will be subject to a minimum increment of 8% on the then-current list price, as notified by Fynd at the time of renewal. ' +
      'd. In the event that the Client terminates this Order Form before the expiration of the Initial Term or any then-current Renewal Term &mdash; except where such termination is due to Fynd&rsquo;s uncured material breach as defined in the Terms of Service &mdash; the Client shall remain liable to pay the remaining fees due for the rest of the respective term, upon termination.</p>' +
      '<p style="font-size:9.5pt;margin:6pt 0 3pt"><strong>5. Publicity Rights</strong> &mdash; ' +
      'By signing this Order Form, the Client grants Fynd the right, for the Term of this Order Form and thereafter, to use the Client&rsquo;s name, logo, trademark(s), and other brand identifiers for the purposes of publicity, public relations (PR), marketing, promotional, or branding activities, or otherwise disclosing its association with the Client, in any medium or format.</p>' +
      '<p style="font-size:9.5pt;margin:6pt 0 3pt"><strong>6. Validity</strong> &mdash; ' +
      'This Order Form shall remain valid for a period of seven (7) working days from the date of issuance. If not signed and returned within this period, the Order Form shall be deemed null and void unless extended in writing by Fynd.</p>';
  }

  // ── Assemble full HTML ───────────────────────────────────────────────────
  return '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
    '<style>' +
    'body{font-family:Arial,sans-serif;font-size:10pt;color:#1a1a1a;margin:2cm}' +
    'table{width:100%;border-collapse:collapse;font-size:9.5pt}' +
    'th{background:#f0f4f8;font-weight:bold;padding:5pt 8pt;border:1pt solid #ccc;text-align:left}' +
    'td{padding:4pt 8pt;border:1pt solid #ddd;vertical-align:top}' +
    '.kv td:first-child{background:#f8f9fa;font-weight:bold;width:32%}' +
    'h1{font-size:13pt;font-weight:900;text-align:center;letter-spacing:2pt;text-transform:uppercase;margin:14pt 0}' +
    'h2{font-size:10pt;font-weight:bold;background:#1B2B4B;color:white;padding:5pt 12pt;margin:12pt 0 0}' +
    '.sign-table td{border:1pt solid #ccc;padding:14pt;vertical-align:top;width:50%}' +
    '.sign-line{border-bottom:1pt solid #999;margin:20pt 0 6pt;height:1pt}' +
    '</style></head><body>' +
    hdrHtml +
    '<h1>ORDER FORM</h1>' +
    '<h2>A. Client &amp; Order Form Details</h2>' +
    '<table class="kv" style="margin-bottom:1pt">' +
    '<tr><td>Client Name</td><td><strong>' + custName + '</strong></td><td>OF Number</td><td><strong>' + ofNum + '</strong></td></tr>' +
    '<tr><td>Brand / Trade Name</td><td>' + (form.brand_name||'\u2014') + '</td><td>Billing Currency</td><td>' + (form.committed_currency||'\u2014') + '</td></tr>' +
    '<tr><td>Billing Address</td><td>' + (form.billing_address||'\u2014').replace(/\n/g,'<br/>') + '</td><td>OF Value</td><td><strong>' + sym + parseFloat(form.of_value||0).toLocaleString('en-IN') + '</strong></td></tr>' +
    taxRowHtml +
    '<tr><td>Billing Email</td><td>' + (form.billing_email||'\u2014') + '</td><td>Start Date</td><td>' + fmtDate(form.start_date) + '</td></tr>' +
    '<tr><td>OF Term</td><td>' + (form.of_term || (form.of_term_months ? form.of_term_months+' Months' : '\u2014')) + '</td><td>End Date</td><td>' + fmtDate(form.end_date) + '</td></tr>' +
    '<tr><td>PO Required</td><td>' + (form.po_required||'No') + '</td><td>Auto Renewal</td><td>' + (form.auto_renewal||'No') + ' (' + (form.renewal_term||'NA') + ')</td></tr>' +
    '<tr><td>Payment Terms</td><td colspan="3">' + (form.payment_terms||'\u2014') + '</td></tr>' +
    '<tr><td>Client Rep</td><td>' + (form.client_rep_name||'\u2014') + ' &middot; ' + (form.client_rep_mobile||'\u2014') + ' &middot; ' + (form.client_rep_email||'\u2014') + '</td>' +
    '<td>' + entitySalesRepLabel + '</td><td>' + (form.sales_rep_name||'\u2014') + ' &middot; ' + (form.sales_rep_email||'\u2014') + '</td></tr>' +
    '</table>' +
    '<h2>B. Service Details' + (isBundle ? ' &mdash; Bundle: Yes' : '') + '</h2>' +
    svcHtml +
    (form.special_terms
      ? '<h2>C. Special Terms</h2><p style="padding:8pt 12pt;border:1pt solid #ddd;font-size:9.5pt;white-space:pre-wrap">' + form.special_terms + '</p>'
      : '') +
    '<p style="font-size:10pt;font-weight:bold;margin:16pt 0 6pt">Important Notes:</p>' +
    tcHtml +
    '<p style="font-size:10pt;font-weight:bold;margin:16pt 0 8pt">Authorization:</p>' +
    '<table class="sign-table"><tr>' +
    '<td>' +
    '<p style="font-size:9pt;font-weight:bold;text-transform:uppercase;color:#1B2B4B;margin:0 0 8pt">For: ' + custName + '</p>' +
    '<div class="sign-line"></div>' +
    '<p style="margin:4pt 0 0;font-weight:bold">' + sigName + '</p>' +
    '<p style="margin:2pt 0;color:#555;font-size:9pt">' + sigDesig + '</p>' +
    '<p style="margin:2pt 0;color:#888;font-size:8.5pt">' + sigEmail + '</p>' +
    '<p style="margin:12pt 0 0;color:#999;font-size:8.5pt">Date: _______________</p>' +
    '</td>' +
    '<td>' +
    '<p style="font-size:9pt;font-weight:bold;text-transform:uppercase;color:#1B2B4B;margin:0 0 8pt">' + entitySignatoryLabel + '</p>' +
    '<div class="sign-line"></div>' +
    '<p style="margin:4pt 0 0;font-weight:bold">' + entitySignatoryName + '</p>' +
    '<p style="margin:2pt 0;color:#555;font-size:9pt">' + entitySignatoryDesig + '</p>' +
    '<p style="margin:12pt 0 0;color:#999;font-size:8.5pt">Date: _______________</p>' +
    '</td>' +
    '</tr></table>' +
    '<p style="margin-top:20pt;font-size:8pt;color:#aaa;text-align:center;border-top:1pt solid #eee;padding-top:6pt">' +
    'OF#: ' + ofNum + ' &middot; Generated: ' + new Date().toLocaleString('en-IN') + ' &middot; ' + footerEntity +
    '</p>' +
    '</body></html>';
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function downloadDOCX(form) {
  var ofNum = form.of_number || 'DRAFT';
  try {
    var htmlDocx = await loadHtmlDocx();
    var htmlContent = buildDocHtml(form);
    var blob = htmlDocx.asBlob(htmlContent, {
      orientation: 'portrait',
      margins: { top: 720, right: 720, bottom: 720, left: 720 },
    });
    var url = URL.createObjectURL(blob);
    var a   = document.createElement('a');
    a.href     = url;
    a.download = 'OF_' + ofNum + '.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
  } catch (err) {
    console.error('[downloadDOCX] Failed:', err);
    throw err;
  }
}
