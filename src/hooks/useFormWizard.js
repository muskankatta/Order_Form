import { useState, useCallback } from 'react';
import { BLANK_FORM } from '../constants/formOptions.js';
import { uid } from '../utils/dates.js';
import { calcMetrics, calcOFValue } from '../utils/calculations.js';

export function useFormWizard(initial = null) {
  const [step, setStep]   = useState(0);
  const [form, setForm]   = useState(initial ? { ...BLANK_FORM, ...initial } : { ...BLANK_FORM });
  const [errors, setErrors] = useState([]);

  const set = useCallback((key, value) =>
    setForm(prev => ({ ...prev, [key]: value })), []);

  const setMany = useCallback(patch =>
    setForm(prev => ({ ...prev, ...patch })), []);

  const recompute = useCallback(() => {
    setForm(prev => {
      const tm = parseInt(prev.of_term_months) || 12;
      const { arrText, committed } = calcMetrics(prev.services_fees, tm);
      const ofv = calcOFValue(prev.services_fees, tm);
      return { ...prev, arr_text: arrText, committed_revenue: committed || '', of_value: ofv || '' };
    });
  }, []);

  const addService = useCallback(() => {
    setForm(prev => ({
      ...prev,
      services_fees: [...(prev.services_fees||[]), { id: uid(), name:'', fees:[newFee()] }],
    }));
  }, []);

  const updateService = useCallback((idx, svc) => {
    setForm(prev => {
      const sf = [...(prev.services_fees||[])];
      sf[idx] = svc;
      return { ...prev, services_fees: sf };
    });
  }, []);

  const removeService = useCallback(idx => {
    setForm(prev => ({
      ...prev,
      services_fees: (prev.services_fees||[]).filter((_,i) => i !== idx),
    }));
  }, []);

  const validate = useCallback(() => {
    const e = [];
    if (!form.customer_name)   e.push('Customer name is required');
    if (!form.pan)             e.push('Customer PAN is required');
    if (!form.sales_rep_email) e.push('Sales rep is required');
    if (!form.start_date)      e.push('Start date is required');
    if (!form.signatory_name)  e.push('Signatory name is required');
    if (!form.signatory_designation) e.push('Signatory designation is required');
    if (!form.signatory_email) e.push('Signatory email is required');
    if (!(form.services_fees||[]).length) e.push('At least one service is required');
    if (!form.sow_document)    e.push('Signed SoW document is required');
    if (form.pan && !/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(form.pan))
  e.push('PAN format is invalid (e.g. AADCB2230M)');
if (form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z0-9]{1}$/.test(form.gstin))
  e.push('GSTIN format is invalid (e.g. 27AADCB2230M1ZT)');
    setErrors(e);
    return e.length === 0;
  }, [form]);

  return { step, setStep, form, setForm, set, setMany, recompute,
           addService, updateService, removeService, validate, errors };
}

export const newFee = () => ({
  id: uid(), feeType:'', billingCycle:'', billingCycleLocked:false,
  pricingModel:'flat', commercialValue:'', isLogistics:false,
  logisticsRateCard:'https://drive.google.com/file/d/1MiLGcxC0xZxbWsCO2GyhSQ-VecI8uO8g/view?usp=sharing',
  inclusions:'', unitMetric:'', paymentTrigger:'',
  usageCycleDiffers:false, usageCycle:'',
  stepUpPricing:false, stepUpValues:[],
  slabs:[{ id:uid(), from:'0', to:'', rate:'', rateType:'₹ per unit' }],
});
