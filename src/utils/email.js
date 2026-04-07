import emailjs from '@emailjs/browser';

const SERVICE_ID  = 'service_lokw6mp';
const TEMPLATE_ID = 'template_dymzngb';
const PUBLIC_KEY  = 'm0Eamv5EryYL0T7hJ';

emailjs.init(PUBLIC_KEY);

export const sendEmail = async (to, subject, message) => {
  try {
    await emailjs.send(SERVICE_ID, TEMPLATE_ID, { to_email: to, subject, message });
  } catch (e) {
    console.warn('Email notification failed:', e);
  }
};

export const svcNames = (form) =>
  (form.services_fees || []).map(s => s.name).filter(Boolean).join(', ') || '—';
