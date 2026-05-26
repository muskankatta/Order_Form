import { CURRENCIES } from '../constants/formOptions.js';
export const getSym   = code => (CURRENCIES.find(c => c.code === code) || { sym: code }).sym;
export const fmtMoney = (n, code='INR') => {
  if (!n && n !== 0) return '—';
  return getSym(code) + Number(n).toLocaleString('en-IN');
};
export const cyclesInTerm = (bc, months) => {
  const m = { Monthly:1, Quarterly:3, 'Bi-Annually':6, Annually:12, 'One Time':0 }[bc] || 1;
  return m === 0 ? 1 : Math.floor(months / m);
};

/**
 * Calculates how many complete billing cycles fit within a date range.
 * end date is inclusive (as produced by addMonthsMinus1), so we add 1 day
 * to convert to exclusive before computing elapsed months.
 */
export const cyclesInDateRange = (startDate, endDate, billingCycle) => {
  if (!startDate || !endDate) return 0;
  const s = new Date(startDate);
  const e = new Date(endDate);
  // +1 day: converts inclusive end date → exclusive
  const eExcl = new Date(e.getTime() + 86400000);
  const totalMonths =
    (eExcl.getFullYear() - s.getFullYear()) * 12 +
    (eExcl.getMonth() - s.getMonth());
  if (totalMonths <= 0) return 0;
  const m = { Monthly:1, Quarterly:3, 'Bi-Annually':6, Annually:12 }[billingCycle];
  if (!m) return 1; // One Time or unknown → 1 cycle
  return Math.max(1, Math.floor(totalMonths / m));
};
