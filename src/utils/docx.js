import { fmtDate } from './dates.js';
import { getSym } from './formatting.js';
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
} from 'docx';

// ── Layout constants (A4, 720 DXA margins each side) ──────────────────────────
// Content width = 11906 - 720*2 = 10466
const CW   = 10466;
const NAVY = '1B2B4B';

const border    = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const borders   = { top: border, bottom: border, left: border, right: border };
const noBorder  = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
const cellPad   = { top: 100, bottom: 100, left: 140, right: 140 };

// ── Text helpers ──────────────────────────────────────────────────────────────
const run   = (text, opts = {}) => new TextRun({ text: String(text || ''), size: 20, font: 'Arial', ...opts });
const bold  = (text, size = 20) => run(text, { bold: true, size });
const navy  = (text, size = 22) => run(text, { bold: true, color: NAVY, size, font: 'Arial' });
const grey  = (text, size = 18) => run(text, { color: '666666', size, font: 'Arial' });
const white = (text, size = 20) => run(text, { bold: true, color: 'FFFFFF', size, font: 'Arial' });

// ── Section header — navy background, white text ──────────────────────────────
function sectionHeader(text) {
  return new Paragraph({
    children: [white(text, 20)],
    shading: { fill: NAVY, type: ShadingType.CLEAR },
    spacing: { before: 200, after: 0 },
    indent: { left: 140, right: 140 },
  });
}

// ── KV table (4-col label/value grid) ────────────────────────────────────────
const KV_WIDTHS = [2100, 3133, 2100, 3133];

function kvCell(text, isLabel, colspan = 1) {
  const w = colspan > 1
    ? KV_WIDTHS.slice(1).reduce((a, b) => a + b, 0)
    : (isLabel ? KV_WIDTHS[0] : KV_WIDTHS[1]);
  return new TableCell({
    borders,
    width: { size: w, type: WidthType.DXA },
    shading: { fill: isLabel ? 'F0F4F8' : 'FFFFFF', type: ShadingType.CLEAR },
    margins: cellPad,
    columnSpan: colspan,
    children: [new Paragraph({ children: [isLabel ? bold(text || '', 19) : run(text || '\u2014', { size: 19 })] })],
  });
}

function kvRow(l1, v1, l2, v2) {
  const cells = [kvCell(l1, true), kvCell(v1, false)];
  if (l2 !== undefined) { cells.push(kvCell(l2, true)); cells.push(kvCell(v2, false)); }
  return new TableRow({ children: cells });
}

function kvRowSpan(label, val) {
  return new TableRow({ children: [kvCell(label, true), kvCell(val, false, 3)] });
}

// ── Fee table (5 columns) ─────────────────────────────────────────────────────
const FEE_WIDTHS = [1800, 1500, 2600, 2600, 1966];

function feeHeaderRow() {
  return new TableRow({
    tableHeader: true,
    children: ['Fee Type', 'Billing Cycle', 'Commercial Value', 'Inclusions', 'Charged On'].map((h, i) =>
      new TableCell({
        borders,
        width: { size: FEE_WIDTHS[i], type: WidthType.DXA },
        shading: { fill: 'F0F4F8', type: ShadingType.CLEAR },
        margins: cellPad,
        children: [new Paragraph({ children: [bold(h, 18)] })],
      })
    ),
  });
}

function feeDataRow(values) {
  return new TableRow({
    children: values.map((v, i) =>
      new TableCell({
        borders,
        width: { size: FEE_WIDTHS[i], type: WidthType.DXA },
        margins: cellPad,
        children: (v || '\u2014').split('\n').map(l =>
          new Paragraph({ children: [run(l || '\u2014', { size: 19 })] })
        ),
      })
    ),
  });
}

