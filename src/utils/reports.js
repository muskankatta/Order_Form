/**
 * Fynd OF Platform — Excel Report Generator
 * Uses SheetJS (xlsx) — runs entirely in browser.
 * Install: npm install xlsx
 */
import * as XLSX from 'xlsx';

const TEAL   = '00C3B5';
const NAVY   = '1B2B4B';
const LIGHT  = 'F0FDFA';
const GREY   = 'F1F5F9';
const WHITE  = 'FFFFFF';
const AMBER  = 'FFFBEB';

// ── Helpers ──────────────────────────────────────────────────────────────────
const TO_USD = { USD:v=>v, INR:v=>v/91, AED:v=>v/3.6725, MYR:v=>v/4.30, IDR:v=>v/16950, GBP:v=>v/0.80, EUR:v=>v/0.90, SGD:v=>v/1.35, SAR:v=>v/3.75, AUD:v=>v/1.55 };
const toUSD  = (amt, cur) => (TO_USD[cur] || (v=>v))(Number(amt||0));

function fmtINR(v)  { return '₹' + Math.round(Number(v||0)).toLocaleString('en-IN'); }
function fmtUSD(v)  { return '$' + Math.round(Number(v||0)).toLocaleString('en-US'); }
function fmtPct(v)  { return (Number(v||0)).toFixed(1) + '%'; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : '—'; }

