import { format, addMonths, subDays, isValid, parseISO } from 'date-fns';

export const uid = () => Math.random().toString(36).slice(2,9).toUpperCase();

export const addMonthsMinus1 = (start, months) => {
  if (!start || !months) return '';
  try {
    const d = addMonths(parseISO(start), months);
    return format(subDays(d, 1), 'yyyy-MM-dd');
  } catch { return ''; }
};

export const fmtDate  = s => { try { return s ? format(parseISO(s),'dd MMM yyyy') : '—'; } catch { return '—'; } };
export const fmtShort = s => { try { return s ? format(parseISO(s),'dd MMM') : '—'; }     catch { return '—'; } };
export const fmtNow   = () => format(new Date(), 'dd MMM yyyy, HH:mm');

export const getQtr = d => {
  if (!d) return '';
  const m = parseISO(d).getMonth() + 1;
  return m>=4&&m<=6?'Q1':m>=7&&m<=9?'Q2':m>=10?'Q3':'Q4';
};

export const getFY = d => {
  if (!d) return '';
  const dt = parseISO(d), y = dt.getFullYear(), m = dt.getMonth()+1;
  return m>=4?`FY${y+1}`:`FY${y}`;
};

export const daysUntil = isoStr => {
  if (!isoStr) return null;
  try { return Math.ceil((parseISO(isoStr) - new Date()) / 86400000); }
  catch { return null; }
};
