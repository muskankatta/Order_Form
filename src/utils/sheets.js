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
import { getRepRegion } from '../constants/users.js';

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
// Inclusions is an array of { text, metric } (or legacy string). Render like the OF.
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
  'Customer_Name', 'Brand Name', 'Services', 'Segment',
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
  i + 1,                                                        // SrNo
  fmt(f.of_number),                                             // Order_Form_No
  fmt(getQtr(f.start_date)),                                    // QTR
  fmt(getFY(f.start_date)),                                     // FY_for_Incentive
  fmt(f.customer_name),                                         // Customer_Name
  fmt(f.brand_name),                                            // Brand Name
  (f.services_fees||[]).map(s=>s.name).filter(Boolean).join('; '), // Services
  fmt(f.segment),                                               // Segment
  fmt(f.sales_team),                                            // Sales Team
  fmt(f.sales_rep_name),                                        // Sales_Representative
  fmt(f.lead_type),                                             // Lead_type
  fmt(f.lead_name),                                             // Lead_name
  fmt(f.lead_category),                                         // Lead_category
  fmt(f.start_date),                                            // Start_date
  fmt(f.end_date),                                              // End_date
  fmt(f.auto_renewal),                                          // Auto_Renewal
  fmt(f.renewal_term),                                          // Renewal_Term
  fmt(f.of_term || (f.of_term_months ? f.of_term_months + ' Months' : '')), // Order_Form_Term
  fmt(f.approved_at?.split('T')[0]),                            // Sent for Signing
  fmt(f.signed_date),                                           // Date_of_Signing
  bool(['submitted','revops_approved','revops_rejected','approved','signed'].includes(f.status)), // Submitted
  bool(f.signed_date || f.status === 'signed'),                 // Signed
  bool(f.status === 'dropped' || f.is_dropped),                 // Dropped
  '',                                                            // Expired (manual field)
  fmt(unsignedAging(f)),                                        // Unsigned Aging
  fmt(f.submitted_link),                                        // Submitted_Link
  fmt(f.signed_of_link),                                        // Signed_Link
  fmt((f.arr_text||'').replace(/\n/g,' | ')),                  // ARR
  fmt(f.committed_revenue),                                     // Committed Revenue
  fmt(f.committed_currency || 'INR'),                           // Committed Revenue Currency
  fmt(f.comments || f.revops_comment || f.finance_comment),    // Comments
  bool(f.is_churn || f.status === 'churn'),                    // Churn
  fmt(days(f.submitted_at, f.approved_at)),                    // TAT (submission → approval)
  fmt(f.country),                                               // Country
  fmt(f.country),                                               // Region (same as Country)
  fmt(f.valyx),                                                 // Valyx
  fmt(f.slack_id),                                              // Slack ID
  fmt(f.signatory_name),                                        // Authorised Signatory Name
  fmt(f.signatory_email),                                       // Authorised Signatory Email
  fmt(f.customer_cc),                                           // Customer CC
  fmt(f.sales_rep_email),                                       // Sales Representative Email
];

