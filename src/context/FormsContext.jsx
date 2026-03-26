import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  collection, doc, setDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db, isConfigured } from '../firebase.js';
import { storage } from '../utils/storage.js';
import { uid } from '../utils/dates.js';
import {
  notifySubmitted, notifyRevOpsApproved, notifyFinanceApproved,
  notifyRejected, notifyChurnVoidRequest,
} from '../utils/slack.js';
import { useAuth } from './AuthContext.jsx';

const FormsContext = createContext(null);
const COLLECTION   = 'order_forms';

const toFirestore   = form => ({ ...form, _updatedAt: serverTimestamp() });
const fromFirestore = snap => {
  const d = snap.data();
  if (d._updatedAt?.toDate) d._updatedAt = d._updatedAt.toDate().toISOString();
  // Parse JSON strings back into arrays/objects
  const ARRAY_FIELDS = ['services_fees','revops_approvers','finance_approvers','stepUpValues','slabs'];
  const OBJ_FIELDS   = ['sow_document','sow_reference_document'];
  [...ARRAY_FIELDS, ...OBJ_FIELDS].forEach(key => {
    if (typeof d[key] === 'string') {
      try { d[key] = JSON.parse(d[key]); } catch { d[key] = ARRAY_FIELDS.includes(key) ? [] : null; }
    }
  });
  return d;
};

export function FormsProvider({ children }) {
  const { user }  = useAuth();
  const [forms,   setForms]  = useState(() => storage.get());
  const [synced,  setSynced] = useState(!isConfigured);
  const unsubRef = useRef(null);

  // Real-time Firestore listener
  useEffect(() => {
    if (!isConfigured || !db) { setSynced(true); return; }
    const q = query(collection(db, COLLECTION), orderBy('of_number'));
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

  const persistOne = useCallback(async (form) => {
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
  }, []);

  const deleteOne = useCallback(async (id) => {
    if (isConfigured && db) {
      await deleteDoc(doc(db, COLLECTION, id));
    } else {
      setForms(prev => { const u = prev.filter(f => f.id !== id); storage.set(u); return u; });
    }
  }, []);

  const saveDraft = useCallback(async (formData) => {
    const f = { ...formData, id: uid(), status:'draft', created_at: new Date().toISOString() };
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
    const f = { ...formData, id: formData.id||uid(), status:'submitted',
      submitted_at: new Date().toISOString(), revops_approvers: revopsApprovers };
    await persistOne(f);
    await notifySubmitted({ form: f, repName: user?.name });
    return f;
  }, [persistOne, user]);

  const revopsApprove = useCallback(async (id, { editedForm, comment, financeApprovers }) => {
    const base = forms.find(f => f.id === id) || {};
    const f = { ...base, ...editedForm, status:'revops_approved',
      revops_reviewed_at: new Date().toISOString(), revops_comment: comment,
      revops_reviewer: user?.name, finance_approvers: financeApprovers };
    await persistOne(f);
    await notifyRevOpsApproved({ form: f, revopsName: user?.name });
  }, [forms, persistOne, user]);

  const revopsReject = useCallback(async (id, { comment }) => {
    const base = forms.find(f => f.id === id) || {};
    const f = { ...base, status:'revops_rejected', revops_reviewed_at: new Date().toISOString(),
      revops_comment: comment, revops_reviewer: user?.name };
    await persistOne(f);
    await notifyRejected({ form: f, comment, reviewerName: user?.name });
  }, [forms, persistOne, user]);

  const financeApprove = useCallback(async (id, { ofNumber, comment, editedForm }) => {
    const base = forms.find(f => f.id === id) || {};
    const f = { ...base, ...editedForm, status:'approved', of_number: ofNumber,
      approved_at: new Date().toISOString(), finance_comment: comment, finance_approver: user?.name };
    await persistOne(f);
    await notifyFinanceApproved({ form: f });
  }, [forms, persistOne, user]);

  const financeReject = useCallback(async (id, { comment }) => {
    const base = forms.find(f => f.id === id) || {};
    const f = { ...base, status:'submitted', finance_comment: comment };
    await persistOne(f);
    await notifyRejected({ form: f, comment, reviewerName: user?.name });
  }, [forms, persistOne, user]);

  const markSigned = useCallback(async (id, signingDate, signedLink='') => {
    const base = forms.find(f => f.id === id) || {};
    await persistOne({ ...base, status:'signed', signed_date: signingDate,
      signed_by: user?.name, signed_at: new Date().toISOString(), signed_of_link: signedLink });
  }, [forms, persistOne, user]);

  const applyDealStatus = useCallback(async (id, patch) => {
    const base = forms.find(f => f.id === id) || {};
    await persistOne({ ...base, ...patch });
  }, [forms, persistOne]);

  const submitChurnVoidRequest = useCallback(async (payload) => {
    await notifyChurnVoidRequest({ ...payload, requesterName: user?.name });
  }, [user]);

  const cloneForm = useCallback(async (formData) => {
    const clone = { ...formData, id: uid(), status:'draft', of_number:'',
      submitted_at:null, revops_reviewed_at:null, approved_at:null,
      signed_date:null, signed_at:null, revops_comment:'', finance_comment:'',
      revops_approvers:[], finance_approvers:[],
      sow_document:null, sow_reference_document:null,
      clone_of: formData.id, created_at: new Date().toISOString() };
    await persistOne(clone); return clone;
  }, [persistOne]);

  return (
    <FormsContext.Provider value={{
      forms, synced, isFirestore: isConfigured,
      saveDraft, updateDraft, deleteDraft, submitForm,
      revopsApprove, revopsReject, financeApprove, financeReject,
      markSigned, applyDealStatus, submitChurnVoidRequest, cloneForm,
    }}>
      {children}
    </FormsContext.Provider>
  );
}

export const useForms = () => useContext(FormsContext);
