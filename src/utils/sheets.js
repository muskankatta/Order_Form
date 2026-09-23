/**
 * Google Sheets sync — writes to two tabs matching the OF_Data_for_Platform.xlsx format:
 *   Tab 1: "OF Index"         — one row per Order Form (41 columns)
 *   Tab 2: "Service Index" — one row per service within each OF
 *
 * Requires an OAuth2 access token with scope:
 *   https://www.googleapis.com/auth/spreadsheets
 *
 * Call getAccessToken() to obtain a fresh token via Google Identity Services,
 * then pass it to syncAllToSheets(forms, token).
 */

import { getQtr, getFY } from './dates.js';
import { STATUS } from '../constants/status.js';
import { getSym, cyclesInDateRange } from './formatting.js';
import { getRepRegion, REVENUE_ARCHITECTS } from '../constants/users.js';
import { formBusinessUnits } from '../constants/formOptions.js';
import { db } from '../firebase.js';
import { collection, getDocs } from 'firebase/firestore';

// ── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = v => (v === null || v === undefined) ? '' : String(v);
const bool = v => v ? 'TRUE' : 'FALSE';
const days = (a, b) => {
  if (!a || !b) return '';
  const diff = Math.floor((new Date(b) - new Date(a)) / 86400000);
  return isNaN(diff) ? '' : diff;
};
const unsignedAging = f => {
  if (f.signed_date || f.status === 'signed') return 0;
  if (!f.approved_at) return '';
  return Math.floor((new Date() - new Date(f.approved_at)) / 86400000);
};
const inclusionsText = val => {
  if (!val) return '';
  if (Array.isArray(val)) {
    return val.map(item =>
      typeof item === 'string' ? item : (item.metric ? `${item.text} ${item.metric}` : item.text)
    ).filter(Boolean).join(' | ');
  }
  return String(val);
};

// ── INDEX ROW (41 columns, matching Excel exactly) ───────────────────────────
const INDEX_HEADERS = [
  'SrNo', 'Order_Form_No', 'QTR', 'FY_for_Incentive',
  'Customer_Name', 'Brand Name', 'Services', 'Business Unit(s)',
  'Sales Team', 'Sales_Representative', 'Lead_type', 'Lead_name', 'Lead_category',
  'Start_date', 'End_date', 'Auto_Renewal', 'Renewal_Term', 'Order_Form_Term',
  'Sent for Signing', 'Date_of_Signing',
  'Submitted', 'Signed', 'Dropped', 'Expired', 'Unsigned Aging',
  'Submitted_Link', 'Signed_Link',
  'ARR', 'Committed Revenue', 'Committed Revenue Currency',
  'Comments', 'Churn', 'TAT',
  'Country', 'Region', 'Valyx',
  'Slack ID', 'Authorised Signatory Name', 'Authorised Signatory Email',
  'Customer CC', 'Sales Representative Email',
];

const toIndexRow = (f, i) => [
  i + 1,
  fmt(f.of_number),
  fmt(getQtr(f.start_date)),
  fmt(getFY(f.start_date)),
  fmt(f.customer_name),
  fmt(f.brand_name),
  (f.services_fees||[]).map(s=>s.name).filter(Boolean).join('; '),
  fmt(formBusinessUnits(f).join('; ')),
  fmt(f.sales_team),
  fmt(f.sales_rep_name),
  fmt(f.lead_type),
  fmt(f.lead_name),
  fmt(f.lead_category),
  fmt(f.start_date),
  fmt(f.end_date),
  fmt(f.auto_renewal),
  fmt(f.renewal_term),
  fmt(f.of_term || (f.of_term_months ? f.of_term_months + ' Months' : '')),
  fmt(f.approved_at?.split('T')[0]),
  fmt(f.signed_date),
  bool(['submitted','revops_approved','revops_rejected','approved','signed'].includes(f.status)),
  bool(f.signed_date || f.status === 'signed'),
  bool(f.status === 'dropped' || f.is_dropped),
  '',
  fmt(unsignedAging(f)),
  fmt(f.submitted_link),
  fmt(f.signed_of_link),
  fmt((f.arr_text||'').replace(/\n/g,' | ')),
  fmt(f.committed_revenue),
  fmt(f.committed_currency || 'INR'),
  fmt(f.comments || f.revops_comment || f.finance_comment),
  bool(f.is_churn || f.status === 'churn'),
  fmt(days(f.submitted_at, f.approved_at)),
  fmt(f.country),
  fmt(f.country),
  fmt(f.valyx),
  fmt(f.slack_id),
  fmt(f.signatory_name),
  fmt(f.signatory_email),
  fmt(f.customer_cc),
  fmt(f.sales_rep_email),
];

// ── SERVICE INDEX ROW ────────────────────────────────────────────────────────
const SERVICE_HEADERS = [
  'SrNo', 'Order_Form_No', 'QTR', 'FY_for_Incentive',
  'Customer_Name', 'Brand Name', 'Service',
  'Fee Type', 'Billing Cycle', 'Commercial Value', 'Inclusions', 'Unit/Metric',
  'Business Unit(s)', 'Sales Team', 'Sales_Representative',
  'Lead_type', 'Lead_category',
  'Start_date', 'End_date', 'Order_Form_Term',
  'ARR', 'Committed Revenue', 'Committed Revenue Currency',
  'Submitted', 'Signed', 'Status',
  'Country', 'Sales Representative Email',
];

