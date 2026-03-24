/** Google Sheets sync.
 *  Uses the authenticated user's OAuth access token (requested with spreadsheets scope).
 *  SHEETS_ID must be set in .env as VITE_SHEETS_ID. */

const SHEETS_ID = import.meta.env.VITE_SHEETS_ID;
const RANGE     = 'OF_Repository!A1';

const hdrs = [
  'OF Number','Customer','Brand','Segment','Sales Team','Sales Rep',
  'Lead Type','Sale Type','Start Date','End Date','Term','Currency',
  'OF Value','Committed Revenue','ARR','Services','Status',
  'Submitted At','RevOps Reviewed At','Approved At','Signed Date',
  'Comments','Is Revised','Is Void','Is Churn',
];

const toRow = f => [
  f.of_number||'',f.customer_name||'',f.brand_name||'',f.segment||'',
  f.sales_team||'',f.sales_rep_name||'',f.lead_type||'',f.sale_type||'',
  f.start_date||'',f.end_date||'',f.of_term||'',f.committed_currency||'INR',
  f.of_value||'',f.committed_revenue||'',(f.arr_text||'').replace(/\n/g,' | '),
  (f.services_fees||[]).map(s=>s.name).join('; '),
  f.status||'',f.submitted_at||'',f.revops_reviewed_at||'',
  f.approved_at||'',f.signed_date||'',f.comments||'',
  f.is_revised?'Yes':'',f.is_void?'Yes':'',f.is_churn?'Yes':'',
];

export async function syncToSheets(forms, accessToken) {
  if (!SHEETS_ID || !accessToken) return;
  const values = [hdrs, ...forms.map(toRow)];
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${RANGE}?valueInputOption=USER_ENTERED`,
      {
        method:'PUT',
        headers:{ Authorization:`Bearer ${accessToken}`, 'Content-Type':'application/json' },
        body: JSON.stringify({ values }),
      }
    );
  } catch(e) { console.error('[Sheets] sync failed', e); }
}
