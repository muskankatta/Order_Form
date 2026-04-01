/**
 * Google Sheets sync — writes to two tabs matching the OF_Data_for_Platform.xlsx format:
 *   Tab 1: "Index"         — one row per Order Form (41 columns)
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
        fmt(fee.inclusions),
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

/** Get a fresh OAuth2 access token with Sheets write scope */
export function getAccessToken() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error));
        else resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

/** Sync all forms to Google Sheets — Index tab + Service Index tab */
export async function syncAllToSheets(forms, onProgress) {
  const sheetsId = getSheetId();
  if (!sheetsId) throw new Error('No Google Sheet ID configured. Go to Settings to add one.');

  onProgress?.('Requesting Google Sheets access...');
  const token = await getAccessToken();

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
  await writeTab(sheetsId, 'Index', indexValues, token);

  onProgress?.(`Writing ${serviceValues.length - 1} rows to Service Index tab...`);
  await writeTab(sheetsId, 'Service Index', serviceValues, token);

  onProgress?.(`✓ Synced ${forms.length} OFs to Google Sheets`);
  return { indexRows: indexValues.length - 1, serviceRows: serviceValues.length - 1 };
}
