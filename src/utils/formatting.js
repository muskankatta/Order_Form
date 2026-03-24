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