// ── Data formatters ───────────────────────────────────────────────────────────
function fmtFeeCV(fee, sym) {
  if (fee.isLogistics) return 'As per rate card';
  if (fee.pricingModel === 'graduated') {
    return (fee.slabs || []).map(s =>
      s.from + '\u2013' + (s.to || '\u221e') + ': ' +
      (s.rateType?.startsWith('%') ? s.rate + s.rateType : sym + s.rate)
    ).join('\n');
  }
  if (fee.stepUpPricing && fee.stepUpValues?.length) {
    return fee.stepUpValues.map(sv =>
      sv.label + ': ' + sym + parseFloat(sv.value || 0).toLocaleString('en-IN')
    ).join('\n');
  }
  if (fee.transactionFeeIsPercent) return (fee.commercialValue || '0') + '%';
  if (fee.resourceFeeIsVariable)   return (fee.commercialValue ? sym + parseFloat(fee.commercialValue).toLocaleString('en-IN') : '\u2014') + ' (variable)';
  return fee.commercialValue ? sym + parseFloat(fee.commercialValue).toLocaleString('en-IN') : '\u2014';
}

function fmtInclusions(val) {
  if (!val) return '\u2014';
  if (Array.isArray(val)) {
    const parts = val.map(item =>
      typeof item === 'string' ? item : item.metric ? item.text + ' ' + item.metric : item.text
    ).filter(Boolean);
    return parts.length ? parts.join('\n') : '\u2014';
  }
  return val || '\u2014';
}

function buildTaxDetails(form, isYavi) {
  if (isYavi) return form.tax_number || '\u2014';
  const parts = [];
  if (form.gstin)      parts.push('GST: ' + form.gstin);
  if (form.pan)        parts.push('PAN: ' + form.pan);
  if (form.tax_number) parts.push('Tax/VAT: ' + form.tax_number);
  return parts.length ? parts.join('  \u00b7  ') : '\u2014';
}

// ── Signature box cell ────────────────────────────────────────────────────────
// 1.5 inches gap = 2160 DXA spacing (1440 DXA per inch)
function signBox(heading, name, desig, email) {
  return new TableCell({
    borders,
    width: { size: Math.floor(CW / 2), type: WidthType.DXA },
    margins: { top: 200, bottom: 200, left: 200, right: 200 },
    children: [
      new Paragraph({
        children: [bold(heading, 19)],
        spacing: { before: 0, after: 60 },
      }),
      // 1.5-inch blank space
      new Paragraph({
        children: [run('')],
        spacing: { before: 0, after: 2160 },
      }),
      // Signature line as paragraph bottom border
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999' } },
        spacing: { before: 0, after: 120 },
        children: [run('')],
      }),
      new Paragraph({ children: [bold(name || '________________________', 19)], spacing: { before: 0, after: 40 } }),
      new Paragraph({ children: [grey(desig || 'Authorised Signatory', 18)], spacing: { before: 0, after: 40 } }),
      ...(email ? [new Paragraph({ children: [grey(email, 17)], spacing: { before: 0, after: 40 } })] : []),
      new Paragraph({ children: [grey('Date: _______________', 18)], spacing: { before: 100, after: 0 } }),
    ],
  });
}

// ── T&C paragraph ─────────────────────────────────────────────────────────────
function tcPara(num, title, body) {
  return new Paragraph({
    spacing: { before: 100, after: 60 },
    children: [
      run(num + '. ', { bold: true, size: 18 }),
      run(title + ' \u2014 ', { bold: true, size: 18 }),
      run(body, { size: 18 }),
    ],
  });
}

