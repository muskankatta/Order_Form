/**
 * Google Sheets → Platform importer
 * Uses GIS OAuth2 token client to get a Sheets read-only access token,
 * then fetches the Index tab and maps rows to platform form objects.
 */

import { uid } from './dates.js';

const SPREADSHEET_ID = '16YjUNyERrUU3oeHlGXdrZ9F3i5zB3RXOILFMfFDs6lQ';
const SHEET_RANGE    = 'Index!A1:AP';   // read headers + all data up to col AP

// ── Header → field mapping ─────────────────────────────────────────────────
const HEADER_MAP = {
  'order_form_no':              'of_number',
  'order form no':              'of_number',
  'customer_name':              'customer_name',
  'customer name':              'customer_name',
  'brand name':                 'brand_name',
  'brand_name':                 'brand_name',
  'services':                   'services_text',
  'segment':                    'segment',
  'sales team':                 'sales_team',
  'sales_team':                 'sales_team',
  'sales_representative':       'sales_rep_name',
  'sales representative':       'sales_rep_name',
  'lead_type':                  'lead_type',
  'lead type':                  'lead_type',
  'lead_name':                  'lead_name',
  'lead name':                  'lead_name',
  'lead_category':              'lead_category',
  'lead category':              'lead_category',
  'start_date':                 'start_date',
  'end_date':                   'end_date',
  'auto_renewal':               'auto_renewal',
  'auto renewal':               'auto_renewal',
  'renewal_term':               'renewal_term',
  'renewal term':               'renewal_term',
  'sent for signing':           'approved_at',
  'date_of_signing':            'signed_date',
  'date of signing':            'signed_date',
  'submitted':                  '_col_submitted',
  'signed':                     '_col_signed',
  'dropped':                    '_col_dropped',
  'arr':                        'arr_text',
  'committed revenue':          'committed_revenue',
  'committed revenue currency': 'committed_currency',
  'comments':                   'comments',
  'country':                    'country',
  'region':                     'region',
  'authorised signatory name':  'signatory_name',
  'authorised signatory email': 'signatory_email',
  'customer cc':                'customer_cc',
  'sales representative email': 'sales_rep_email',
};

// Get OAuth2 access token for Sheets read scope via GIS
export function requestSheetsToken(clientId) {
  return new Promise((resolve, reject) => {
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      callback: response => {
        if (response.error) reject(new Error(response.error));
        else resolve(response.access_token);
      },
    });
    tokenClient.requestAccessToken();
  });
}