const toServiceRows = (f, startIdx) => {
  const rows = [];
  (f.services_fees||[]).forEach(svc => {
    (svc.fees||[]).forEach(fee => {
      rows.push([
        startIdx + rows.length + 1,
        fmt(f.of_number),
        fmt(getQtr(f.start_date)),
        fmt(getFY(f.start_date)),
        fmt(f.customer_name),
        fmt(f.brand_name),
        fmt(svc.name),
        fmt(fee.feeType),
        fmt(fee.billingCycle),
        fee.isLogistics ? 'As per rate card' :
          fee.pricingModel === 'graduated' ? 'Variable' :
          fmt(fee.commercialValue),
        inclusionsText(fee.inclusions),
        fmt(fee.unitMetric),
        fmt(formBusinessUnits(f).join('; ')),
        fmt(f.sales_team),
        fmt(f.sales_rep_name),
        fmt(f.lead_type),
        fmt(f.lead_category),
        fmt(f.start_date),
        fmt(f.end_date),
        fmt(f.of_term || (f.of_term_months ? f.of_term_months + ' Months' : '')),
        fmt((f.arr_text||'').replace(/\n/g,' | ')),
        fmt(f.committed_revenue),
        fmt(f.committed_currency || 'INR'),
        bool(['submitted','revops_approved','approved','signed'].includes(f.status)),
        bool(f.signed_date || f.status === 'signed'),
        fmt(STATUS[f.status]?.label || f.status),
        fmt(f.country),
        fmt(f.sales_rep_email),
      ]);
    });
  });
  return rows;
};

// ── SHEETS API WRITE ─────────────────────────────────────────────────────────
const SETTINGS_KEY = 'fynd_of_settings';

function getSheetId() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return s.sheetsId || import.meta.env.VITE_SHEETS_ID || '';
  } catch { return ''; }
}

