import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db, isConfigured } from '../firebase.js';
import { storage } from '../utils/storage.js';
import { uid } from '../utils/dates.js';
import {
  notifySubmitted, notifyRevOpsApproved, notifyFinanceApproved,
  notifyRejected, notifyChurnVoidRequest, notifyRenewalReminder,
} from '../utils/slack.js';
import { useAuth } from './AuthContext.jsx';

const FormsContext = createContext(null);
const COLLECTION = 'order_forms';

// ── HELPERS ───────────────────────────────────────────────────────────────────
const toFirestore = form => {
  const { sow_document, sow_reference_document, ...rest } = form;
  return {
    ...rest,
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
  // Count existing renewals for this base OF number
  const base = baseOfNumber.replace(/-R\d+$/, '');
  const existing = forms.filter(f =>
    f.of_number === base ||
    (f.of_number && f.of_number.startsWith(base + '-R'))
  );
  // Find next R number
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
      setForms(docs);
      storage.set(docs);
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

      if (endDate >= today) continue; // Not expired yet

      // Check if already processed (renewal draft exists)
      const renewalExists = currentForms.some(r =>
        r.renewal_of === f.id ||
        (f.of_number && r.of_number?.startsWith(f.of_number.replace(/-R\d+$/, '') + '-R'))
      );
      if (renewalExists) {
        // Mark original as completed if not already
        if (f.status === 'signed') {
          await persistOneDirect({ ...f, status: 'completed', completed_at: new Date().toISOString() });
        }
        continue;
      }

      // Mark original as completed
      await persistOneDirect({ ...f, status: 'completed', completed_at: new Date().toISOString() });

      if (f.auto_renewal !== 'Yes') continue;

      // Create renewal draft
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
        of_number: '',           // Finance will assign new number
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

  // Direct persist without closure over forms state (used in renewal check)
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
    // Always save full form to localStorage (includes SoW base64)
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
    await notifySubmitted({ form: f, repName: user?.name });
    return f;
  }, [persistOne, user]);

  const revopsApprove = useCallback(async (id, { editedForm, comment, financeApprovers }) => {
    const base = forms.find(f => f.id === id) || {};
    const f = {
      ...base, ...editedForm, status: 'revops_approved',
      revops_reviewed_at: new Date().toISOString(), revops_comment: comment,
      revops_reviewer: user?.name, finance_approvers: financeApprovers,
    };
    await persistOne(f);
    await notifyRevOpsApproved({ form: f, revopsName: user?.name });
  }, [forms, persistOne, user]);

  const revopsReject = useCallback(async (id, { comment }) => {
    const base = forms.find(f => f.id === id) || {};
    const f = {
      ...base, status: 'revops_rejected',
      revops_reviewed_at: new Date().toISOString(),
      revops_comment: comment, revops_reviewer: user?.name,
    };
    await persistOne(f);
    await notifyRejected({ form: f, comment, reviewerName: user?.name });
  }, [forms, persistOne, user]);

  const financeApprove = useCallback(async (id, { ofNumber, comment, editedForm }) => {
    const base = forms.find(f => f.id === id) || {};
    const f = {
      ...base, ...editedForm, status: 'approved', of_number: ofNumber,
      approved_at: new Date().toISOString(), finance_comment: comment,
      finance_approver: user?.name,
    };
    await persistOne(f);
    await notifyFinanceApproved({ form: f });
  }, [forms, persistOne, user]);

  const financeReject = useCallback(async (id, { comment }) => {
    const base = forms.find(f => f.id === id) || {};
    const f = { ...base, status: 'submitted', finance_comment: comment };
    await persistOne(f);
    await notifyRejected({ form: f, comment, reviewerName: user?.name });
  }, [forms, persistOne, user]);

  const markSigned = useCallback(async (id, signingDate, signedLink = '') => {
    const base = forms.find(f => f.id === id) || {};
    await persistOne({
      ...base, status: 'signed', signed_date: signingDate,
      signed_by: user?.name, signed_at: new Date().toISOString(),
      signed_of_link: signedLink,
    });
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
    await notifyChurnVoidRequest({ ...payload, requesterName: user?.name });
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