// Fetch raw sheet data
async function fetchSheet(accessToken) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(SHEET_RANGE)}`;
  const res  = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Failed to fetch sheet');
  }
  const data = await res.json();
  return data.values || [];
}

// Normalise cell value
function cell(row, idx) {
  return (row[idx] || '').toString().trim();
}

// Parse a sheet date string to ISO date (handles DD/MM/YYYY, YYYY-MM-DD, serial numbers)
function parseDate(val) {
  if (!val) return '';
  // Excel serial number
  if (/^\d{5}$/.test(val)) {
    const d = new Date(Date.UTC(1899, 11, 30) + parseInt(val) * 86400000);
    return d.toISOString().split('T')[0];
  }
  // DD/MM/YYYY
  const dmy = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.split('T')[0];
  // Try native parse
  const d = new Date(val);
  return isNaN(d) ? '' : d.toISOString().split('T')[0];
}

// Determine form status from boolean columns + data
function resolveStatus(raw) {
  const isTrue = v => ['true','yes','1','TRUE','Yes'].includes((v||'').toString().trim());
  if (isTrue(raw._col_dropped))   return 'dropped';
  if (isTrue(raw._col_signed))    return 'signed';
  if (isTrue(raw._col_submitted)) return 'approved';
  if (raw.approved_at)            return 'approved';
  if (raw.of_number)              return 'submitted';
  return 'draft';
}

// Build services_fees array from comma-separated service names
function buildServicesFees(text) {
  if (!text) return [];
  return text.split(/[,;\/]/).map(s => s.trim()).filter(Boolean).map(name => ({
    id:   uid(),
    name,
    fees: [],
  }));
}

// Calculate OF term label from start/end dates
function calcOfTerm(start, end) {
  if (!start || !end) return '';
  const s = new Date(start), e = new Date(end);
  const months = Math.round((e - s) / (1000 * 60 * 60 * 24 * 30.44));
  if (months <= 1)  return '1 Month';
  if (months <= 3)  return '3 Months';
  if (months <= 6)  return '6 Months';
  if (months <= 12) return '12 Months';
  if (months <= 24) return '24 Months';
  if (months <= 36) return '36 Months';
  return months + ' Months';
}

/**
 * Main import function.
 * @param {string} accessToken - Google OAuth2 access token
 * @param {Array}  existingForms - current forms from Firestore
 * @param {Function} onProgress - callback(message) for progress updates
 * @returns {{ imported, updated, skipped, errors }}
 */
export async function importFromSheets(accessToken, existingForms, onProgress) {
  onProgress('Fetching sheet data…');
  const rows = await fetchSheet(accessToken);
  if (rows.length < 2) throw new Error('Sheet appears empty or has no data rows.');

  // Build header index
  const headers = rows[0].map(h => h.toString().toLowerCase().trim());
  const colIdx  = {};
  headers.forEach((h, i) => {
    const field = HEADER_MAP[h];
    if (field) colIdx[field] = i;
  });

  // AP is always index 41 (0-based) — override signed_of_link
  const AP_IDX = 41;

  onProgress(`Parsing ${rows.length - 1} rows…`);

  const results = { imported: 0, updated: 0, skipped: 0, errors: [], toWrite: [] };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Read raw values using header index
    const raw = {};
    Object.entries(colIdx).forEach(([field, idx]) => {
      raw[field] = cell(row, idx);
    });

    // Always read AP for signed_of_link
    raw.signed_of_link = cell(row, AP_IDX);

    // Skip completely empty rows
    if (!raw.of_number && !raw.customer_name) continue;

    // Parse dates
    raw.start_date   = parseDate(raw.start_date);
    raw.end_date     = parseDate(raw.end_date);
    raw.approved_at  = parseDate(raw.approved_at) ? parseDate(raw.approved_at) + 'T00:00:00.000Z' : '';
    raw.signed_date  = parseDate(raw.signed_date);

    // Resolve status
    const status = resolveStatus(raw);

    // Build the platform form object
    const form = {
      of_number:         raw.of_number || '',
      customer_name:     raw.customer_name || '',
      brand_name:        raw.brand_name || '',
      segment:           raw.segment || '',
      sales_team:        raw.sales_team || '',
      sales_rep_name:    raw.sales_rep_name || '',
      sales_rep_email:   raw.sales_rep_email || '',
      lead_type:         raw.lead_type || '',
      lead_name:         raw.lead_name || '',
      lead_category:     raw.lead_category || '',
      start_date:        raw.start_date || '',
      end_date:          raw.end_date || '',
      auto_renewal:      raw.auto_renewal || '',
      renewal_term:      raw.renewal_term || '',
      of_term:           calcOfTerm(raw.start_date, raw.end_date),
      arr_text:          raw.arr_text || '',
      committed_revenue: raw.committed_revenue ? parseFloat(raw.committed_revenue.replace(/[₹$,]/g,'')) || '' : '',
      committed_currency:raw.committed_currency || 'INR',
      comments:          raw.comments || '',
      country:           raw.country || '',
      signatory_name:    raw.signatory_name || '',
      signatory_email:   raw.signatory_email || '',
      customer_cc:       raw.customer_cc || '',
      services_fees:     buildServicesFees(raw.services_text),
      signed_of_link:    raw.signed_of_link || '',
      approved_at:       raw.approved_at || '',
      signed_date:       raw.signed_date || '',
      status,
      _imported_from_sheets: true,
    };

    // Match with existing form by of_number
    const existing = existingForms.find(f =>
      f.of_number && form.of_number && f.of_number === form.of_number
    );

    if (existing) {
      // Compare key fields
      const diff = [
        'status','customer_name','brand_name','sales_rep_name','start_date',
        'end_date','committed_revenue','committed_currency','signed_date',
        'signed_of_link','arr_text',
      ].some(k => String(existing[k]||'') !== String(form[k]||''));

      if (!diff) { results.skipped++; continue; }

      results.toWrite.push({ ...existing, ...form, id: existing.id });
      results.updated++;
    } else {
      results.toWrite.push({ ...form, id: uid(), created_at: new Date().toISOString() });
      results.imported++;
    }
  }

  onProgress(`Parsed: ${results.imported} new · ${results.updated} updates · ${results.skipped} unchanged`);
  return results;
}