async function writeTab(sheetsId, tabName, values, token) {
  const range = encodeURIComponent(`${tabName}!A1`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets write failed: ${res.status}`);
  }
  return res.json();
}

// ── PUBLIC API ───────────────────────────────────────────────────────────────
let _tokenCache = { value: null, exp: 0 };

export function getAccessToken(forceNew = false) {
  return new Promise((resolve, reject) => {
    const now = Date.now();
    if (!forceNew && _tokenCache.value && _tokenCache.exp > now + 60000) {
      resolve(_tokenCache.value);
      return;
    }
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      callback: (resp) => {
        if (resp.error) { reject(new Error(resp.error)); return; }
        _tokenCache = {
          value: resp.access_token,
          exp: Date.now() + (Number(resp.expires_in || 3600) * 1000),
        };
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

export function getAccessTokenSilent() {
  const now = Date.now();
  if (_tokenCache.value && _tokenCache.exp > now + 60000) return _tokenCache.value;
  return null;
}

export async function syncAllToSheets(forms, onProgress, tokenIn) {
  const sheetsId = getSheetId();
  if (!sheetsId) throw new Error('No Google Sheet ID configured. Go to Settings to add one.');

  onProgress?.('Requesting Google Sheets access...');
  const token = tokenIn || await getAccessToken();

  onProgress?.('Building Index tab...');
  const indexValues = [INDEX_HEADERS, ...forms.map((f, i) => toIndexRow(f, i))];

  onProgress?.('Building Service Index tab...');
  const serviceValues = [SERVICE_HEADERS];
  let svcIdx = 0;
  forms.forEach(f => {
    const rows = toServiceRows(f, svcIdx);
    serviceValues.push(...rows);
    svcIdx += rows.length;
  });

  onProgress?.(`Writing ${indexValues.length - 1} rows to Index tab...`);
  await writeTab(sheetsId, 'OF Index', indexValues, token);

  onProgress?.(`Writing ${serviceValues.length - 1} rows to Service Index tab...`);
  await writeTab(sheetsId, 'Service Index', serviceValues, token);

  onProgress?.(`✓ Synced ${forms.length} OFs to Google Sheets`);
  return { indexRows: indexValues.length - 1, serviceRows: serviceValues.length - 1 };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMERCIALS TAB
// ═══════════════════════════════════════════════════════════════════════════

const COMMERCIALS_TAB = 'Commercials';

const isExported = f =>
  !!f.approved_at ||
  ['approved', 'signed', 'completed', 'revised', 'churn', 'void'].includes(f.status);

const isYavi = f =>
  f.entity === 'yavi' ||
  (f.of_number || '').startsWith('OFYT') ||
  (f.of_number || '').startsWith('OF-YT');

const regionOf = f => f.region || getRepRegion(f.sales_rep_email) || '';

const shortMetric = m => (m ? String(m).split(' (')[0].trim() : '');

const isStepUpFee = fee => !!(fee.stepUpPricing && (fee.stepUpValues || []).length);
const isPercentFee = fee => fee.pricingModel !== 'graduated' && !fee.isLogistics && !!fee.transactionFeeIsPercent;
const isPerUnitFee = fee =>
  fee.pricingModel !== 'graduated' && !fee.isLogistics && !fee.transactionFeeIsPercent &&
  (fee.feeType === 'Transaction Fee' || fee.feeType === 'Usage Fee' ||
   (fee.feeType === 'Resource Fee' && fee.resourceFeeIsVariable));

const pricingModelOf = fee =>
  fee.isLogistics ? 'Rate card' :
  fee.pricingModel === 'graduated' ? 'Slab' :
  isStepUpFee(fee) ? 'Step-up' : 'Flat';

const feeBasisOf = fee =>
  fee.isLogistics ? 'Rate card' :
  fee.pricingModel === 'graduated' ? 'Variable' :
  isStepUpFee(fee) ? 'Variable' :
  isPercentFee(fee) ? 'Percentage (%)' :
  isPerUnitFee(fee) ? 'Per-unit (₹)' : 'Amount (₹)';

const numericValueOf = fee => {
  if (fee.isLogistics || fee.pricingModel === 'graduated' || isStepUpFee(fee)) return '';
  const v = parseFloat(fee.commercialValue);
  return isNaN(v) ? '' : v;
};

const chargedOnOf = fee => {
  if (fee.isLogistics) return 'As per rate card';
  const unit = fee.unitMetric || '';
  if (isPercentFee(fee)) return unit ? 'of ' + shortMetric(unit) : '';
  if (isPerUnitFee(fee)) return unit ? 'per ' + shortMetric(unit) : '';
  return unit;
};

const slabDetailOf = fee => {
  if (fee.pricingModel !== 'graduated') return '';
  return (fee.slabs || []).map(sl => {
    const rt = sl.rateTypeCustom || sl.rateType || '';
    return `${sl.from}–${sl.to || '∞'}: ${sl.rate}${rt ? ' ' + rt : ''}`;
  }).join(' | ');
};

const stepUpDetailOf = (fee, code) => {
  if (!isStepUpFee(fee)) return '';
  const sym = getSym(code || 'INR');
  return (fee.stepUpValues || []).map((sv, i) => {
    const rate = parseFloat(sv.rate != null ? sv.rate : sv.value) || 0;
    const cycles = (sv.startDate && sv.endDate && sv.billingCycle)
      ? cyclesInDateRange(sv.startDate, sv.endDate, sv.billingCycle) : 1;
    const total = rate * cycles;
    const label = (sv.startDate && sv.endDate) ? `${sv.startDate}–${sv.endDate}` : `P${i + 1}`;
    return `${label} (${sv.billingCycle || '?'}): ${sym}${rate.toLocaleString('en-IN')} × ${cycles} = ${sym}${total.toLocaleString('en-IN')}`;
  }).join(' | ');
};

const hyperlink = (url, label) =>
  url ? `=HYPERLINK("${String(url).replace(/"/g, '')}","${label}")` : '';

const COMM_GROUPS = [
  { label: 'Order form',        cols: 21, band: '#B5D4F4', title: '#EAF1FA', text: '#042C53' },
  { label: 'Status & signing',  cols: 7,  band: '#9FE1CB', title: '#E7F5EF', text: '#04342C' },
  { label: 'Service',           cols: 2,  band: '#CECBF6', title: '#F0EFFB', text: '#26215C' },
  { label: 'Fee line',          cols: 10, band: '#D3D1C7', title: '#F4F3EE', text: '#2C2C2A' },
  { label: 'Client / Billing',  cols: 8,  band: '#F4D9B0', title: '#FBEFDA', text: '#4A2C02' },
  { label: 'Revenue Architect', cols: 3,  band: '#E3D5F5', title: '#F3ECFB', text: '#3B2A5C' },
];

const COMM_HEADERS = [
  'OF Number', 'Entity', 'Customer Name', 'Brand / Trade Name', 'Sales Type',
  'Sales Channel', 'Lead Category', 'Lead Name', 'Business Unit(s)', 'Sales Team', 'Region',
  'Sales Rep', 'Sales Rep Email', 'Billing Currency', 'Order Form Value', 'OF Term',
  'Service Period Start', 'Service Period End', 'Auto Renewal', 'Renewal Frequency', 'Payment Terms',
  'Status', 'Approved At', 'Signing Date', 'Signing Quarter', 'Signing FY', 'Signed OF Link', 'Live Date',
  'Bundle Service', 'Service Name',
  'Fee Type', 'Billing Cycle', 'Pricing Model', 'Fee Basis', 'Commercial Value',
  'Charged On', 'Inclusions', 'Slab Detail', 'Step-up Detail', 'Special Terms / Notes',
  'Billing Address', 'Billing Email', 'GSTIN', 'PAN', 'Tax / VAT Number',
  'Client Rep Name', 'Client Rep Email', 'Client Rep Mobile',
  'Revenue Architect', 'RA Email',
  'SoW Link',
];

const COL = {
  salesType: 4, leadCategory: 6, status: 21, pricingModel: 32,
};
const TOTAL_COLS = COMM_HEADERS.length;
const DATA_START_ROW = 2;

const approvalKey = f =>
  Date.parse(f.approved_at || f.signed_at || f.signed_date || f.created_at || '') || 0;

function buildCommercials(forms) {
  const rows = [];
  const blocks = [];
  const ordered = forms.filter(isExported).slice().sort((a, b) => approvalKey(a) - approvalKey(b));
  ordered.forEach(f => {
    const entity     = isYavi(f) ? 'Yavi' : 'Fynd';
    const bundle     = (f.services_fees || []).filter(Boolean).length > 1 ? 'Yes' : 'No';
    const signedLink = hyperlink(f.signed_of_link, 'View signed OF');
    const ofHead = [
      fmt(f.of_number), entity, fmt(f.customer_name), fmt(f.brand_name), fmt(f.sale_type),
      fmt(f.lead_type), fmt(f.lead_category), fmt(f.lead_name), fmt(formBusinessUnits(f).join('; ')), fmt(f.sales_team), regionOf(f),
      fmt(f.sales_rep_name), fmt(f.sales_rep_email), fmt(f.committed_currency || 'INR'),
      fmt(f.of_value), fmt(f.of_term || (f.of_term_months ? f.of_term_months + ' Months' : '')),
      fmt(f.start_date), fmt(f.end_date), fmt(f.auto_renewal), fmt(f.renewal_term), fmt(f.payment_terms),
    ];
    const statusSignFor = (liveDate) => [
      fmt(STATUS[f.status]?.label || f.status), fmt(f.approved_at?.split('T')[0]),
      fmt(f.signed_date), fmt(getQtr(f.signed_date)), fmt(getFY(f.signed_date)),
      signedLink, fmt(liveDate),
    ];
    const clientBilling = [
      fmt(f.billing_address), fmt(f.billing_email), fmt(f.gstin), fmt(f.pan), fmt(f.tax_number),
      fmt(f.client_rep_name), fmt(f.client_rep_email), fmt(f.client_rep_mobile),
    ];
    const blockStart = DATA_START_ROW + rows.length;
    const services = (f.services_fees || []).filter(Boolean);
    const pushFee = (svc, fee) => {
      rows.push([
        ...ofHead, ...statusSignFor(svc?.live_date || ''), bundle, fmt(svc?.name || ''),
        fmt(fee?.feeType), fmt(fee?.billingCycle), fee ? pricingModelOf(fee) : '',
        fee ? feeBasisOf(fee) : '', fee ? numericValueOf(fee) : '',
        fee ? chargedOnOf(fee) : '', inclusionsText(fee?.inclusions),
        fee ? slabDetailOf(fee) : '', fee ? stepUpDetailOf(fee, f.committed_currency) : '',
        fmt(f.special_terms),
        ...clientBilling,
        fmt(f.ra_email==='NA' ? 'NA' : f.ra_name), fmt(f.ra_email),
        fmt(f.sow_link || f.sow_reference_link || ''),
      ]);
    };
    if (!services.length) {
      pushFee(null, null);
    } else {
      services.forEach(svc => {
        const fees = (svc.fees || []).filter(Boolean);
        if (!fees.length) pushFee(svc, null);
        else fees.forEach(fee => pushFee(svc, fee));
      });
    }
    const blockEnd = DATA_START_ROW + rows.length;
    if (blockEnd > blockStart) blocks.push({ start: blockStart, end: blockEnd });
  });
  return { rows, blocks };
}

const hexToRgb = hex => {
  const h = hex.replace('#', '');
  return {
    red:   parseInt(h.slice(0, 2), 16) / 255,
    green: parseInt(h.slice(2, 4), 16) / 255,
    blue:  parseInt(h.slice(4, 6), 16) / 255,
  };
};

const STATUS_FILL = {
  'Signed ✍️': { bg: '#EAF3DE', fg: '#173404' },
  'Approved ✓': { bg: '#FAEEDA', fg: '#412402' },
  'Completed':  { bg: '#E1F5EE', fg: '#04342C' },
  'Revised':    { bg: '#E6F1FB', fg: '#042C53' },
  'Churn':      { bg: '#FCEBEB', fg: '#501313' },
  'Void':       { bg: '#FCEBEB', fg: '#501313' },
};
const PRICING_FILL = {
  'Slab':      { bg: '#E6F1FB', fg: '#042C53' },
  'Step-up':   { bg: '#EEEDFE', fg: '#26215C' },
  'Rate card': { bg: '#F1EFE8', fg: '#2C2C2A' },
};
const SALETYPE_FILL = {
  'New Business':            { bg: '#E1F5EE', fg: '#04342C' },
  'Renewal':                 { bg: '#E6F1FB', fg: '#042C53' },
  'Upsell':                  { bg: '#FAECE7', fg: '#4A1B0C' },
  'Cross-Sell':              { bg: '#FBEAF0', fg: '#4B1528' },
  'Shift from SoW':          { bg: '#F1EFE8', fg: '#2C2C2A' },
  'Revision in Commercials': { bg: '#FAEEDA', fg: '#412402' },
};
const LEADCAT_FILL = {
  'Event':                  { bg: '#E6F1FB', fg: '#042C53' },
  'Inside Sales/Pre-Sales': { bg: '#EEEDFE', fg: '#26215C' },
  'Partner':                { bg: '#FBEAF0', fg: '#4B1528' },
  'NA':                     { bg: '#F1EFE8', fg: '#2C2C2A' },
};
const BAND_A = '#FBFBF9';
const BAND_B = '#F1EFE8';

function cfRules(sheetId, dataEndRow) {
  const rules = [];
  const add = (col, map) => {
    Object.entries(map).forEach(([val, c]) => {
      rules.push({ addConditionalFormatRule: { index: 0, rule: {
        ranges: [{ sheetId, startRowIndex: DATA_START_ROW, endRowIndex: dataEndRow,
                   startColumnIndex: col, endColumnIndex: col + 1 }],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: val }] },
          format: { backgroundColor: hexToRgb(c.bg),
                    textFormat: { bold: true, foregroundColor: hexToRgb(c.fg) } },
        },
      } } });
    });
  };
  add(COL.status, STATUS_FILL);
  add(COL.pricingModel, PRICING_FILL);
  add(COL.salesType, SALETYPE_FILL);
  add(COL.leadCategory, LEADCAT_FILL);
  return rules;
}