function now() {
  return new Date().toLocaleString('en-IN', {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
}

function getIncentiveRate(pct) {
  if (pct >= 180) return 13;
  if (pct >= 140) return 11;
  if (pct >= 100) return 9;
  if (pct >= 75)  return 7;
  if (pct >= 50)  return 5;
  if (pct >= 25)  return 3;
  return 0;
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function cellStyle(opts = {}) {
  return {
    font:      { name:'Arial', sz: opts.sz||10, bold:!!opts.bold, color: opts.fontColor ? {rgb:opts.fontColor} : {rgb:'000000'} },
    fill:      opts.fill ? { patternType:'solid', fgColor:{rgb:opts.fill} } : undefined,
    alignment: { horizontal: opts.align||'left', vertical:'center', wrapText:!!opts.wrap },
    border:    opts.border ? {
      top:{style:'thin',color:{rgb:'CBD5E1'}}, bottom:{style:'thin',color:{rgb:'CBD5E1'}},
      left:{style:'thin',color:{rgb:'CBD5E1'}}, right:{style:'thin',color:{rgb:'CBD5E1'}},
    } : undefined,
  };
}

function applyStyle(ws, cellRef, style) {
  if (!ws[cellRef]) ws[cellRef] = { v:'', t:'s' };
  ws[cellRef].s = style;
}

// ── Write a branded header block ─────────────────────────────────────────────
function writeBrandHeader(ws, title, numCols, startRow = 1) {
  const endCol = XLSX.utils.encode_col(numCols - 1);

  // Row 1: Fynd
  ws[`A${startRow}`] = { v:'Fynd', t:'s', s: cellStyle({bold:true, sz:14, fontColor:NAVY, fill:WHITE}) };
  ws['!merges'] = ws['!merges'] || [];
  ws['!merges'].push({ s:{r:startRow-1,c:0}, e:{r:startRow-1,c:numCols-1} });

  // Row 2: Report title
  ws[`A${startRow+1}`] = { v:title, t:'s', s: cellStyle({bold:true, sz:12, fontColor:WHITE, fill:NAVY, align:'center'}) };
  ws['!merges'].push({ s:{r:startRow,c:0}, e:{r:startRow,c:numCols-1} });

  // Row 3: Disclaimer
  ws[`A${startRow+2}`] = { v:'CONFIDENTIAL — For Internal Stakeholders Only. Do not distribute externally.', t:'s', s: cellStyle({sz:9, fontColor:'B45309', fill:AMBER, align:'center'}) };
  ws['!merges'].push({ s:{r:startRow+1,c:0}, e:{r:startRow+1,c:numCols-1} });

  // Row 4: Generated on
  ws[`A${startRow+3}`] = { v:`Generated: ${now()}`, t:'s', s: cellStyle({sz:9, fontColor:'64748B', align:'right'}) };
  ws['!merges'].push({ s:{r:startRow+2,c:0}, e:{r:startRow+2,c:numCols-1} });

  // Row 5: spacer
  ws[`A${startRow+4}`] = { v:'', t:'s' };
  ws['!merges'].push({ s:{r:startRow+3,c:0}, e:{r:startRow+3,c:numCols-1} });

  return startRow + 5; // first data row
}

// ── Write array of rows to sheet ─────────────────────────────────────────────
function writeRows(ws, rows, startRow) {
  rows.forEach((row, ri) => {
    row.forEach((cell, ci) => {
      const ref = XLSX.utils.encode_cell({r: startRow + ri - 1, c: ci});
      if (typeof cell === 'object' && cell !== null && 'v' in cell) {
        ws[ref] = cell;
      } else {
        ws[ref] = { v: cell ?? '', t: typeof cell === 'number' ? 'n' : 's' };
      }
    });
  });
  return startRow + rows.length;
}

function headerRow(cols) {
  return cols.map(c => ({ v:c, t:'s', s: cellStyle({bold:true, fontColor:WHITE, fill:NAVY, border:true}) }));
}

function dataRow(vals, isAlt = false) {
  return vals.map(v => ({ v: v ?? '—', t: typeof v === 'number' ? 'n' : 's', s: cellStyle({fill: isAlt ? GREY : WHITE, border:true}) }));
}

function sectionHeader(label, numCols) {
  const row = [{ v:label, t:'s', s: cellStyle({bold:true, fontColor:NAVY, fill:LIGHT, sz:11}) }];
  for (let i=1;i<numCols;i++) row.push({ v:'', t:'s', s: cellStyle({fill:LIGHT}) });
  return row;
}

function totalsRow(vals, numCols) {
  return vals.map((v,i) => ({ v: v ?? '', t: typeof v === 'number' ? 'n' : 's', s: cellStyle({bold:true, fill:TEAL+'33', fontColor:NAVY, border:true}) }));
}

// ── Set column widths ─────────────────────────────────────────────────────────
function setColWidths(ws, widths) {
  ws['!cols'] = widths.map(w => ({wch:w}));
}

function setRowHeights(ws, heights) {
  ws['!rows'] = heights.map(h => (h ? {hpt:h} : {}));
}

// ── Trigger download ──────────────────────────────────────────────────────────
function downloadWorkbook(wb, filename) {
  const buf = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  const blob = new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 1. SIGNED OFs REPORT ─────────────────────────────────────────────────────
export function generateSignedOFReport(signedForms) {
  const wb = XLSX.utils.book_new();
  const COLS = 10;

  // ── Summary sheet ──
  const ws1 = { '!ref': `A1:J100` };
  let row = writeBrandHeader(ws1, 'Signed Order Forms — Summary Report', COLS);

  // KPI block
  const totalINR = signedForms.filter(f=>f.sales_team==='India').reduce((s,f)=>s+Number(f.committed_revenue||0),0);
  const totalUSD = signedForms.filter(f=>f.sales_team!=='India').reduce((s,f)=>s+toUSD(f.committed_revenue,f.committed_currency||'USD'),0);

  const kpis = [
    ['Total Signed OFs', signedForms.length],
    ['Committed Revenue — India (INR)', fmtINR(totalINR)],
    ['Committed Revenue — Global + AI/SaaS (USD)', fmtUSD(totalUSD)],
  ];
  kpis.forEach(([label, val], i) => {
    ws1[`A${row+i}`] = { v:label, t:'s', s: cellStyle({bold:true, fill:GREY}) };
    ws1[`B${row+i}`] = { v:val,   t:'s', s: cellStyle({bold:true, fontColor:NAVY}) };
    for (let c=2;c<COLS;c++) ws1[XLSX.utils.encode_cell({r:row+i-1,c})] = {v:'',t:'s',s:cellStyle({fill:GREY})};
    if (!ws1['!merges']) ws1['!merges'] = [];
    ws1['!merges'].push({s:{r:row+i-1,c:1},e:{r:row+i-1,c:COLS-1}});
  });
  row += kpis.length + 1;

  // By team
  row = writeRows(ws1, [sectionHeader('Revenue by Team', COLS)], row);
  row = writeRows(ws1, [headerRow(['Team','OF Count','Revenue (INR)','Revenue (USD)'])], row);
  const teams = ['India','Global','AI/SaaS'];
  teams.forEach((team, i) => {
    const tForms = signedForms.filter(f=>f.sales_team===team);
    const tINR = team==='India' ? tForms.reduce((s,f)=>s+Number(f.committed_revenue||0),0) : 0;
    const tUSD = team!=='India' ? tForms.reduce((s,f)=>s+toUSD(f.committed_revenue,f.committed_currency||'USD'),0) : 0;
    row = writeRows(ws1, [dataRow([team, tForms.length, team==='India'?fmtINR(tINR):'—', team!=='India'?fmtUSD(tUSD):'—'], i%2===1)], row);
  });
  row++;

  // By quarter
  const qtrMap = {};
  signedForms.forEach(f => {
    if (!f.signed_date) return;
    const d = new Date(f.signed_date), m = d.getMonth()+1, y = d.getFullYear();
    let q, fy;
    if(m>=4&&m<=6){q='Q1';fy=y+1;}else if(m>=7&&m<=9){q='Q2';fy=y+1;}else if(m>=10&&m<=12){q='Q3';fy=y+1;}else{q='Q4';fy=y;}
    const key = `${q} FY${String(fy).slice(2)}`;
    const sortKey = `${fy}${q}`;
    if (!qtrMap[sortKey]) qtrMap[sortKey] = {label:key, count:0, inr:0, usd:0};
    qtrMap[sortKey].count++;
    if(f.sales_team==='India') qtrMap[sortKey].inr += Number(f.committed_revenue||0);
    else qtrMap[sortKey].usd += toUSD(f.committed_revenue, f.committed_currency||'USD');
  });
  row = writeRows(ws1, [sectionHeader('Revenue by Quarter', COLS)], row);
  row = writeRows(ws1, [headerRow(['Quarter','OF Count','Revenue (INR)','Revenue (USD)'])], row);
  Object.entries(qtrMap).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([,v],i) => {
    row = writeRows(ws1, [dataRow([v.label, v.count, v.inr?fmtINR(v.inr):'—', v.usd?fmtUSD(v.usd):'—'], i%2===1)], row);
  });

  setColWidths(ws1, [30,15,25,25,15,15,15,15,15,15]);
  ws1['!ref'] = `A1:J${row+10}`;
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // ── Detail sheet ──
  const ws2 = { '!ref': `A1:L200` };
  let row2 = writeBrandHeader(ws2, 'Signed Order Forms — Detail', 12);
  const headers2 = ['OF Number','Customer','Brand','Team','Sales Rep','Services','Currency','Committed Revenue','Signed Date','Quarter','Region','Signed OF Link'];
  row2 = writeRows(ws2, [headerRow(headers2)], row2);
  signedForms.forEach((f,i) => {
    const d = f.signed_date ? new Date(f.signed_date) : null;
    const m = d ? d.getMonth()+1 : 0, y = d ? d.getFullYear() : 0;
    let qtr = '—';
    if(d){if(m>=4&&m<=6)qtr=`Q1 FY${String(y+1).slice(2)}`;else if(m>=7&&m<=9)qtr=`Q2 FY${String(y+1).slice(2)}`;else if(m>=10&&m<=12)qtr=`Q3 FY${String(y+1).slice(2)}`;else qtr=`Q4 FY${String(y).slice(2)}`;}
    const region = f.region || (f.sales_team==='Global' ? '—' : f.sales_team);
    row2 = writeRows(ws2, [dataRow([
      f.of_number||'—', f.customer_name||'—', f.brand_name||'—', f.sales_team||'—',
      f.sales_rep_name||'—', (f.services_fees||[]).map(s=>s.name).filter(Boolean).join(', ')||'—',
      f.committed_currency||'INR', Number(f.committed_revenue||0), fmtDate(f.signed_date),
      qtr, region, f.signed_of_link||'—',
    ], i%2===1)], row2);
  });
  // Totals
  row2 = writeRows(ws2, [totalsRow(['TOTAL', signedForms.length, '', '', '', '', 'INR', fmtINR(totalINR), '', '', '', ''])], row2);
  row2 = writeRows(ws2, [totalsRow(['', '', '', '', '', '', 'USD', fmtUSD(totalUSD), '', '', '', ''])], row2);

  setColWidths(ws2, [14,28,20,10,20,30,10,18,14,12,14,40]);
  ws2['!ref'] = `A1:L${row2+5}`;
  XLSX.utils.book_append_sheet(wb, ws2, 'Detail');

  downloadWorkbook(wb, `Fynd_Signed_OFs_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ── 2. UNSIGNED OFs REPORT ────────────────────────────────────────────────────
export function generateUnsignedOFReport(unsignedForms) {
  const wb = XLSX.utils.book_new();
  const COLS = 9;

  // Summary sheet
  const ws1 = {};
  let row = writeBrandHeader(ws1, 'Unsigned Order Forms — Summary Report', COLS);

  const totalINR = unsignedForms.filter(f=>f.sales_team==='India').reduce((s,f)=>s+Number(f.committed_revenue||0),0);
  const totalUSD = unsignedForms.filter(f=>f.sales_team!=='India').reduce((s,f)=>s+toUSD(f.committed_revenue,f.committed_currency||'USD'),0);
  const overdue  = unsignedForms.filter(f=>{const d=f.approved_at||f.submitted_at;return d&&Math.floor((new Date()-new Date(d))/86400000)>=30;}).length;

  const kpis = [
    ['Total Unsigned OFs', unsignedForms.length],
    ['Overdue (≥30 days)', overdue],
    ['Committed Revenue — India (INR)', fmtINR(totalINR)],
    ['Committed Revenue — Global + AI/SaaS (USD)', fmtUSD(totalUSD)],
  ];
  kpis.forEach(([label, val], i) => {
    ws1[`A${row+i}`] = { v:label, t:'s', s: cellStyle({bold:true, fill:GREY}) };
    ws1[`B${row+i}`] = { v:val,   t:'s', s: cellStyle({bold:true, fontColor:NAVY}) };
    for(let c=2;c<COLS;c++) ws1[XLSX.utils.encode_cell({r:row+i-1,c})] = {v:'',t:'s',s:cellStyle({fill:GREY})};
    ws1['!merges'] = ws1['!merges']||[];
    ws1['!merges'].push({s:{r:row+i-1,c:1},e:{r:row+i-1,c:COLS-1}});
  });
  row += kpis.length + 1;

  // Aging buckets
  row = writeRows(ws1, [sectionHeader('Aging Analysis', COLS)], row);
  row = writeRows(ws1, [headerRow(['Aging Bucket','Count','% of Total'])], row);
  const buckets = [['<7 days',f=>Math.floor((new Date()-new Date(f.approved_at||f.submitted_at||new Date()))/86400000)<7],['7–14 days',f=>{const d=Math.floor((new Date()-new Date(f.approved_at||f.submitted_at||new Date()))/86400000);return d>=7&&d<14;}],['14–30 days',f=>{const d=Math.floor((new Date()-new Date(f.approved_at||f.submitted_at||new Date()))/86400000);return d>=14&&d<30;}],['≥30 days (Overdue)',f=>Math.floor((new Date()-new Date(f.approved_at||f.submitted_at||new Date()))/86400000)>=30]];
  buckets.forEach(([label,fn],i)=>{
    const cnt = unsignedForms.filter(f=>(f.approved_at||f.submitted_at)&&fn(f)).length;
    row = writeRows(ws1,[dataRow([label,cnt,unsignedForms.length?fmtPct(cnt/unsignedForms.length*100):'0.0%'],i%2===1)],row);
  });

  setColWidths(ws1, [30,12,25,20,20,15,15,15,15]);
  ws1['!ref'] = `A1:I${row+10}`;
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // Detail sheet
  const ws2 = {};
  let row2 = writeBrandHeader(ws2, 'Unsigned Order Forms — Detail', 9);
  row2 = writeRows(ws2, [headerRow(['OF Number','Customer','Brand','Team','Sales Rep','Currency','Committed Revenue','Finance Approved On','Days Pending'])], row2);
  unsignedForms.forEach((f,i)=>{
    const sentDate = f.approved_at||f.submitted_at;
    const days = sentDate ? Math.floor((new Date()-new Date(sentDate))/86400000) : '—';
    row2 = writeRows(ws2,[dataRow([f.of_number||'—',f.customer_name||'—',f.brand_name||'—',f.sales_team||'—',f.sales_rep_name||'—',f.committed_currency||'INR',Number(f.committed_revenue||0),fmtDate(sentDate?.split('T')[0]),days],i%2===1)],row2);
  });
  row2 = writeRows(ws2,[totalsRow(['TOTAL',unsignedForms.length,'','','','INR',fmtINR(totalINR),'',''])],row2);
  row2 = writeRows(ws2,[totalsRow(['','','','','','USD',fmtUSD(totalUSD),'',''])],row2);

  setColWidths(ws2, [14,28,20,10,20,10,18,18,12]);
  ws2['!ref'] = `A1:I${row2+5}`;
  XLSX.utils.book_append_sheet(wb, ws2, 'Detail');

  downloadWorkbook(wb, `Fynd_Unsigned_OFs_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ── 3. REPOSITORY REPORT ─────────────────────────────────────────────────────
export function generateRepositoryReport(filteredForms) {
  const wb = XLSX.utils.book_new();
  const COLS = 12;

  const ws = {};
  let row = writeBrandHeader(ws, 'Repository — Order Forms Report', COLS);

  const totalINR = filteredForms.filter(f=>f.sales_team==='India').reduce((s,f)=>s+Number(f.committed_revenue||0),0);
  const totalUSD = filteredForms.filter(f=>f.sales_team!=='India').reduce((s,f)=>s+toUSD(f.committed_revenue,f.committed_currency||'USD'),0);

  // Summary row
  const kpis = [['Total OFs',filteredForms.length],['Revenue — India (INR)',fmtINR(totalINR)],['Revenue — Global + AI/SaaS (USD)',fmtUSD(totalUSD)]];
  kpis.forEach(([label,val],i)=>{
    ws[`A${row+i}`]={v:label,t:'s',s:cellStyle({bold:true,fill:GREY})};
    ws[`B${row+i}`]={v:val,t:'s',s:cellStyle({bold:true,fontColor:NAVY})};
    for(let c=2;c<COLS;c++) ws[XLSX.utils.encode_cell({r:row+i-1,c})]={v:'',t:'s',s:cellStyle({fill:GREY})};
    ws['!merges']=ws['!merges']||[];
    ws['!merges'].push({s:{r:row+i-1,c:1},e:{r:row+i-1,c:COLS-1}});
  });
  row += kpis.length + 1;

  // Detail
  row = writeRows(ws, [headerRow(['OF Number','Customer','Brand','Status','Team','Sales Rep','Sale Type','Channel','Services','Currency','Committed Revenue','Start Date','End Date','Signed Date'])], row);
  filteredForms.forEach((f,i)=>{
    row = writeRows(ws,[dataRow([
      f.of_number||'—',f.customer_name||'—',f.brand_name||'—',
      (f.status||'—').replace(/_/g,' '),f.sales_team||'—',f.sales_rep_name||'—',
      f.sale_type||'—',f.lead_type||'—',
      (f.services_fees||[]).map(s=>s.name).filter(Boolean).join(', ')||'—',
      f.committed_currency||'INR',Number(f.committed_revenue||0),
      f.start_date||'—',f.end_date||'—',f.signed_date||'—',
    ],i%2===1)],row);
  });
  row=writeRows(ws,[totalsRow(['TOTAL',filteredForms.length,'','','','','','','','INR',fmtINR(totalINR),'','',''])],row);
  row=writeRows(ws,[totalsRow(['','','','','','','','','','USD',fmtUSD(totalUSD),'','',''])],row);

  setColWidths(ws, [14,28,20,14,10,20,16,12,30,10,18,12,12,12]);
  ws['!ref'] = `A1:N${row+5}`;
  XLSX.utils.book_append_sheet(wb, ws, 'Repository');

  downloadWorkbook(wb, `Fynd_Repository_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ── 4. DASHBOARD REPORT ───────────────────────────────────────────────────────
export function generateDashboardReport(forms, repData, teamFilter) {
  const wb = XLSX.utils.book_new();

  // ── Overview sheet ──
  const ws1 = {};
  const COLS = 6;
  let row = writeBrandHeader(ws1, `Dashboard Report${teamFilter && teamFilter!=='all' ? ' — '+teamFilter : ''}`, COLS);

  const signed    = forms.filter(f=>f.status==='signed');
  const approved  = forms.filter(f=>f.status==='approved');
  const submitted = forms.filter(f=>f.status==='submitted');
  const totalINR  = signed.filter(f=>f.sales_team==='India').reduce((s,f)=>s+Number(f.committed_revenue||0),0);
  const totalUSD  = signed.filter(f=>f.sales_team!=='India').reduce((s,f)=>s+toUSD(f.committed_revenue,f.committed_currency||'USD'),0);
  const today     = new Date(); today.setHours(0,0,0,0);
  const active    = signed.filter(f=>{const s=f.start_date?new Date(f.start_date):null,e=f.end_date?new Date(f.end_date):null;return s&&e&&today>=s&&today<=e;});

  row = writeRows(ws1, [sectionHeader('Platform Overview', COLS)], row);
  const stats = [
    ['Total OFs',forms.length],['Signed OFs',signed.length],['Approved (Unsigned)',approved.length],
    ['Pending RevOps',submitted.length],['Active Contracts',active.length],
    ['Revenue — India INR',fmtINR(totalINR)],['Revenue — Global+AI/SaaS USD',fmtUSD(totalUSD)],
  ];
  stats.forEach(([label,val],i)=>{
    ws1[`A${row+i}`]={v:label,t:'s',s:cellStyle({bold:i>=5,fill:GREY})};
    ws1[`B${row+i}`]={v:val,t:'s',s:cellStyle({bold:true,fontColor:NAVY})};
    for(let c=2;c<COLS;c++) ws1[XLSX.utils.encode_cell({r:row+i-1,c})]={v:'',t:'s',s:cellStyle({fill:GREY})};
    ws1['!merges']=ws1['!merges']||[];
    ws1['!merges'].push({s:{r:row+i-1,c:1},e:{r:row+i-1,c:COLS-1}});
  });
  row += stats.length + 1;

  // By status
  row = writeRows(ws1, [sectionHeader('OFs by Status', COLS)], row);
  row = writeRows(ws1, [headerRow(['Status','Count','% of Total'])], row);
  const statusMap = {};
  forms.forEach(f=>{statusMap[f.status||'unknown']=(statusMap[f.status||'unknown']||0)+1;});
  Object.entries(statusMap).sort((a,b)=>b[1]-a[1]).forEach(([s,cnt],i)=>{
    row=writeRows(ws1,[dataRow([s.replace(/_/g,' '),cnt,fmtPct(cnt/forms.length*100)],i%2===1)],row);
  });
  row++;

  // By team
  row = writeRows(ws1, [sectionHeader('Signed Revenue by Team', COLS)], row);
  row = writeRows(ws1, [headerRow(['Team','Signed OFs','Revenue (INR)','Revenue (USD)'])], row);
  ['India','Global','AI/SaaS'].forEach((team,i)=>{
    const tf=signed.filter(f=>f.sales_team===team);
    const inr=team==='India'?tf.reduce((s,f)=>s+Number(f.committed_revenue||0),0):0;
    const usd=team!=='India'?tf.reduce((s,f)=>s+toUSD(f.committed_revenue,f.committed_currency||'USD'),0):0;
    row=writeRows(ws1,[dataRow([team,tf.length,team==='India'?fmtINR(inr):'—',team!=='India'?fmtUSD(usd):'—'],i%2===1)],row);
  });

  setColWidths(ws1, [30,15,20,20,15,15]);
  ws1['!ref']=`A1:F${row+10}`;
  XLSX.utils.book_append_sheet(wb, ws1, 'Overview');

  // ── Rep Leaderboard sheet ──
  if (repData && repData.length > 0) {
    const ws2 = {};
    let row2 = writeBrandHeader(ws2, 'Rep Performance Leaderboard', 8);
    row2 = writeRows(ws2,[headerRow(['#','Sales Rep','Team','Target','Achieved','Achievement %','Incentive Rate','Eligible Incentive'])],row2);
    repData.forEach((r,i)=>{
      const pct = r.pct||0;
      const iRate = getIncentiveRate(pct);
      const iAmt = (r.achieved||0) * iRate / 100;
      const cur = r.targetCurrency==='INR'?'₹':'$';
      row2=writeRows(ws2,[dataRow([
        i+1, r.name, r.team+(r.region?' · '+r.region:''),
        cur+Math.round(r.target||0).toLocaleString(),
        cur+Math.round(r.achieved||0).toLocaleString(),
        fmtPct(pct), iRate+'%',
        cur+Math.round(iAmt).toLocaleString(),
      ],i%2===1)],row2);
    });
    setColWidths(ws2,[5,24,18,16,16,14,14,16]);
    ws2['!ref']=`A1:H${row2+5}`;
    XLSX.utils.book_append_sheet(wb, ws2, 'Leaderboard');
  }

  downloadWorkbook(wb, `Fynd_Dashboard_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ── 5. SALES TARGET REPORT ────────────────────────────────────────────────────
export function generateSalesTargetReport(repData, signedForms, fy) {
  const wb = XLSX.utils.book_new();

  // ── Summary sheet ──
  const ws1 = {};
  let row = writeBrandHeader(ws1, `Sales Target Achievement — ${fy}`, 9);

  const achieved   = repData.filter(r=>r.pct>=100).length;
  const onTrack    = repData.filter(r=>r.pct>=75&&r.pct<100).length;
  const behind     = repData.filter(r=>r.pct<50).length;

  const kpis=[['FY',fy],['Total Reps Tracked',repData.length],['Target Achieved (≥100%)',achieved],['On Track (75–99%)',onTrack],['Behind (<50%)',behind]];
  kpis.forEach(([label,val],i)=>{
    ws1[`A${row+i}`]={v:label,t:'s',s:cellStyle({bold:true,fill:GREY})};
    ws1[`B${row+i}`]={v:val,t:'s',s:cellStyle({bold:true,fontColor:NAVY})};
    for(let c=2;c<9;c++) ws1[XLSX.utils.encode_cell({r:row+i-1,c})]={v:'',t:'s',s:cellStyle({fill:GREY})};
    ws1['!merges']=ws1['!merges']||[];
    ws1['!merges'].push({s:{r:row+i-1,c:1},e:{r:row+i-1,c:8}});
  });
  row += kpis.length + 1;

  row=writeRows(ws1,[headerRow(['#','Sales Rep','Team / Region','Role','Target','Achieved','Achievement %','Incentive Rate','Eligible Incentive'])],row);
  repData.forEach((r,i)=>{
    const iRate=getIncentiveRate(r.pct||0);
    const iAmt=(r.achieved||0)*iRate/100;
    const cur=r.targetCurrency==='INR'?'₹':'$';
    row=writeRows(ws1,[dataRow([
      i+1, r.name, r.team+(r.region?' · '+r.region:''), r.role||'—',
      cur+Math.round(r.target||0).toLocaleString(),
      cur+Math.round(r.achieved||0).toLocaleString(),
      fmtPct(r.pct||0), iRate+'%',
      cur+Math.round(iAmt).toLocaleString(),
    ],i%2===1)],row);
  });

  setColWidths(ws1,[5,24,18,16,16,16,14,14,16]);
  ws1['!ref']=`A1:I${row+10}`;
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // ── Drill-down sheet — all OFs grouped by rep ──
  const ws2 = {};
  let row2 = writeBrandHeader(ws2, `Signed OFs — Rep Drill-Down — ${fy}`, 9);

  repData.forEach(r => {
    const myOFs = signedForms.filter(f=>f.sales_rep_email===r.email);
    const iRate = getIncentiveRate(r.pct||0);
    const iAmt  = (r.achieved||0)*iRate/100;
    const cur   = r.targetCurrency==='INR'?'₹':'$';

    // Rep section header
    row2=writeRows(ws2,[sectionHeader(`${r.name}  |  ${r.team}${r.region?' · '+r.region:''}  |  Target: ${cur}${Math.round(r.target||0).toLocaleString()}  |  Achieved: ${cur}${Math.round(r.achieved||0).toLocaleString()}  |  ${fmtPct(r.pct||0)}  |  Incentive: ${cur}${Math.round(iAmt).toLocaleString()}`, 9)],row2);
    ws2['!merges']=ws2['!merges']||[];
    ws2['!merges'].push({s:{r:row2-2,c:0},e:{r:row2-2,c:8}});

    if (myOFs.length === 0) {
      row2=writeRows(ws2,[dataRow(['No signed OFs in this period','','','','','','','',''])],row2);
    } else {
      row2=writeRows(ws2,[headerRow(['OF Number','Customer','Services','Currency','Committed Revenue',`Converted (${r.targetCurrency})`, 'Signed Date','Sale Type','Channel'])],row2);
      let repTotal = 0;
      myOFs.forEach((f,i)=>{
        const usd = toUSD(Number(f.committed_revenue||0), f.committed_currency||'INR');
        const converted = r.targetCurrency==='INR' ? usd*91 : usd;
        repTotal += converted;
        row2=writeRows(ws2,[dataRow([
          f.of_number||'—', f.customer_name||'—',
          (f.services_fees||[]).map(s=>s.name).filter(Boolean).join(', ')||'—',
          f.committed_currency||'INR', Number(f.committed_revenue||0),
          Math.round(converted), fmtDate(f.signed_date),
          f.sale_type||'—', f.lead_type||'—',
        ],i%2===1)],row2);
      });
      row2=writeRows(ws2,[totalsRow([`Subtotal (${myOFs.length} OFs)`, '', '', '', '', Math.round(repTotal), '', '', ''])],row2);
    }
    row2++; // blank spacer between reps
  });

  setColWidths(ws2,[14,28,30,10,18,18,14,16,12]);
  ws2['!ref']=`A1:I${row2+5}`;
  XLSX.utils.book_append_sheet(wb, ws2, 'Drill-Down by Rep');

  downloadWorkbook(wb, `Fynd_Sales_Targets_${fy}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
