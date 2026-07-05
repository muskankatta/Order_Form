import { useState, useCallback } from 'react';
import { BLANK_FORM } from '../constants/formOptions.js';
import { uid } from '../utils/dates.js';
import { calcMetrics, calcOFValue } from '../utils/calculations.js';
import { SOW_REQUIRED_TYPES, SOW_REFERENCE_TYPES, isSkuService } from '../constants/formOptions.js';
import { isVatEntity } from '../constants/entities.js';

function isValidUrl(v) {
  if (!v) return false;
  try {
    const url = new URL(String(v).trim());
    return /^https?:$/.test(url.protocol);
  } catch {
    return false;
  }
}

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
    const vatEntity = isVatEntity(form.entity);   // Yavi or Fynd UK → single tax_number
    const isIndia   = !vatEntity && (!form.country || form.country === 'India');
    const isGlobal  = form.sales_team === 'Global';
    const isGaaS   = (form.services_fees||[]).some(s => isSkuService(s.name));

    // ── Entity ───────────────────────────────────────────────────────────────
    if (!form.entity)
      e.push('Issuing entity is required');

    // ── Customer basics ──────────────────────────────────────────────────────
    if (!form.customer_name)
      e.push('Customer name is required');
    if (!form.brand_name)
      e.push('Brand / trade name is required');
    if (!form.billing_address)
      e.push('Customer billing address is required');
    if (!vatEntity && !form.country)
      e.push('Country is required');

    // ── Tax fields — entity + country aware ──────────────────────────────────
    if (vatEntity) {
      if (!form.tax_number)
        e.push('Tax / VAT Number is required for this entity');
      else if (!/^[A-Z0-9\-]{3,30}$/.test(form.tax_number))
        e.push('Tax / VAT Number format is invalid (alphanumeric, 3–30 chars)');
    } else if (isIndia) {
      if (!form.pan)
        e.push('Customer PAN is required');
      else if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(form.pan))
        e.push('PAN format is invalid (e.g. AADCB2230M)');
      if (form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z0-9]{1}$/.test(form.gstin))
        e.push('GSTIN format is invalid (e.g. 27AADCB2230M1ZT)');
    } else {
      if (!form.tax_number)
        e.push('Tax / VAT Number is required for international OFs');
      else if (!/^[A-Z0-9\-]{3,30}$/.test(form.tax_number))
        e.push('Tax / VAT Number format is invalid (alphanumeric, 3–30 chars)');
      if (form.pan && !/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(form.pan))
        e.push('PAN format is invalid (e.g. AADCB2230M)');
      if (form.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}Z[A-Z0-9]{1}$/.test(form.gstin))
        e.push('GSTIN format is invalid (e.g. 27AADCB2230M1ZT)');
    }

    // ── Sales information ────────────────────────────────────────────────────
    if (!form.sales_team)
      e.push('Sales team is required');
    if (!form.sales_rep_email)
      e.push('Sales rep is required');
    if (isGlobal && !form.region)
      e.push('Region is required for Global team');

    // ── Lead & sale classification ────────────────────────────────────────────
    if (!form.sale_type)
      e.push('Sale type is required');
    if (!form.lead_type)
      e.push('Sales channel is required');
    if (form.lead_type === 'Direct' && !form.lead_category)
      e.push('Lead category is required');
    if (form.lead_type === 'Direct' && form.lead_category === 'Inside Sales/Pre-Sales' && !form.lead_name)
      e.push('Rep / Contact name is required');
    if (form.lead_type === 'Direct' && form.lead_category === 'Event' && !form.lead_name)
      e.push('Event name is required');
    if (form.lead_type === 'Indirect' && !form.lead_name)
      e.push('Partner name is required');

    // ── SoW (Google Drive link) ───────────────────────────────────────────────
    if (form.sale_type && SOW_REQUIRED_TYPES.has(form.sale_type)) {
      if (!form.sow_link)
        e.push('Signed SoW Google Drive link is required for ' + form.sale_type);
      else if (!isValidUrl(form.sow_link))
        e.push('Signed SoW link must be a valid URL starting with https://');
      // Attach-to-OF choice is mandatory (No / false is a valid answer — only unset blocks)
      if (typeof form.sow_attach_to_of !== 'boolean')
        e.push('Select whether the SoW should be attached to the Order Form (Yes/No) for ' + form.sale_type);
    }
    if (form.sale_type && SOW_REFERENCE_TYPES.has(form.sale_type)) {
      if (!form.sow_reference_link)
        e.push('Previous SoW Google Drive link is required for ' + form.sale_type);
      else if (!isValidUrl(form.sow_reference_link))
        e.push('Previous SoW link must be a valid URL starting with https://');
    }

    // ── Client representative (StepCommercial) ────────────────────────────────
    if (!form.client_rep_name)
      e.push('Client representative name is required');
    if (!form.client_rep_mobile)
      e.push('Client representative mobile number is required');
    if (!form.client_rep_email)
      e.push('Client representative email is required');
    if (!form.billing_email)
      e.push('Billing email is required');

    // ── Service period ────────────────────────────────────────────────────────
    if (!isGaaS) {
      if (!form.start_date)
        e.push('Start date is required');
      if (!form.of_term_months)
        e.push('Order Form term is required');
      if (form.auto_renewal === 'Yes' && !form.renewal_term)
        e.push('Renewal frequency is required when auto renewal is Yes');
      if (!form.payment_terms)
        e.push('Payment terms are required');
    }

    // ── GaaS-specific fields ──────────────────────────────────────────────────
    if (isGaaS) {
      if (!form.expected_delivery_date)
        e.push('Expected delivery date is required for GaaS orders');
      if (!form.of_term)
        e.push('Order Form term is required for GaaS orders');
      if (!form.gaas_payment_trigger)
        e.push('Payment trigger is required for GaaS orders');
      if (!form.gaas_payment_net)
        e.push('Net terms are required for GaaS orders');
    }

    // ── Services ──────────────────────────────────────────────────────────────
    if (!(form.services_fees||[]).length)
      e.push('At least one service is required');

    // ── Signatory ─────────────────────────────────────────────────────────────
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
