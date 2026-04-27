import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db, isConfigured } from '../firebase.js';
import { storage } from '../utils/storage.js';
import { uid } from '../utils/dates.js';
import { sendEmail, svcNames, threadSubject } from '../utils/email.js';
import { notifySlack } from '../utils/slack.js';
import { useAuth } from './AuthContext.jsx';

const FormsContext = createContext(null);
const COLLECTION = 'order_forms';

const REVOPS_EMAILS = 'samikshamane@gofynd.com,raginivarma@gofynd.com,ronakmodi@gofynd.com,nayanlathiya@gofynd.com,atharvashetye@gofynd.com,omkarsp@gofynd.com';
const FINANCE_EMAILS = 'rahulmandowara@gofynd.com,abhimanyumallik@gofynd.com,rasikajadhav@gofynd.com,somaydugar@gofynd.com';

// ── HELPERS ───────────────────────────────────────────────────────────────────
const toFirestore = form => {
  const { sow_document, sow_reference_document, ...rest } = form;
  return {
    ...rest,
    // Strip base64 data from attachments — store metadata only in Firestore
    attachments: (form.attachments || []).map(({ data, ...meta }) => meta),
    _updatedAt: serverTimestamp(),
    sow_document_name: sow_document?.name || null,
    sow_document_size: sow_document?.size || null,
    sow_reference_document_name: sow_reference_document?.name || null,
  };
};

const ARRAY_FIELDS = new Set(['services_fees','revops_approvers','finance_approvers','stepUpValues','slabs','fees','attachments']);
const OBJ_FIELDS   = new Set(['sow_document','sow_reference_document']);

const fromFirestore = snap => {
  const d = snap.data();
  if (d._updatedAt?.toDate) d._updatedAt = d._updatedAt.toDate().toISOString();
  Object.keys(d).forEach(key => {
    const val = d[key];
    if (typeof val === 'string' && (ARRAY_FIELDS.has(key) || OBJ_FIELDS.has(key))) {
      try { d[key] = JSON.parse(val); }
      catch { d[key] = ARRAY_FIELDS.has(key) ? [] : null; }
    }
    if (ARRAY_FIELDS.has(key) && !Array.isArray(d[key])) d[key] = [];
  });
  return d;
  // Auto-tag existing OFYT OFs as Yavi entity
if (!d.entity && d.of_number && d.of_number.startsWith('OF-YT')) {
  d.entity = 'Yavi';
}
};

