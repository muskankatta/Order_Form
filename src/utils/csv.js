import { getQtr, getFY } from './dates.js';
import { STATUS } from '../constants/status.js';

const esc = v => `"${(v||'').toString().replace(/"/g,'""')}"`;
const row = cols => cols.map(esc).join(',');

export const exportOFIndex = forms => {
  const hdr = ['#','OF No','QTR','FY','Customer','Brand','Services','Segment',
    'Team','Rep','Lead Type','Sale Type','Start','End','ARR','Committed Revenue','Currency','Status'];
  const rows = forms.map((f,i) => [
    i+1, f.of_number||'', getQtr(f.start_date), getFY(f.start_date),
    f.customer_name, f.brand_name,
    (f.services_fees||[]).map(s=>s.name).join('; '),
    f.segment, f.sales_team, f.sales_rep_name, f.lead_type, f.sale_type,
    f.start_date, f.end_date,
    (f.arr_text||'').replace(/\n/g,' | '),
    f.committed_revenue, f.committed_currency||'INR',
    STATUS[f.status]?.label || f.status,
  ]);
  download([hdr,...rows], 'OF_Index');
};

export const exportServiceIndex = forms => {
  const hdr = ['#','OF No','Customer','Brand','Service','Fee Summary','Start','End','Status'];
  const rows = [];
  forms.forEach(f => (f.services_fees||[]).forEach(svc => {
    rows.push([
      rows.length+1, f.of_number||'', f.customer_name, f.brand_name, svc.name,
      (svc.fees||[]).map(fee=>`${fee.feeType}: ${fee.commercialValue||'—'}`).join('; '),
      f.start_date, f.end_date, STATUS[f.status]?.label||f.status,
    ]);
  }));
  download([hdr,...rows], 'Service_Index');
};

function download(data, name) {
  const csv = data.map(row).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }));
  a.download = `${name}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}
