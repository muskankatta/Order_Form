import { cyclesInTerm } from './formatting.js';

export const calcMetrics = (services = [], termMonths) => {
  const lines = []; let total = 0;
  services.forEach(svc => {
    (svc.fees || []).forEach(fee => {
      if (fee.isLogistics) { lines.push(`Logistics Fee (${svc.name}) = As per Rate Card`); return; }
      if (fee.pricingModel === 'graduated') { lines.push(`${fee.feeType} (${svc.name}) = Variable`); return; }
      if (fee.stepUpPricing && fee.stepUpValues?.length) {
        let t = 0, parts = [];
        fee.stepUpValues.forEach(sv => { const v = parseFloat(sv.value)||0; parts.push(`${sv.label||'Period'} = ${v.toLocaleString('en-IN')}`); t += v; });
        lines.push(`${fee.feeType} (${svc.name}) — ${parts.join('; ')}`); total += t; return;
      }
      const val = parseFloat(fee.commercialValue) || 0; if (!val) return;
      if (fee.billingCycle === 'One Time') {
        lines.push(`${fee.feeType} (${svc.name}) = ${val.toLocaleString('en-IN')}`); total += val;
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
  (services).reduce((sum, svc) => sum + (svc.fees || []).reduce((s2, fee) => {
    if (fee.isLogistics || fee.pricingModel === 'graduated') return s2;
    const val = parseFloat(fee.commercialValue) || 0; if (!val) return s2;
    if (fee.billingCycle === 'One Time') return s2 + val;
    if (fee.stepUpPricing && fee.stepUpValues?.length)
      return s2 + fee.stepUpValues.reduce((a,sv) => a+(parseFloat(sv.value)||0), 0);
    return s2 + val * cyclesInTerm(fee.billingCycle, termMonths);
  }, 0), 0);