// ── RENEWAL HELPERS ───────────────────────────────────────────────────────────
function addMonthsMinus1(dateStr, months) {
  if (!dateStr || !months) return '';
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getRenewalNumber(forms, baseOfNumber) {
  const base = baseOfNumber.replace(/-R\d+$/, '');
  const existing = forms.filter(f =>
    f.of_number === base ||
    (f.of_number && f.of_number.startsWith(base + '-R'))
  );
  let maxR = 0;
  existing.forEach(f => {
    const match = f.of_number?.match(/-R(\d+)$/);
    if (match) maxR = Math.max(maxR, parseInt(match[1]));
  });
  return `${base}-R${maxR + 1}`;
}

// ── PROVIDER ──────────────────────────────────────────────────────────────────
export function FormsProvider({ children }) {
  const { user }   = useAuth();
  const [forms,    setForms]   = useState(() => storage.get());
  const [synced,   setSynced]  = useState(!isConfigured);
  const renewalRanRef = useRef(false);
  const unsubRef      = useRef(null);

  // Real-time Firestore listener
  useEffect(() => {
    if (!isConfigured || !db) { setSynced(true); return; }
    const q = collection(db, COLLECTION);
    unsubRef.current = onSnapshot(q, snap => {
      const docs = snap.docs.map(fromFirestore);
      // Merge with localStorage to preserve binary data (sow, attachments)
      // that is stripped from Firestore writes due to size limits
      const localForms = storage.get();
      const merged = docs.map(d => {
        const local = localForms.find(f => f.id === d.id);
        if (!local) return d;
        return {
          ...d,
          sow_document: local.sow_document || d.sow_document,
          sow_reference_document: local.sow_reference_document || d.sow_reference_document,
          attachments: (d.attachments || []).map((a, i) => ({
            ...a,
            data: local.attachments?.[i]?.data || a.data || null,
          })),
        };
      });
      setForms(merged);
      storage.set(merged);
      setSynced(true);
    }, err => {
      console.error('[Firestore] listener error:', err);
      setForms(storage.get());
      setSynced(true);
    });
    return () => unsubRef.current?.();
  }, []);

  // Auto-renewal check — runs once after first sync
  useEffect(() => {
    if (!synced || renewalRanRef.current || !forms.length) return;
    renewalRanRef.current = true;
    checkAndProcessRenewals(forms);
  }, [synced, forms.length]);

  const checkAndProcessRenewals = async (currentForms) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const f of currentForms) {
      if (f.status !== 'signed') continue;
      if (!f.end_date) continue;

      const endDate = new Date(f.end_date);
      endDate.setHours(0, 0, 0, 0);

      if (endDate >= today) continue;

      const renewalExists = currentForms.some(r =>
        r.renewal_of === f.id ||
        (f.of_number && r.of_number?.startsWith(f.of_number.replace(/-R\d+$/, '') + '-R'))
      );
      if (renewalExists) {
        if (f.status === 'signed') {
          await persistOneDirect({ ...f, status: 'completed', completed_at: new Date().toISOString() });
        }
        continue;
      }

      await persistOneDirect({ ...f, status: 'completed', completed_at: new Date().toISOString() });

      if (f.auto_renewal !== 'Yes') continue;

      const renewalOfNum = getRenewalNumber(currentForms, f.of_number || '');
      const termMonths = parseInt(f.of_term_months) || 12;
      const newStart = new Date(f.end_date);
      newStart.setDate(newStart.getDate() + 1);
      const newStartStr = newStart.toISOString().split('T')[0];
      const newEndStr = addMonthsMinus1(newStartStr, termMonths);

      const renewal = {
        ...f,
        id: uid(),
        status: 'draft',
        of_number: '',
        suggested_of_number: renewalOfNum,
        renewal_of: f.id,
        renewal_of_number: f.of_number,
        start_date: newStartStr,
        end_date: newEndStr,
        submitted_at: null,
        revops_reviewed_at: null,
        approved_at: null,
        signed_date: null,
        signed_at: null,
        completed_at: null,
        revops_comment: '',
        finance_comment: '',
        revops_approvers: [],
        finance_approvers: [],
        sow_document: null,
        sow_reference_document: null,
        created_at: new Date().toISOString(),
        is_renewal: true,
      };
      await persistOneDirect(renewal);
      console.log(`[AutoRenewal] Created renewal draft ${renewalOfNum} for ${f.of_number}`);
    }
  };

  const persistOneDirect = async (form) => {
    if (isConfigured && db) {
      await setDoc(doc(db, COLLECTION, form.id), toFirestore(form));
    } else {
      setForms(prev => {
        const exists = prev.find(f => f.id === form.id);
        const updated = exists ? prev.map(f => f.id === form.id ? form : f) : [...prev, form];
        storage.set(updated);
        return updated;
      });
    }
  };

  const persistOne = useCallback(async (form) => {
    setForms(prev => {
      const exists = prev.find(f => f.id === form.id);
      const updated = exists ? prev.map(f => f.id === form.id ? form : f) : [...prev, form];
      storage.set(updated);
      return updated;
    });
    if (isConfigured && db) {
      await setDoc(doc(db, COLLECTION, form.id), toFirestore(form));
    }
  }, []);

  const deleteOne = useCallback(async (id) => {
    if (isConfigured && db) {
      await deleteDoc(doc(db, COLLECTION, id));
    } else {
      setForms(prev => { const u = prev.filter(f => f.id !== id); storage.set(u); return u; });
    }
  }, []);

  // ── ACTIONS ───────────────────────────────────────────────────────────────
  const saveDraft = useCallback(async (formData) => {
    const f = { ...formData, id: uid(), status: 'draft', created_at: new Date().toISOString() };
    await persistOne(f); return f;
  }, [persistOne]);

  const updateDraft = useCallback(async (id, patch) => {
    const f = forms.find(x => x.id === id);
    if (f) await persistOne({ ...f, ...patch });
  }, [forms, persistOne]);

  const deleteDraft = useCallback(async (id) => {
    await deleteOne(id);
  }, [deleteOne]);

  const submitForm = useCallback(async (formData, revopsApprovers) => {
    const f = {
      ...formData, id: formData.id || uid(), status: 'submitted',
      submitted_at: new Date().toISOString(), revops_approvers: revopsApprovers,
    };
    await persistOne(f);
    sendEmail(
      [f.sales_rep_email, ...revopsApprovers].filter(Boolean).join(','),
      threadSubject(f.customer_name),
      '📋 New Submission — Pending RevOps Review\n\n' +
      'Customer: ' + f.customer_name + '\n' +
      'Brand: ' + (f.brand_name || '—') + '\n' +
      'Sales Rep: ' + f.sales_rep_name + '\n' +
      'Service(s): ' + svcNames(f) + '\n' +
      'OF Value: ' + (f.committed_currency || 'INR') + ' ' + Number(f.of_value || 0).toLocaleString('en-IN') + '\n' +
      'Start Date: ' + (f.start_date || '—') + '\n\n' +
      'Log in to review:\nhttps://muskankatta.github.io/Order_Form/'
    );
    const ts = await notifySlack('submitted', f, {});
if (ts) await persistOne({ ...f, slack_thread_ts: ts });
return f;
  }, [persistOne]);

  const revopsApprove = useCallback(async (id, { editedForm, comment, financeApprovers }) => {
    const base = forms.find(f => f.id === id) || {};
    const f = {
      ...base, ...editedForm, status: 'revops_approved',
      revops_reviewed_at: new Date().toISOString(), revops_comment: comment,
      revops_reviewer: user?.name, finance_approvers: financeApprovers,
    };
    await persistOne(f);
    sendEmail(
      [f.sales_rep_email, ...financeApprovers].filter(Boolean).join(','),
      threadSubject(f.customer_name),
      '✅ Approved by RevOps — Pending Finance Approval\n\n' +
      'Customer: ' + f.customer_name + '\n' +
      'Brand: ' + (f.brand_name || '—') + '\n' +
      'Sales Rep: ' + f.sales_rep_name + '\n' +
      'Service(s): ' + svcNames(f) + '\n' +
      'OF Value: ' + (f.committed_currency || 'INR') + ' ' + Number(f.of_value || 0).toLocaleString('en-IN') + '\n\n' +
      'Log in to the platform:\nhttps://muskankatta.github.io/Order_Form/'
    );
    await notifySlack('revops_approved', f, {});
  }, [forms, persistOne, user]);

  const revopsReject = useCallback(async (id, { comment }) => {
    const base = forms.find(f => f.id === id) || {};
    const f = {
      ...base, status: 'revops_rejected',
      revops_reviewed_at: new Date().toISOString(),
      revops_comment: comment, revops_reviewer: user?.name,
    };
    await persistOne(f);
    sendEmail(
      f.sales_rep_email,
      threadSubject(f.customer_name),
      '❌ Action Required — Order Form Returned\n\n' +
      'Customer: ' + f.customer_name + '\n' +
      'Brand: ' + (f.brand_name || '—') + '\n' +
      'Reason: ' + (comment || 'See platform for details') + '\n\n' +
      'Please log in to review and resubmit:\nhttps://muskankatta.github.io/Order_Form/'
    );
    await notifySlack('revops_rejected', f, { comment });
  }, [forms, persistOne, user]);

  const financeApprove = useCallback(async (id, { ofNumber, comment, editedForm }) => {
    const base = forms.find(f => f.id === id) || {};
    const f = {
      ...base, ...editedForm, status: 'approved', of_number: ofNumber,
      approved_at: new Date().toISOString(), finance_comment: comment,
      finance_approver: user?.name,
    };
    await persistOne(f);
    const revopsEmails = (f.revops_approvers || []).filter(Boolean);
    const financeEmails = (f.finance_approvers || []).filter(Boolean);
    sendEmail(
      [f.sales_rep_email, ...revopsEmails, ...financeEmails].filter(Boolean).join(','),
      threadSubject(f.customer_name),
      '🎉 Finance Approved — OF# ' + ofNumber + '\n\n' +
      'Customer: ' + f.customer_name + '\n' +
      'Brand: ' + (f.brand_name || '—') + '\n' +
      'OF Number: ' + ofNumber + '\n' +
      'Service(s): ' + svcNames(f) + '\n' +
      'OF Value: ' + (f.committed_currency || 'INR') + ' ' + Number(f.of_value || 0).toLocaleString('en-IN') + '\n' +
      'Start Date: ' + (f.start_date || '—') + '\n' +
      'End Date: ' + (f.end_date || '—') + '\n\n' +
      'Log in to the platform:\nhttps://muskankatta.github.io/Order_Form/'
    );
    await notifySlack('approved', f, {});
  }, [forms, persistOne, user]);

  const financeReject = useCallback(async (id, { comment }) => {
    const base = forms.find(f => f.id === id) || {};
    const f = { ...base, status: 'submitted', finance_comment: comment };
    await persistOne(f);
    sendEmail(
      f.sales_rep_email,
      threadSubject(f.customer_name),
      '❌ Action Required — Returned by Finance\n\n' +
      'Customer: ' + f.customer_name + '\n' +
      'Brand: ' + (f.brand_name || '—') + '\n' +
      'Reason: ' + (comment || 'See platform for details') + '\n\n' +
      'Please log in to review:\nhttps://muskankatta.github.io/Order_Form/'
      );
    await notifySlack('finance_rejected', f, { comment });
  }, [forms, persistOne, user]);

  const markSigned = useCallback(async (id, signingDate, signedLink = '') => {
    const base = forms.find(f => f.id === id) || {};
    const f = {
      ...base, status: 'signed', signed_date: signingDate,
      signed_by: user?.name, signed_at: new Date().toISOString(),
      signed_of_link: signedLink,
    };
    await persistOne(f);
    await notifySlack('signed', f, {});
  }, [forms, persistOne, user]);

  const markCompleted = useCallback(async (id) => {
    const base = forms.find(f => f.id === id) || {};
    await persistOne({ ...base, status: 'completed', completed_at: new Date().toISOString() });
  }, [forms, persistOne]);

  const applyDealStatus = useCallback(async (id, patch) => {
    const base = forms.find(f => f.id === id) || {};
    await persistOne({ ...base, ...patch });
  }, [forms, persistOne]);

  const submitChurnVoidRequest = useCallback(async (payload) => {
    // Churn/void requests — no email notification currently
  }, [user]);

  const cloneForm = useCallback(async (formData) => {
    const clone = {
      ...formData, id: uid(), status: 'draft', of_number: '',
      submitted_at: null, revops_reviewed_at: null, approved_at: null,
      signed_date: null, signed_at: null, completed_at: null,
      revops_comment: '', finance_comment: '',
      revops_approvers: [], finance_approvers: [],
      sow_document: null, sow_reference_document: null,
      clone_of: formData.id, created_at: new Date().toISOString(),
    };
    await persistOne(clone); return clone;
  }, [persistOne]);

  return (
    <FormsContext.Provider value={{
      forms, synced, isFirestore: isConfigured,
      saveDraft, updateDraft, deleteDraft, submitForm,
      revopsApprove, revopsReject, financeApprove, financeReject,
      markSigned, markCompleted, applyDealStatus, submitChurnVoidRequest, cloneForm,
    }}>
      {children}
    </FormsContext.Provider>
  );
}

export const useForms = () => useContext(FormsContext);
