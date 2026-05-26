import { cyclesInTerm, cyclesInDateRange } from './formatting.js';

// Fee types that are always variable — never multiplied by billing cycles
const VARIABLE_FEE_TYPES = new Set(['Transaction Fee', 'Usage Fee']);

export const calcMetrics = (services = [], termMonths) => {
  const lines = []; let total = 0;
  services.forEach(svc => {
    (svc.fees || []).forEach(fee => {
      if (fee.isLogistics) {
        lines.push(`Logistics Fee (${svc.name}) = As per Rate Card`); return;
      }
      if (fee.pricingModel === 'graduated') {
        lines.push(`${fee.feeType} (${svc.name}) = Variable`); return;
      }
      if (VARIABLE_FEE_TYPES.has(fee.feeType) || (fee.feeType === 'Resource Fee' && fee.resourceFeeIsVariable)) {
        const display = fee.transactionFeeIsPercent
          ? `${fee.commercialValue || 0}%`
          : (fee.commercialValue || 0);
        lines.push(`${fee.feeType} (${svc.name}) = ${display} (variable)`);
        return;
      }
      if (fee.stepUpPricing && fee.stepUpValues?.length) {
        let t = 0, parts = [];
        fee.stepUpValues.forEach((sv, pi) => {
          const rate = parseFloat(sv.rate != null ? sv.rate : sv.value) || 0;
          const cycles = (sv.startDate && sv.endDate && sv.billingCycle)
            ? cyclesInDateRange(sv.startDate, sv.endDate, sv.billingCycle)
            : 1;
          const periodTotal = rate * cycles;
          const label = (sv.startDate && sv.endDate)
            ? `${sv.startDate} – ${sv.endDate} (${sv.billingCycle || '?'}, ${cycles} cycle${cycles !== 1 ? 's' : ''})`
            : (sv.label || `Period ${pi + 1}`);
          parts.push(`${label}: ${rate.toLocaleString('en-IN')} × ${cycles} = ${periodTotal.toLocaleString('en-IN')}`);
          t += periodTotal;
        });
        lines.push(`${fee.feeType} (${svc.name}) — ${parts.join('; ')}`);
        total += t; return;
      }
      const val = parseFloat(fee.commercialValue) || 0; if (!val) return;
      if (fee.billingCycle === 'One Time') {
        lines.push(`${fee.feeType} (${svc.name}) = ${val.toLocaleString('en-IN')}`);
        total += val;
      } else {
        const c = cyclesInTerm(fee.billingCycle, termMonths);
        lines.push(`${fee.feeType} (${svc.name}) = ${val.toLocaleString('en-IN')} × ${c} = ${(val*c).toLocaleString('en-IN')}`);
        total += val * c;
      }
    });
  });
  return { arrText: lines.join('\n'), committed: total };
};

export const calcOFValue = (services = [], termMonths) =>
  services.reduce((sum, svc) => sum + (svc.fees || []).reduce((s2, fee) => {
    if (fee.isLogistics || fee.pricingModel === 'graduated') return s2;
    if (VARIABLE_FEE_TYPES.has(fee.feeType) || (fee.feeType === 'Resource Fee' && fee.resourceFeeIsVariable)) return s2;
    const val = parseFloat(fee.commercialValue) || 0;
    if (fee.stepUpPricing && fee.stepUpValues?.length) {
      return s2 + fee.stepUpValues.reduce((a, sv) => {
        const rate = parseFloat(sv.rate != null ? sv.rate : sv.value) || 0;
        const cycles = (sv.startDate && sv.endDate && sv.billingCycle)
          ? cyclesInDateRange(sv.startDate, sv.endDate, sv.billingCycle)
          : 1;
        return a + rate * cycles;
      }, 0);
    }
    if (!val) return s2;
    if (fee.billingCycle === 'One Time') return s2 + val;
    return s2 + val * cyclesInTerm(fee.billingCycle, termMonths);
  }, 0), 0);