async function getMeta(sheetsId, token) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}?fields=sheets(properties(sheetId,title),conditionalFormats)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Sheets read failed: ${res.status}`);
  return res.json();
}

async function batchUpdate(sheetsId, requests, token) {
  if (!requests.length) return;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}:batchUpdate`,
    { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Sheets batchUpdate failed: ${res.status}`);
  }
  return res.json();
}

async function clearTab(sheetsId, tab, token) {
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/${encodeURIComponent(tab)}:clear`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: '{}' }
  );
}

export async function syncCommercialsToSheets(forms, onProgress, tokenIn) {
  const sheetsId = getSheetId();
  if (!sheetsId) throw new Error('No Google Sheet ID configured. Go to Settings to add one.');
  const token = tokenIn || await getAccessToken();

  let meta = await getMeta(sheetsId, token);
  let sheet = meta.sheets.find(s => s.properties.title === COMMERCIALS_TAB);
  if (!sheet) {
    onProgress?.('Creating Commercials tab…');
    const r = await batchUpdate(sheetsId,
      [{ addSheet: { properties: { title: COMMERCIALS_TAB, gridProperties: { frozenRowCount: 2 } } } }], token);
    const props = r.replies[0].addSheet.properties;
    sheet = { properties: props, conditionalFormats: [] };
  }
  const sheetId = sheet.properties.sheetId;
  const existingCF = (sheet.conditionalFormats || []).length;

  onProgress?.('Building commercials rows…');
  const { rows, blocks } = buildCommercials(forms);
  const bandRow = [];
  COMM_GROUPS.forEach(g => { bandRow.push(g.label); for (let i = 1; i < g.cols; i++) bandRow.push(''); });
  const values = [bandRow, COMM_HEADERS, ...rows];
  const dataEndRow = DATA_START_ROW + rows.length;

  onProgress?.(`Writing ${rows.length} fee-line rows…`);
  await clearTab(sheetsId, COMMERCIALS_TAB, token);
  await writeTab(sheetsId, COMMERCIALS_TAB, values, token);

  onProgress?.('Applying colour coding…');
  const colEnd = i => COMM_GROUPS.slice(0, i).reduce((s, g) => s + g.cols, 0);
  const requests = [];
  for (let i = existingCF - 1; i >= 0; i--) requests.push({ deleteConditionalFormatRule: { sheetId, index: i } });
  requests.push({ repeatCell: {
    range: { sheetId, startRowIndex: DATA_START_ROW, endRowIndex: Math.max(dataEndRow, 5000),
             startColumnIndex: 0, endColumnIndex: TOTAL_COLS },
    cell: { userEnteredFormat: { backgroundColor: hexToRgb('#FFFFFF') } },
    fields: 'userEnteredFormat.backgroundColor' } });
  requests.push({ unmergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: TOTAL_COLS } } });
  COMM_GROUPS.forEach((g, gi) => {
    const start = colEnd(gi), end = start + g.cols;
    requests.push({ mergeCells: { mergeType: 'MERGE_ALL',
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: start, endColumnIndex: end } } });
    requests.push({ repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: start, endColumnIndex: end },
      cell: { userEnteredFormat: { backgroundColor: hexToRgb(g.band), horizontalAlignment: 'LEFT',
              textFormat: { bold: true, foregroundColor: hexToRgb(g.text) } } },
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)' } });
    requests.push({ repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: start, endColumnIndex: end },
      cell: { userEnteredFormat: { backgroundColor: hexToRgb(g.title),
              textFormat: { bold: true, foregroundColor: hexToRgb(g.text) } } },
      fields: 'userEntiredFormat(backgroundColor,textFormat)' } });
  });
  blocks.forEach((b, i) => {
    requests.push({ repeatCell: {
      range: { sheetId, startRowIndex: b.start, endRowIndex: b.end, startColumnIndex: 0, endColumnIndex: TOTAL_COLS },
      cell: { userEnteredFormat: { backgroundColor: hexToRgb(i % 2 === 0 ? BAND_A : BAND_B) } },
      fields: 'userEnteredFormat.backgroundColor' } });
  });
  requests.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 2 } }, fields: 'gridProperties.frozenRowCount' } });
  requests.push({ setBasicFilter: { filter: { range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: TOTAL_COLS } } } });
  if (rows.length) requests.push(...cfRules(sheetId, dataEndRow));

  for (let i = 0; i < requests.length; i += 200) {
    await batchUpdate(sheetsId, requests.slice(i, i + 200), token);
  }

  onProgress?.(`✓ Commercials tab synced — ${rows.length} fee lines`);
  return { feeRows: rows.length };
}

