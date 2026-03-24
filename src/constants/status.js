export const STATUS = {
  draft:           { label:'Draft',           bg:'#f3f4f6', text:'#6b7280', dot:'#d1d5db' },
  submitted:       { label:'Pending RevOps',  bg:'#fffbeb', text:'#b45309', dot:'#f59e0b' },
  revops_approved: { label:'Pending Finance', bg:'#eff6ff', text:'#1d4ed8', dot:'#3b82f6' },
  revops_rejected: { label:'Rejected',        bg:'#fef2f2', text:'#b91c1c', dot:'#ef4444' },
  approved:        { label:'Approved ✓',      bg:'#f0fdf4', text:'#15803d', dot:'#22c55e' },
  signed:          { label:'Signed ✍️',       bg:'#f0fdf4', text:'#065f46', dot:'#059669' },
  dropped:         { label:'Dropped',         bg:'#f9fafb', text:'#9ca3af', dot:'#d1d5db' },
  revised:         { label:'Revised',         bg:'#eff6ff', text:'#1d4ed8', dot:'#3b82f6' },
  void:            { label:'Void',            bg:'#fef2f2', text:'#b91c1c', dot:'#ef4444' },
  churn:           { label:'Churn',           bg:'#fff7ed', text:'#c2410c', dot:'#f97316' },
};

export const FORM_STEPS = [
  { id:'client',    lbl:'Client',         icon:'👤' },
  { id:'commercial',lbl:'Commercial',     icon:'📅' },
  { id:'fees',      lbl:'Services & Fees',icon:'💰' },
  { id:'terms',     lbl:'Special Terms',  icon:'📝' },
  { id:'signatory', lbl:'Signatory',      icon:'✍️' },
];

export const DEAL_STATUS_OPTIONS = ['revised','void','churn'];