// ── Main builder ──────────────────────────────────────────────────────────────
function buildDoc(form) {
  const isYavi   = form.entity === 'yavi'
    || (form.of_number || '').startsWith('OFYT')
    || (form.of_number || '').startsWith('OF-YT-');
  const sym      = getSym(form.committed_currency || (isYavi ? 'USD' : 'INR'));
  const svcs     = form.services_fees || [];
  const isBundle = svcs.length > 1;
  const ofNum    = form.of_number || 'DRAFT';
  const custName = form.customer_name || '\u2014';
  const sigName  = form.signatory_name  || '________________________';
  const sigDesig = form.signatory_designation || 'Authorised Signatory';
  const sigEmail = form.signatory_email || '';
  const taxDetails = buildTaxDetails(form, isYavi);

  const entitySignatoryName  = isYavi ? 'Vishesh Kumar'               : 'Sreeraman Mohan Girija';
  const entitySignatoryDesig = isYavi ? 'Founding Director'           : 'Whole-time Director';
  const entitySignatoryLabel = isYavi ? 'For: Yavi Technologies FZCO' : 'For: Shopsense Retail Technologies Limited';
  const entitySalesRepLabel  = isYavi ? 'Sales Rep (Yavi Technologies)' : 'Sales Rep (Fynd)';
  const footerEntity         = isYavi ? 'Yavi Technologies FZCO'      : 'Shopsense Retail Technologies Limited';

  const dateStr = form.signed_date
    ? fmtDate(form.signed_date)
    : fmtDate(form.submitted_at ? form.submitted_at.split('T')[0] : '');

  const LEFT_W = Math.round(CW * 0.55);
  const RIGHT_W = CW - LEFT_W;

  const children = [];

  // ── Letterhead ──────────────────────────────────────────────────────────────
  if (isYavi) {
    // Yavi: text-only letterhead (image not embeddable in docx easily)
    children.push(new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [LEFT_W, RIGHT_W],
      borders: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY },
        top: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder,
      },
      rows: [new TableRow({ children: [
        new TableCell({
          borders: noBorders,
          width: { size: LEFT_W, type: WidthType.DXA },
          margins: { top: 0, bottom: 160, left: 0, right: 0 },
          children: [
            new Paragraph({ spacing: { after: 60 }, children: [navy('Yavi Technologies FZCO', 26)] }),
            new Paragraph({ spacing: { after: 40 }, children: [grey('B1, Office 129, Dubai CommerCity, 117th St \u2013 Umm Ramool, Dubai', 17)] }),
            new Paragraph({ children: [grey('VAT: 104789269800003  |  LICENSE: 50455', 17)] }),
          ],
        }),
        new TableCell({
          borders: noBorders,
          width: { size: RIGHT_W, type: WidthType.DXA },
          verticalAlign: VerticalAlign.BOTTOM,
          margins: { top: 0, bottom: 160, left: 0, right: 0 },
          children: [
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [run('ORDER FORM', { bold: true, color: '64748B', size: 16, allCaps: true, font: 'Arial' })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(ofNum, { bold: true, color: NAVY, size: 36, font: 'Courier New' })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [grey('Date: ' + dateStr, 17)] }),
          ],
        }),
      ]}),
      ],
    }));
  } else {
    // Fynd letterhead
    children.push(new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [LEFT_W, RIGHT_W],
      borders: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY },
        top: noBorder, left: noBorder, right: noBorder, insideH: noBorder, insideV: noBorder,
      },
      rows: [new TableRow({ children: [
        new TableCell({
          borders: noBorders,
          width: { size: LEFT_W, type: WidthType.DXA },
          margins: { top: 0, bottom: 160, left: 0, right: 0 },
          children: [
            new Paragraph({ spacing: { after: 60 }, children: [navy('Shopsense Retail Technologies Limited', 26)] }),
            new Paragraph({ spacing: { after: 40 }, children: [grey('1st Floor, Wework Vijay Diamond, Andheri East, Mumbai \u2013 400 093', 17)] }),
            new Paragraph({ children: [grey('CIN: U52100MH2012PLC236314  |  GSTN: 27AALCA0442L1ZM  |  PAN: AALCA0442L', 17)] }),
          ],
        }),
        new TableCell({
          borders: noBorders,
          width: { size: RIGHT_W, type: WidthType.DXA },
          verticalAlign: VerticalAlign.BOTTOM,
          margins: { top: 0, bottom: 160, left: 0, right: 0 },
          children: [
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [run('ORDER FORM', { bold: true, color: '64748B', size: 16, allCaps: true, font: 'Arial' })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(ofNum, { bold: true, color: NAVY, size: 36, font: 'Courier New' })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [grey('Date: ' + dateStr, 17)] }),
          ],
        }),
      ]}),
      ],
    }));
  }

  children.push(new Paragraph({ children: [run('')], spacing: { before: 120, after: 0 } }));

  // ── Title ───────────────────────────────────────────────────────────────────
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 160 },
    children: [run('ORDER FORM', { bold: true, size: 30, allCaps: true, characterSpacing: 60, font: 'Arial', color: NAVY })],
  }));

  // ── Section A ────────────────────────────────────────────────────────────────
  children.push(sectionHeader('A. Client & Order Form Details'));
  children.push(new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: KV_WIDTHS,
    rows: [
      kvRow('Client Name', custName, 'OF Number', ofNum),
      kvRow('Brand / Trade Name', form.brand_name || '\u2014', 'Billing Currency', form.committed_currency || '\u2014'),
      kvRow('Billing Address', (form.billing_address || '\u2014').replace(/\n/g, ', '), 'OF Value', sym + parseFloat(form.of_value || 0).toLocaleString('en-IN')),
      isYavi
        ? kvRowSpan('Tax Details', taxDetails)
        : kvRow('Tax Details', taxDetails, 'Sales Channel', form.lead_type || '\u2014'),
      kvRow('Billing Email', form.billing_email || '\u2014', 'Start Date', fmtDate(form.start_date)),
      kvRow('OF Term', form.of_term || (form.of_term_months ? form.of_term_months + ' Months' : '\u2014'), 'End Date', fmtDate(form.end_date)),
      kvRow('PO Required', form.po_required || 'No', 'Auto Renewal', (form.auto_renewal || 'No') + ' (' + (form.renewal_term || 'NA') + ')'),
      kvRowSpan('Payment Terms', form.payment_terms || '\u2014'),
      kvRow(
        'Client Rep',
        [form.client_rep_name, form.client_rep_mobile, form.client_rep_email].filter(Boolean).join('  \u00b7  ') || '\u2014',
        entitySalesRepLabel,
        [form.sales_rep_name, form.sales_rep_email].filter(Boolean).join('  \u00b7  ') || '\u2014'
      ),
    ],
  }));

  // ── Section B ────────────────────────────────────────────────────────────────
  children.push(sectionHeader('B. Service Details' + (isBundle ? ' \u2014 Bundle: Yes' : '')));

  svcs.forEach((svc, i) => {
    children.push(new Paragraph({
      spacing: { before: 140, after: 0 },
      children: [run(String.fromCharCode(97 + i) + '. ' + (svc.name || '\u2014'), { bold: true, size: 20, color: NAVY, font: 'Arial' })],
    }));
    const feeRows = [feeHeaderRow()];
    (svc.fees || []).forEach(fee => {
      feeRows.push(feeDataRow([
        fee.feeType || '\u2014',
        fee.billingCycle || '\u2014',
        fmtFeeCV(fee, sym),
        fmtInclusions(fee.inclusions),
        fee.paymentTrigger || '\u2014',
      ]));
    });
    children.push(new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: FEE_WIDTHS,
      rows: feeRows,
    }));
  });

  // ── Section C (Special Terms) ─────────────────────────────────────────────────
  if (form.special_terms) {
    children.push(sectionHeader('C. Special Terms'));
    children.push(new Paragraph({
      spacing: { before: 60, after: 60 },
      children: [run(form.special_terms, { size: 18 })],
    }));
  }

  // ── T&C ──────────────────────────────────────────────────────────────────────
  children.push(new Paragraph({ spacing: { before: 220, after: 100 }, children: [bold('Important Notes:', 22)] }));

  if (isYavi) {
    children.push(tcPara('1', 'Ownership & Licensing', 'Shopsense Retail Technologies Limited (\u201cFynd\u201d) is the owner and licensor of the Software/Platform availed as Service(s) by the Client. Fynd has granted Yavi Technologies with licence to resell the Service(s) as an exclusive authorized reseller.'));
    children.push(tcPara('2', 'Agreement Scope', 'This Order Form shall be read together with schedules, annexures, SOP(s), SoW(s), and/or any written documents executed between the Parties, and shall constitute the entire understanding and agreement between the parties.'));
    children.push(tcPara('3', 'Term', 'The Service Period and all applicable Renewal Tenures are collectively referred to as the \u201cOrder Form Term\u201d. This Order Form is effective on the date the Service Period commences. Renewal will be applicable on then-current list price.'));
    children.push(tcPara('4', 'Fees', 'Client will be charged the fees set forth in this Order Form upon execution and in accordance with the applicable Billing Frequency. All fees will be exclusive of taxes. All fees except one time fee will be applicable for a minimal increment of 8% on then-current list price upon Renewal Term.'));
    children.push(tcPara('5', 'Validity', 'This Order Form shall remain valid for a period of seven (7) working days from the date of issuance. If not signed and returned within this period, the Order Form shall be deemed null and void unless extended in writing by Fynd.'));
  } else {
    children.push(tcPara('1', 'Entire Agreement', 'This Order Form, along with its accompanying schedules, annexures, SOPs, Terms of Service (TOS), and Privacy Policy, collectively constitute the entire agreement between the Parties. It supersedes and replaces all prior negotiations, discussions, understandings, writings, and agreements related to the subject matter herein.'));
    children.push(tcPara('2', 'Term', 'The Order Form Term includes the initial Service Period and all subsequent Renewal Terms. The Order Form becomes effective on the commencement date of the Service Period. Renewal shall be subject to the then-current list price prevailing at the time of renewal.'));
    children.push(tcPara('3', 'Extension Fees', 'If the Client avails any Extension Service(s), they shall be charged an Extension Fee for that Service(s) over and above the Fees mentioned in the Order Form. See the Extension Rate Card for details.'));
    children.push(tcPara('4', 'Fees and Payment Terms', 'a. The Client agrees to pay the fees upon execution according to the Billing Frequency specified. b. All fees are exclusive of applicable taxes. c. Recurring fees are subject to a minimum 8% increment on then-current list price at renewal. d. Early termination: the Client shall remain liable to pay the remaining fees for the rest of the respective term.'));
    children.push(tcPara('5', 'Publicity Rights', 'By signing this Order Form, the Client grants Fynd the right to use the Client\u2019s name, logo, trademark(s), and brand identifiers for publicity, PR, marketing, or branding activities.'));
    children.push(tcPara('6', 'Validity', 'This Order Form shall remain valid for a period of seven (7) working days from the date of issuance. If not signed and returned within this period, the Order Form shall be deemed null and void unless extended in writing by Fynd.'));
  }

  // ── Authorization — entity LEFT, customer RIGHT (matching pdf.js) ─────────────
  children.push(new Paragraph({ spacing: { before: 220, after: 100 }, children: [bold('Authorization:', 22)] }));

  children.push(new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [Math.floor(CW / 2), CW - Math.floor(CW / 2)],
    rows: [new TableRow({ children: [
      signBox(entitySignatoryLabel, entitySignatoryName, entitySignatoryDesig, ''),
      signBox('For: ' + custName, sigName, sigDesig, sigEmail),
    ]})],
  }));

  // ── Footer ───────────────────────────────────────────────────────────────────
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 180 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'EEEEEE' } },
    children: [grey('OF#: ' + ofNum + '  \u00b7  Generated: ' + new Date().toLocaleString('en-IN') + '  \u00b7  ' + footerEntity, 16)],
  }));

  return new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    }],
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function downloadDOCX(form) {
  const ofNum = form.of_number || 'DRAFT';
  try {
    const doc    = buildDoc(form);
    const buffer = await Packer.toBlob(doc);
    const url    = URL.createObjectURL(buffer);
    const a      = document.createElement('a');
    a.href     = url;
    a.download = 'OF_' + ofNum + '.docx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (err) {
    console.error('[downloadDOCX] Failed:', err);
    throw err;
  }
}