export function autoSyncCommercials(forms) {
  try {
    if (!getSheetId()) return;
    if (!forms?.some(isExported)) return;
    const token = getAccessTokenSilent();
    if (!token) return;
    syncCommercialsToSheets(forms, () => {}, token).catch(e =>
      console.warn('[Commercials] auto-sync skipped:', e?.message || e));
  } catch (e) {
    console.warn('[Commercials] auto-sync error:', e?.message || e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Churn Customers tab
// ═══════════════════════════════════════════════════════════════════════════
const CHURN_TAB = 'Churn Customers';
export const CHURN_HEADERS = [
  'Company ID', 'Customer', 'Entity', 'OF Number', 'Churn Type', 'Churned IP / Service',
  'Effective Date', 'Churn Amount', 'Currency', 'Billing Region', 'Agreement Type',
  'Reason', 'Actioned / Requested By', 'Date', 'Revenue Architect',
];

function churnEntityLabel(of) {
  if (!of) return '';
  const k = of.entity || '';
  const n = of.of_number || '';
  if (k === 'yavi'   || n.startsWith('OFYT') || n.startsWith('OF-YT-')) return 'Yavi';
  if (k === 'fynduk' || n.startsWith('OF-UK-')) return 'Fynd UK';
  return 'Fynd';
}

export function buildChurnRows(forms, requests) {
  const rows = [];
  const dateOf = r => (r.actioned_at || r.requested_at || '');
  const churnReqs = (requests || [])
    .filter(r => r.status_requested === 'Churn')
    .slice()
    .sort((a, b) => new Date(dateOf(a)) - new Date(dateOf(b)));
  churnReqs.forEach(r => {
    const of = !r.is_others ? (forms || []).find(f => f.id === r.form_id || f.of_number === r.of_number) : null;
    const applied  = !!r.actioned && !r.rejected;
    const pending  = !r.is_others && !applied;
    const currency = of ? (of.committed_currency || 'INR') : (r.currency || '');
    const entLabel = r.is_others ? '' : churnEntityLabel(of);
    const by   = r.actioned_by || r.requested_by || '';
    const date = (r.actioned_at || r.requested_at || '').split('T')[0] || '';
    const raName = REVENUE_ARCHITECTS.find(ra => ra.email === r.ra_approver)?.name || r.ra_approver || '';
    const base = {
      company: r.company_id || '', customer: r.customer_name || '', ent: entLabel,
      of: r.of_number || '', currency, region: r.billing_region || '',
      agreement: r.agreement_type || '', reason: r.reason || '', by, date, ra: raName,
    };
    const amtCell = v => (v != null && v !== '') ? v : (pending ? 'Pending' : '');
    let first = true;
    const push = cells => { rows.push({ cells, req: r, firstOfGroup: first, applied }); first = false; };

    if (r.churn_type === 'Partial') {
      const ips = r.is_others
        ? (r.ip_services || []).map(n => ({ name: n, effective_date: r.effective_date, amount: null }))
        : (r.churned_services || []).map(s => ({ name: s.name, effective_date: s.effective_date, amount: s.amount }));
      if (!ips.length) ips.push({ name: '(no IP selected)', effective_date: r.effective_date, amount: null });
      ips.forEach(ip => push([
        base.company, base.customer, base.ent, base.of, 'Partial', ip.name,
        ip.effective_date || '', r.is_others ? '' : amtCell(ip.amount), base.currency,
        base.region, base.agreement, base.reason, base.by, base.date, base.ra,
      ]));
    } else {
      const fullServiceNames = of
        ? (of.services_fees || []).map(s => s.name).filter(Boolean)
        : (r.ip_services || []);
      const fullServiceLabel = fullServiceNames.length ? fullServiceNames.join(', ') : 'All (full churn)';
      push([
        base.company, base.customer, base.ent, base.of, 'Full', fullServiceLabel,
        r.effective_date || '', r.is_others ? '' : amtCell(r.churn_amount_applied),
        base.currency, base.region, base.agreement, base.reason, base.by, base.date, base.ra,
      ]);
    }
  });
  return rows;
}

export async function syncChurnCustomers(forms, tokenIn) {
  const sheetsId = getSheetId();
  if (!sheetsId) throw new Error('No Google Sheet ID configured.');
  const token = tokenIn || await getAccessToken();

  let requests = [];
  try {
    const snap = await getDocs(collection(db, 'churn_void_requests'));
    snap.forEach(d => requests.push({ id: d.id, ...d.data() }));
  } catch (e) { console.warn('[Churn] request fetch failed:', e?.message || e); }

  let meta = await getMeta(sheetsId, token);
  let sheet = meta.sheets.find(s => s.properties.title === CHURN_TAB);
  if (!sheet) {
    const r = await batchUpdate(sheetsId,
      [{ addSheet: { properties: { title: CHURN_TAB, gridProperties: { frozenRowCount: 1 } } } }], token);
    sheet = { properties: r.replies[0].addSheet.properties };
  }
  const sheetId = sheet.properties.sheetId;

  const rows = buildChurnRows(forms, requests);
  const values = [CHURN_HEADERS, ...rows.map(r => r.cells)];

  await clearTab(sheetsId, CHURN_TAB, token);
  await writeTab(sheetsId, CHURN_TAB, values, token);

  await batchUpdate(sheetsId, [{
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
      cell: { userEnteredFormat: {
        backgroundColor: { red: 0.106, green: 0.169, blue: 0.294 },
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
      } },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  }], token);

  return { rows: rows.length };
}

export function autoSyncChurnCustomers(forms) {
  try {
    if (!getSheetId()) return;
    const token = getAccessTokenSilent();
    if (!token) return;
    syncChurnCustomers(forms, token).catch(e => console.warn('[Churn] auto-sync skipped:', e?.message || e));
  } catch (e) {
    console.warn('[Churn] auto-sync error:', e?.message || e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFORMA INVOICES TAB
// One row per (line item, collection) pair — zipped by position.
// If a PI has more line items than collections (or vice versa), the shorter
// side leaves its columns blank on the extra rows.
// PI-level fields (status, grand total, currency, entity, created by,
// reviewed by) appear on every row for easy filtering.
// ═══════════════════════════════════════════════════════════════════════════

const PI_TAB = 'Proforma Invoices';

// Two header-band groups for colour coding
const PI_GROUPS = [
  { label: 'Proforma Invoice Details', cols: 13, band: '#B5D4F4', title: '#EAF1FA', text: '#042C53' },
  { label: 'Collection Entry',         cols: 9,  band: '#9FE1CB', title: '#E7F5EF', text: '#04342C' },
];

const PI_HEADERS = [
  // PI-level (0–12)
  'PI Number', 'Entity', 'OF Number', 'Customer Name', 'Status',
  'Currency', 'Service', 'Fee Type', 'Line Amount',
  'Subtotal', 'Tax', 'Grand Total', 'Created By',
  // Collection-level (13–21)
  'Collection Date', 'Collection Amount (Money in Bank)',
  'TDS %', 'TDS Amount', 'Total (Collection + TDS)',
  'Payment Mode', 'Reference / UTR', 'Notes', 'Recorded By',
];

const PI_TOTAL_COLS = PI_HEADERS.length; // 22
const PI_DATA_START = 2; // row 0 = band, row 1 = headers, row 2+ = data

const piEntityLabel = pi => {
  const n = pi.pi_number || '';
  if (pi.entity === 'yavi'   || n.startsWith('PI-YT')) return 'Yavi';
  if (pi.entity === 'fynduk' || n.startsWith('PI-UK')) return 'Fynd UK';
  return 'Fynd';
};

const PI_STATUS_LABEL = {
  submitted:       'Pending Approval',
  approved:        'Approved',
  rejected:        'Rejected',
  cancelled:       'Cancelled',
  fully_collected: 'Fully Collected',
};

/**
 * Build all data rows for the Proforma Invoices tab.
 * Sorts PIs by created_at ascending (oldest first, newest at bottom).
 */
function buildPIRows(pis) {
  const rows  = [];
  const blocks = []; // for alternating PI banding

  const sorted = [...(pis || [])].sort((a, b) => {
    const ta = a.created_at?.toMillis?.() || Date.parse(a.created_at) || 0;
    const tb = b.created_at?.toMillis?.() || Date.parse(b.created_at) || 0;
    return ta - tb;
  });

  sorted.forEach(pi => {
    const lineItems   = pi.line_items   || [];
    const collections = pi.collections  || [];
    const rowCount    = Math.max(lineItems.length, collections.length, 1);
    const blockStart  = PI_DATA_START + rows.length;

    // PI-level fields repeated on every row
    const piBase = [
      fmt(pi.pi_number),
      piEntityLabel(pi),
      fmt(pi.of_number || ''),
      fmt(pi.customer_name),
      fmt(PI_STATUS_LABEL[pi.status] || pi.status),
      fmt(pi.currency || 'INR'),
    ];

    // Subtotal / tax / grand total shown only on first row to avoid repetition
    // but still included on all rows for filter/formula convenience
    const piTotals = [
      pi.subtotal    != null ? Number(pi.subtotal)    : '',
      pi.tax_amount  != null ? Number(pi.tax_amount)  : '',
      pi.grand_total != null ? Number(pi.grand_total) : '',
    ];

    for (let i = 0; i < rowCount; i++) {
      const li  = lineItems[i]   || null;
      const col = collections[i] || null;

      // Sort collections by date for consistent pairing
      const sortedCols = [...collections].sort((a, b) => new Date(a.date) - new Date(b.date));
      const colEntry = sortedCols[i] || null;

      rows.push([
        // PI-level
        ...piBase,
        fmt(li?.service   || ''),
        fmt(li?.fee_type  || ''),
        li?.total != null ? Number(li.total) : '',
        // Totals (on every row for filtering)
        ...piTotals,
        fmt(pi.created_by_name || ''),
        // Collection-level
        fmt(colEntry?.date               || ''),
        colEntry?.amount  != null ? Number(colEntry.amount)     : '',
        colEntry?.tds_pct != null && colEntry?.tds_pct !== '' ? Number(colEntry.tds_pct) : '',
        colEntry?.tds_amount != null ? Number(colEntry.tds_amount) : '',
        colEntry?.total   != null ? Number(colEntry.total)      :
          (colEntry?.amount != null ? Number(colEntry.amount)   : ''),
        fmt(colEntry?.mode               || ''),
        fmt(colEntry?.payment_reference  || ''),
        fmt(colEntry?.notes              || ''),
        fmt(colEntry?.recorded_by_name   || ''),
      ]);
    }

    const blockEnd = PI_DATA_START + rows.length;
    if (blockEnd > blockStart) blocks.push({ start: blockStart, end: blockEnd });
  });

  return { rows, blocks };
}

/**
 * Full regenerate of the Proforma Invoices tab.
 * Called by syncPIToSheets (manual trigger) and autosyncPI (fire-and-forget).
 */
export async function syncPIToSheets(pis, onProgress, tokenIn) {
  const sheetsId = getSheetId();
  if (!sheetsId) throw new Error('No Google Sheet ID configured. Go to Settings to add one.');
  const token = tokenIn || await getAccessToken();

  // Ensure tab exists
  let meta = await getMeta(sheetsId, token);
  let sheet = meta.sheets.find(s => s.properties.title === PI_TAB);
  if (!sheet) {
    onProgress?.('Creating Proforma Invoices tab…');
    const r = await batchUpdate(sheetsId,
      [{ addSheet: { properties: { title: PI_TAB, gridProperties: { frozenRowCount: 2 } } } }], token);
    sheet = { properties: r.replies[0].addSheet.properties, conditionalFormats: [] };
  }
  const sheetId    = sheet.properties.sheetId;
  const existingCF = (sheet.conditionalFormats || []).length;

  // Build values
  onProgress?.('Building PI rows…');
  const { rows, blocks } = buildPIRows(pis);

  // Band row (group labels)
  const bandRow = [];
  PI_GROUPS.forEach(g => { bandRow.push(g.label); for (let i = 1; i < g.cols; i++) bandRow.push(''); });

  const values     = [bandRow, PI_HEADERS, ...rows];
  const dataEndRow = PI_DATA_START + rows.length;

  // Clear + write
  onProgress?.(`Writing ${rows.length} rows to Proforma Invoices tab…`);
  await clearTab(sheetsId, PI_TAB, token);
  await writeTab(sheetsId, PI_TAB, values, token);

  // Formatting
  onProgress?.('Applying formatting…');
  const requests = [];

  // Remove old CF rules
  for (let i = existingCF - 1; i >= 0; i--)
    requests.push({ deleteConditionalFormatRule: { sheetId, index: i } });

  // Reset backgrounds
  requests.push({ repeatCell: {
    range: { sheetId, startRowIndex: PI_DATA_START,
             endRowIndex: Math.max(dataEndRow, 2000),
             startColumnIndex: 0, endColumnIndex: PI_TOTAL_COLS },
    cell: { userEnteredFormat: { backgroundColor: hexToRgb('#FFFFFF') } },
    fields: 'userEnteredFormat.backgroundColor',
  }});

  // Unmerge + merge + colour the group band row
  requests.push({ unmergeCells: { range: {
    sheetId, startRowIndex: 0, endRowIndex: 1,
    startColumnIndex: 0, endColumnIndex: PI_TOTAL_COLS,
  }}});
  let colCursor = 0;
  PI_GROUPS.forEach(g => {
    const start = colCursor, end = colCursor + g.cols;
    requests.push({ mergeCells: { mergeType: 'MERGE_ALL', range: {
      sheetId, startRowIndex: 0, endRowIndex: 1,
      startColumnIndex: start, endColumnIndex: end,
    }}});
    requests.push({ repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1,
               startColumnIndex: start, endColumnIndex: end },
      cell: { userEnteredFormat: {
        backgroundColor: hexToRgb(g.band),
        horizontalAlignment: 'LEFT',
        textFormat: { bold: true, foregroundColor: hexToRgb(g.text) },
      }},
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,textFormat)',
    }});
    requests.push({ repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2,
               startColumnIndex: start, endColumnIndex: end },
      cell: { userEnteredFormat: {
        backgroundColor: hexToRgb(g.title),
        textFormat: { bold: true, foregroundColor: hexToRgb(g.text) },
      }},
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    }});
    colCursor = end;
  });

  // Alternating PI banding
  const PI_BAND_A = '#FBFBF9';
  const PI_BAND_B = '#EFF6FF'; // soft blue tint for the PI rows
  blocks.forEach((b, i) => {
    requests.push({ repeatCell: {
      range: { sheetId, startRowIndex: b.start, endRowIndex: b.end,
               startColumnIndex: 0, endColumnIndex: PI_TOTAL_COLS },
      cell: { userEnteredFormat: { backgroundColor: hexToRgb(i % 2 === 0 ? PI_BAND_A : PI_BAND_B) } },
      fields: 'userEnteredFormat.backgroundColor',
    }});
  });

  // Status conditional formatting (column 4 = "Status")
  const PI_STATUS_FILL = {
    'Pending Approval': { bg: '#fef3c7', fg: '#92400e' },
    'Approved':         { bg: '#d1fae5', fg: '#065f46' },
    'Rejected':         { bg: '#fee2e2', fg: '#991b1b' },
    'Cancelled':        { bg: '#f1f5f9', fg: '#64748b' },
    'Fully Collected':  { bg: '#dcfce7', fg: '#14532d' },
  };
  if (rows.length) {
    Object.entries(PI_STATUS_FILL).forEach(([val, c]) => {
      requests.push({ addConditionalFormatRule: { index: 0, rule: {
        ranges: [{ sheetId, startRowIndex: PI_DATA_START, endRowIndex: dataEndRow,
                   startColumnIndex: 4, endColumnIndex: 5 }],
        booleanRule: {
          condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: val }] },
          format: { backgroundColor: hexToRgb(c.bg),
                    textFormat: { bold: true, foregroundColor: hexToRgb(c.fg) } },
        },
      }}});
    });
  }

  // Freeze 2 rows + basic filter
  requests.push({ updateSheetProperties: {
    properties: { sheetId, gridProperties: { frozenRowCount: 2 } },
    fields: 'gridProperties.frozenRowCount',
  }});
  requests.push({ setBasicFilter: { filter: { range: {
    sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: PI_TOTAL_COLS,
  }}}}); 

  // Send in chunks
  for (let i = 0; i < requests.length; i += 200)
    await batchUpdate(sheetsId, requests.slice(i, i + 200), token);

  onProgress?.(`✓ Proforma Invoices tab synced — ${rows.length} rows across ${pis?.length || 0} PIs`);
  return { rows: rows.length };
}

/**
 * Fire-and-forget PI tab refresh.
 * Called whenever a PI is created, approved, rejected, cancelled,
 * or a collection is added / edited / deleted.
 * Never throws — a Sheets failure must not affect the platform flow.
 */
export function autoSyncPI(pis) {
  try {
    if (!getSheetId()) return;
    if (!pis?.length) return;
    const token = getAccessTokenSilent();
    if (!token) return; // no Sheets grant → skip silently
    syncPIToSheets(pis, () => {}, token).catch(e =>
      console.warn('[PI] auto-sync skipped:', e?.message || e));
  } catch (e) {
    console.warn('[PI] auto-sync error:', e?.message || e);
  }
}
