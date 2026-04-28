import { useState, useCallback } from 'react';
import { BLANK_FORM } from '../constants/formOptions.js';
import { uid } from '../utils/dates.js';
import { calcMetrics, calcOFValue } from '../utils/calculations.js';
import { SOW_REQUIRED_TYPES } from '../constants/formOptions.js';

export function useFormWizard(initial = null) {
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState(initial ? { ...BLANK_FORM, ...initial } : { ...BLANK_FORM });
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
    const isYavi   = form.entity === 'yavi';
    const isIndia  = !isYavi && (!form.country || form.country === 'India');

    // ── Entity ───────────────────────────────────────────────────────────────
    if (!form.entity)
      e.push('Issuing entity is required (Fynd or Yavi)');

    // ── Customer basics ──────────────────────────────────────────────────────
    if (!form.customer_name)
      e.push('Customer name is required');

    // ── Tax fields — entity + country aware ──────────────────────────────────
    if (isYavi) {
      // Yavi OFs: tax_number (VAT/TRN) is mandatory, PAN/GSTIN not required
      if (!form.tax_number)
        e.push('Tax / VAT / TRN Number is required for Yavi OFs');
      else if (!/^[A-Z0-9\-]{3,30}$/.test(form.tax_number))
        e.push('Tax / VAT / TRN Number format is invalid (alphanumeric, 3–30 chars)');
    } else if (isIndia) {
      // Fynd India OFs: PAN mandatory
      if (!form.pan)
        e.push('Customer PAN is required');
      else if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(form.pan))
        e.push('PAN format is invalid (e.g. AADCB2230M)');
      // GSTIN optional but validate format if present
      if (form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z0-9]{1}$/.test(form.gstin))
        e.push('GSTIN format is invalid (e.g. 27AADCB2230M1ZT)');
    } else {
      // Fynd non-India OFs: tax_number mandatory
      if (!form.tax_number)
        e.push('Tax / VAT Number is required for international OFs');
      else if (!/^[A-Z0-9\-]{3,30}$/.test(form.tax_number))
        e.push('Tax / VAT Number format is invalid (alphanumeric, 3–30 chars)');
      // PAN optional but validate if filled
      if (form.pan && !/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(form.pan))
        e.push('PAN format is invalid (e.g. AADCB2230M)');
      // GSTIN optional but validate if filled
      if (form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z0-9]{1}$/.test(form.gstin))
        e.push('GSTIN format is invalid (e.g. 27AADCB2230M1ZT)');
    }

    // ── Sales ────────────────────────────────────────────────────────────────
    if (!form.sales_rep_email)
      e.push('Sales rep is required');

    // ── Dates ────────────────────────────────────────────────────────────────
    if (!form.start_date)
      e.push('Start date is required');

    // ── Services ─────────────────────────────────────────────────────────────
    if (!(form.services_fees||[]).length)
      e.push('At least one service is required');

    // ── SoW — only required for sale types that need it ──────────────────────
    if (form.sale_type && SOW_REQUIRED_TYPES.has(form.sale_type) && !form.sow_document)
      e.push('Signed SoW document is required for ' + form.sale_type);

    // ── Signatory ────────────────────────────────────────────────────────────
    if (!form.signatory_name)        e.push('Signatory name is required');
    if (!form.signatory_designation) e.push('Signatory designation is required');
    if (!form.signatory_email)       e.push('Signatory email is required');

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
