import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { storage } from '../utils/storage.js';
import { uid } from '../utils/dates.js';
import { syncToSheets } from '../utils/sheets.js';
import { notifySubmitted, notifyRevOpsApproved, notifyFinanceApproved,
         notifyRejected, notifyChurnVoidRequest } from '../utils/slack.js';
import { useAuth } from './AuthContext.jsx';

const FormsContext = createContext(null);

export function FormsProvider({ children }) {
  const { user } = useAuth();
  const [forms, setForms] = useState(() => storage.get());

  const persist = useCallback(async updated => {
    setForms(updated);
    storage.set(updated);
    if (user?.accessToken) syncToSheets(updated, user.accessToken).catch(console.error);
  }, [user]);

  // Reminder check on mount
  useEffect(() => {
    const approved = forms.filter(f => f.status === 'approved' && !f.signed_date);
    approved.forEach(f => {
      if (!f.end_date) return;
      const days = Math.ceil((new Date(f.end_date) - new Date()) / 86400000);
      if (days <= 30 && days > 0 && !f._reminderSent) {
        // notifyRenewalReminder({ form: f, daysLeft: days }); // uncomment when webhook is live
        persist(forms.map(x => x.id === f.id ? { ...x, _reminderSent: true } : x));
      }
    });
  }, []); // eslint-disable-line

  // ── CRUD ────────────────────────────────────────────────────────────────
  const saveDraft = useCallback(async formData => {
    const f = { ...formData, id: uid(), status:'draft', created_at: new Date().toISOString() };
    await persist([...forms, f]);
    return f;
  }, [forms, persist]);

  const updateDraft = useCallback(async (id, patch) => {
    const updated = forms.map(f => f.id === id ? { ...f, ...patch } : f);
    await persist(updated);
  }, [forms, persist]);

  const deleteDraft = useCallback(async id => {
    await persist(forms.filter(f => f.id !== id));
  }, [forms, persist]);

  const submitForm = useCallback(async (formData, revopsApprovers) => {
    const f = {
      ...formData,
      id: uid(),
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      revops_approvers: revopsApprovers,
    };
    await persist([...forms, f]);
    await notifySubmitted({ form: f, repName: user?.name });
    return f;
  }, [forms, persist, user]);

  const revopsApprove = useCallback(async (id, { editedForm, comment, financeApprovers }) => {
    const now = new Date().toISOString();
    const updated = forms.map(f => f.id === id ? {
      ...f, ...editedForm, status:'revops_approved',
      revops_reviewed_at: now, revops_comment: comment,
      revops_reviewer: user?.name, finance_approvers: financeApprovers,
    } : f);
    await persist(updated);
    const form = updated.find(f => f.id === id);
    await notifyRevOpsApproved({ form, revopsName: user?.name });
  }, [forms, persist, user]);

  const revopsReject = useCallback(async (id, { comment }) => {
    const now = new Date().toISOString();
    const updated = forms.map(f => f.id === id ? {
      ...f, status:'revops_rejected', revops_reviewed_at: now,
      revops_comment: comment, revops_reviewer: user?.name,
    } : f);
    await persist(updated);
    const form = updated.find(f => f.id === id);
    await notifyRejected({ form, comment, reviewerName: user?.name });
  }, [forms, persist, user]);

  const financeApprove = useCallback(async (id, { ofNumber, comment, editedForm }) => {
    const now = new Date().toISOString();
    const updated = forms.map(f => f.id === id ? {
      ...f, ...editedForm, status:'approved',
      of_number: ofNumber, approved_at: now,
      finance_comment: comment, finance_approver: user?.name,
    } : f);
    await persist(updated);
    const form = updated.find(f => f.id === id);
    await notifyFinanceApproved({ form });
  }, [forms, persist, user]);

  const financeReject = useCallback(async (id, { comment }) => {
    const updated = forms.map(f => f.id === id ? {
      ...f, status:'submitted', finance_comment: comment,
    } : f);
    await persist(updated);
    const form = updated.find(f => f.id === id);
    await notifyRejected({ form, comment, reviewerName: user?.name });
  }, [forms, persist, user]);

  const markSigned = useCallback(async (id, signingDate) => {
    const updated = forms.map(f => f.id === id
      ? { ...f, status:'signed', signed_date: signingDate, signed_by: user?.name, signed_at: new Date().toISOString() }
      : f);
    await persist(updated);
  }, [forms, persist, user]);

  const applyDealStatus = useCallback(async (id, patch) => {
    const updated = forms.map(f => f.id === id ? { ...f, ...patch } : f);
    await persist(updated);
  }, [forms, persist]);

  const submitChurnVoidRequest = useCallback(async payload => {
    await notifyChurnVoidRequest({ ...payload, requesterName: user?.name });
  }, [user]);

  const cloneForm = useCallback(async formData => {
    const clone = {
      ...formData,
      id: uid(),
      status: 'draft',
      of_number: '',
      submitted_at: null,
      revops_reviewed_at: null,
      approved_at: null,
      signed_date: null,
      signed_at: null,
      revops_comment: '',
      finance_comment: '',
      revops_approvers: [],
      finance_approvers: [],
      sow_document: null,
      sow_reference_document: null,
      clone_of: formData.id,
      created_at: new Date().toISOString(),
    };
    await persist([...forms, clone]);
    return clone;
  }, [forms, persist]);

  return (
    <FormsContext.Provider value={{
      forms, saveDraft, updateDraft, deleteDraft, submitForm,
      revopsApprove, revopsReject, financeApprove, financeReject,
      markSigned, applyDealStatus, submitChurnVoidRequest, cloneForm,
    }}>
      {children}
    </FormsContext.Provider>
  );
}

export const useForms = () => useContext(FormsContext);