// ── SERVICE INDEX ROW ────────────────────────────────────────────────────────
const SERVICE_HEADERS = [
  'SrNo', 'Order_Form_No', 'QTR', 'FY_for_Incentive',
  'Customer_Name', 'Brand Name', 'Service',
  'Fee Type', 'Billing Cycle', 'Commercial Value', 'Inclusions', 'Unit/Metric',
  'Segment', 'Sales Team', 'Sales_Representative',
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
        fmt(f.segment),
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

// Cache the access token in memory (valid ~1h) so repeated syncs in the same
// session reuse it instead of triggering a second OAuth popup (which browsers
// block outside a user gesture — COOP / popup-blocker).
let _tokenCache = { value: null, exp: 0 };

/** Get an OAuth2 access token with Sheets write scope (cached while valid) */
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

/** Sync all forms to Google Sheets — Index tab + Service Index tab */
export async function syncAllToSheets(forms, onProgress, tokenIn) {
  const sheetsId = getSheetId();
  if (!sheetsId) throw new Error('No Google Sheet ID configured. Go to Settings to add one.');

  onProgress?.('Requesting Google Sheets access...');
  const token = tokenIn || await getAccessToken();

  // Build Index data
  onProgress?.('Building Index tab...');
  const indexValues = [INDEX_HEADERS, ...forms.map((f, i) => toIndexRow(f, i))];

  // Build Service Index data
  onProgress?.('Building Service Index tab...');
  const serviceValues = [SERVICE_HEADERS];
  let svcIdx = 0;
  forms.forEach(f => {
    const rows = toServiceRows(f, svcIdx);
    serviceValues.push(...rows);
    svcIdx += rows.length;
  });

  // Write both tabs
  onProgress?.(`Writing ${indexValues.length - 1} rows to Index tab...`);
  await writeTab(sheetsId, 'OF Index', indexValues, token);

  onProgress?.(`Writing ${serviceValues.length - 1} rows to Service Index tab...`);
  await writeTab(sheetsId, 'Service Index', serviceValues, token);

  onProgress?.(`✓ Synced ${forms.length} OFs to Google Sheets`);
  return { indexRows: indexValues.length - 1, serviceRows: serviceValues.length - 1 };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMERCIALS TAB — one row per fee line, colour coded, written in real time
// on Finance approval, on signing, and on live-date / deal-status updates.
// Additive only: the OF Index and Service Index tabs above are untouched.
// ═══════════════════════════════════════════════════════════════════════════

const COMMERCIALS_TAB = 'Commercials';

// Which OFs belong in the commercials sheet (Finance-approved onward)
const isExported = f =>
  !!f.approved_at ||
  ['approved', 'signed', 'completed', 'revised', 'churn', 'void'].includes(f.status);

const isYavi = f =>
  f.entity === 'yavi' ||
  (f.of_number || '').startsWith('OFYT') ||
  (f.of_number || '').startsWith('OF-YT');

// Region: explicit form value, else inferred from the sales rep (same as the app's views)
const regionOf = f => f.region || getRepRegion(f.sales_rep_email) || '';

// Strip the parenthetical from a unit metric: "BCA (Brand Calculated Amount)" -> "BCA"
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

// Commercial Value = NUMBER ONLY (blank for variable/slab/step-up/rate-card)
const numericValueOf = fee => {
  if (fee.isLogistics || fee.pricingModel === 'graduated' || isStepUpFee(fee)) return '';
  const v = parseFloat(fee.commercialValue);
  return isNaN(v) ? '' : v;
};

// Charged On = the textual basis only (no number)
const chargedOnOf = fee => {
  if (fee.isLogistics) return 'As per rate card';
  const unit = fee.unitMetric || '';
  if (isPercentFee(fee)) return unit ? 'of ' + shortMetric(unit) : '';
  if (isPerUnitFee(fee)) return unit ? 'per ' + shortMetric(unit) : '';
  return unit; // lump amount / slab / step-up → the metric (Store, User, …)
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

// ── Column model ─────────────────────────────────────────────────────────────
// Groups define the coloured header bands (and their column spans, in order).
const COMM_GROUPS = [
  { label: 'Order form',        cols: 21, band: '#B5D4F4', title: '#EAF1FA', text: '#042C53' },
  { label: 'Status & signing',  cols: 7,  band: '#9FE1CB', title: '#E7F5EF', text: '#04342C' },
  { label: 'Service',           cols: 2,  band: '#CECBF6', title: '#F0EFFB', text: '#26215C' },
  { label: 'Fee line',          cols: 10, band: '#D3D1C7', title: '#F4F3EE', text: '#2C2C2A' },
];

const COMM_HEADERS = [
  // Order form (0–20)
  'OF Number', 'Entity', 'Customer Name', 'Brand / Trade Name', 'Sales Type',
  'Sales Channel', 'Lead Category', 'Lead Name', 'Segment', 'Sales Team', 'Region',
  'Sales Rep', 'Sales Rep Email', 'Billing Currency', 'Order Form Value', 'OF Term',
  'Service Period Start', 'Service Period End', 'Auto Renewal', 'Renewal Frequency', 'Payment Terms',
  // Status & signing (21–27)
  'Status', 'Approved At', 'Signing Date', 'Signing Quarter', 'Signing FY', 'Signed OF Link', 'Live Date',
  // Service (27–28)
  'Bundle Service', 'Service Name',
  // Fee line (29–38)
  'Fee Type', 'Billing Cycle', 'Pricing Model', 'Fee Basis', 'Commercial Value',
  'Charged On', 'Inclusions', 'Slab Detail', 'Step-up Detail', 'Special Terms / Notes',
];

const COL = {
  salesType: 4, leadCategory: 6, status: 21, pricingModel: 32,
};
const TOTAL_COLS = COMM_HEADERS.length; // 39
const DATA_START_ROW = 2;               // rows 0=band, 1=titles, 2+=data

// Sort key: approval time (fallbacks for legacy/edge rows). Ascending → newest last.
const approvalKey = f =>
  Date.parse(f.approved_at || f.signed_at || f.signed_date || f.created_at || '') || 0;

// Build the data rows (one per fee line) and the per-OF banding blocks.
function buildCommercials(forms) {
  const rows = [];
  const blocks = [];                // { start, end } row indices (sheet-absolute) per OF
  const ordered = forms.filter(isExported).slice().sort((a, b) => approvalKey(a) - approvalKey(b));
  ordered.forEach(f => {
    const entity     = isYavi(f) ? 'Yavi' : 'Fynd';
    const bundle     = (f.services_fees || []).filter(Boolean).length > 1 ? 'Yes' : 'No';
    const signedLink = hyperlink(f.signed_of_link, 'View signed OF');
    const ofHead = [
      fmt(f.of_number), entity, fmt(f.customer_name), fmt(f.brand_name), fmt(f.sale_type),
      fmt(f.lead_type), fmt(f.lead_category), fmt(f.lead_name), fmt(f.segment), fmt(f.sales_team), regionOf(f),
      fmt(f.sales_rep_name), fmt(f.sales_rep_email), fmt(f.committed_currency || 'INR'),
      fmt(f.of_value), fmt(f.of_term || (f.of_term_months ? f.of_term_months + ' Months' : '')),
      fmt(f.start_date), fmt(f.end_date), fmt(f.auto_renewal), fmt(f.renewal_term), fmt(f.payment_terms),
    ];
    const statusSign = [
      fmt(STATUS[f.status]?.label || f.status), fmt(f.approved_at?.split('T')[0]),
      fmt(f.signed_date), fmt(getQtr(f.signed_date)), fmt(getFY(f.signed_date)),
      signedLink, fmt(f.live_date),
    ];
    const blockStart = DATA_START_ROW + rows.length;
    const services = (f.services_fees || []).filter(Boolean);
    const pushFee = (svcName, fee) => {
      rows.push([
        ...ofHead, ...statusSign, bundle, fmt(svcName),
        fmt(fee?.feeType), fmt(fee?.billingCycle), fee ? pricingModelOf(fee) : '',
        fee ? feeBasisOf(fee) : '', fee ? numericValueOf(fee) : '',
        fee ? chargedOnOf(fee) : '', inclusionsText(fee?.inclusions),
        fee ? slabDetailOf(fee) : '', fee ? stepUpDetailOf(fee, f.committed_currency) : '',
        fmt(f.special_terms),
      ]);
    };
    if (!services.length) {
      pushFee('', null);
    } else {
      services.forEach(svc => {
        const fees = (svc.fees || []).filter(Boolean);
        if (!fees.length) pushFee(svc.name, null);
        else fees.forEach(fee => pushFee(svc.name, fee));
      });
    }
    const blockEnd = DATA_START_ROW + rows.length;
    if (blockEnd > blockStart) blocks.push({ start: blockStart, end: blockEnd });
  });
  return { rows, blocks };
}

// ── Colour helpers ───────────────────────────────────────────────────────────
const hexToRgb = hex => {
  const h = hex.replace('#', '');
  return {
    red:   parseInt(h.slice(0, 2), 16) / 255,
    green: parseInt(h.slice(2, 4), 16) / 255,
    blue:  parseInt(h.slice(4, 6), 16) / 255,
  };
};

// value → { bg, fg } maps for conditional formatting (status cell only, etc.)
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

// ── Sheets API plumbing for the Commercials tab ──────────────────────────────
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

/**
 * Real-time sync of the Commercials tab. Regenerates the whole tab from all
 * Finance-approved-onward forms (dedup-safe), then re-applies colour coding.
 */
export async function syncCommercialsToSheets(forms, onProgress, tokenIn) {
  const sheetsId = getSheetId();
  if (!sheetsId) throw new Error('No Google Sheet ID configured. Go to Settings to add one.');
  const token = tokenIn || await getAccessToken();

  // 1. Ensure the tab exists, get its sheetId + existing CF rule count
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

  // 2. Build values: group band row, header titles row, data rows
  onProgress?.('Building commercials rows…');
  const { rows, blocks } = buildCommercials(forms);
  const bandRow = [];
  COMM_GROUPS.forEach(g => { bandRow.push(g.label); for (let i = 1; i < g.cols; i++) bandRow.push(''); });
  const values = [bandRow, COMM_HEADERS, ...rows];
  const dataEndRow = DATA_START_ROW + rows.length;

  // 3. Clear + write values
  onProgress?.(`Writing ${rows.length} fee-line rows…`);
  await clearTab(sheetsId, COMMERCIALS_TAB, token);
  await writeTab(sheetsId, COMMERCIALS_TAB, values, token);

  // 4. Formatting
  onProgress?.('Applying colour coding…');
  const colEnd = i => COMM_GROUPS.slice(0, i).reduce((s, g) => s + g.cols, 0);
  const requests = [];
  // remove old conditional rules (reverse order)
  for (let i = existingCF - 1; i >= 0; i--) requests.push({ deleteConditionalFormatRule: { sheetId, index: i } });
  // reset any stale backgrounds across a generous data area
  requests.push({ repeatCell: {
    range: { sheetId, startRowIndex: DATA_START_ROW, endRowIndex: Math.max(dataEndRow, 5000),
             startColumnIndex: 0, endColumnIndex: TOTAL_COLS },
    cell: { userEnteredFormat: { backgroundColor: hexToRgb('#FFFFFF') } },
    fields: 'userEnteredFormat.backgroundColor' } });
  // unmerge then merge the group band cells
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
      fields: 'userEnteredFormat(backgroundColor,textFormat)' } });
  });
  // per-OF alternating bands
  blocks.forEach((b, i) => {
    requests.push({ repeatCell: {
      range: { sheetId, startRowIndex: b.start, endRowIndex: b.end, startColumnIndex: 0, endColumnIndex: TOTAL_COLS },
      cell: { userEnteredFormat: { backgroundColor: hexToRgb(i % 2 === 0 ? BAND_A : BAND_B) } },
      fields: 'userEnteredFormat.backgroundColor' } });
  });
  // freeze 2 rows + basic filter on the titles row
  requests.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 2 } }, fields: 'gridProperties.frozenRowCount' } });
  requests.push({ setBasicFilter: { filter: { range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: TOTAL_COLS } } } });
  // conditional colour rules (status / pricing model / sales type / lead category)
  if (rows.length) requests.push(...cfRules(sheetId, dataEndRow));

  // batchUpdate can be large — chunk to be safe
  for (let i = 0; i < requests.length; i += 200) {
    await batchUpdate(sheetsId, requests.slice(i, i + 200), token);
  }

  onProgress?.(`✓ Commercials tab synced — ${rows.length} fee lines`);
  return { feeRows: rows.length };
}

/**
 * Fire-and-forget wrapper used by the approval / signing / live-date handlers.
 * Never throws — a Sheets failure must not affect the platform flow.
 */
export function autoSyncCommercials(forms) {
  try {
    if (!getSheetId()) return;                       // not configured → skip silently
    if (!forms?.some(isExported)) return;            // nothing to export yet
    syncCommercialsToSheets(forms).catch(e =>
      console.warn('[Commercials] auto-sync skipped:', e?.message || e));
  } catch (e) {
    console.warn('[Commercials] auto-sync error:', e?.message || e);
  }
}
