import { useState, useEffect } from 'react';
import { Card, Btn, Inp, Sel, Toast } from '../ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { SALES_REPS, REVOPS_USERS, FINANCE_USERS } from '../../constants/users.js';
import { useToast } from '../../hooks/useToast.js';

const NAVY = '#1B2B4B'; const T = '#00C3B5';
const ROLES = ['sales', 'revops', 'finance'];
const ROLE_LABELS = { sales: 'Sales Rep', revops: 'Business / RevOps', finance: 'Finance DRI' };
const BASE_USERS = { sales: SALES_REPS, revops: REVOPS_USERS, finance: FINANCE_USERS };
const LS_KEY = 'fynd_of_users_override';

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveOverrides(o) {
  localStorage.setItem(LS_KEY, JSON.stringify(o));
}
export function getMergedUsers(role) {
  const overrides = loadOverrides();
  const base = BASE_USERS[role] || [];
  const added = (overrides[role] || []);
  const removed = new Set(overrides[`${role}_removed`] || []);
  return [...base.filter(u => !removed.has(u.email)), ...added];
}

const BLANK = { id:'', name:'', slack:'', email:'' };

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast, show, hide } = useToast();
  const [tab, setTab]         = useState('sales');
  const [overrides, setOvr]   = useState(loadOverrides);
  const [form, setForm]       = useState({...BLANK});
  const [errors, setErrors]   = useState([]);

  if (!user?.isUniversal) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="font-semibold text-navy">Universal access required</p>
          <p className="text-sm text-brand-muted mt-1">Only Muskan Katta can manage users.</p>
        </div>
      </div>
    );
  }

  const persist = (newOvr) => { setOvr(newOvr); saveOverrides(newOvr); };

  const allUsers = getMergedUsers(tab);
  const removedSet = new Set((overrides[`${tab}_removed`] || []));
  const addedEmails = new Set((overrides[tab] || []).map(u => u.email));

  const validate = () => {
    const e = [];
    if (!form.name.trim())  e.push('Name is required');
    if (!form.email.trim()) e.push('Email is required');
    if (!form.email.includes('@')) e.push('Valid email required');
    if (allUsers.find(u => u.email === form.email.trim())) e.push('Email already exists in this role');
    setErrors(e);
    return e.length === 0;
  };

  const addUser = () => {
    if (!validate()) return;
    const newUser = { id: form.id||Date.now().toString(), name:form.name.trim(), slack:form.slack.trim(), email:form.email.trim().toLowerCase() };
    const updated = { ...overrides, [tab]: [...(overrides[tab]||[]), newUser] };
    persist(updated);
    setForm({...BLANK});
    show(`${newUser.name} added to ${ROLE_LABELS[tab]}`);
  };

  const removeUser = (email) => {
    if (!confirm(`Remove ${email} from ${ROLE_LABELS[tab]}?`)) return;
    const newOvr = { ...overrides };
    // If it's an added user, remove from added list
    if (addedEmails.has(email)) {
      newOvr[tab] = (overrides[tab]||[]).filter(u => u.email !== email);
    } else {
      // It's a base user — add to removed set
      newOvr[`${tab}_removed`] = [...(overrides[`${tab}_removed`]||[]), email];
    }
    persist(newOvr);
    show(`User removed from ${ROLE_LABELS[tab]}`);
  };

  const restoreBase = () => {
    if (!confirm(`Restore all original ${ROLE_LABELS[tab]} users? Custom additions will be kept.`)) return;
    const newOvr = { ...overrides };
    delete newOvr[`${tab}_removed`];
    persist(newOvr);
    show('Original users restored');
  };

  const thCls = "text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-brand-faint bg-slate-50";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ color:NAVY }}>User Management</h2>
          <p className="text-sm mt-0.5 text-brand-muted">Add or remove authenticated users per role. Changes take effect immediately.</p>
        </div>
      </div>

      {/* Role tabs */}
      <div className="flex gap-2 mb-6">
        {ROLES.map(r => (
          <button key={r} onClick={() => setTab(r)}
            className="px-4 py-2 text-sm font-semibold rounded-xl border transition-all"
            style={tab===r ? {background:NAVY,color:'#fff',borderColor:NAVY} : {background:'#f8fafc',color:'#64748b',borderColor:'#e2e8f0'}}>
            {ROLE_LABELS[r]} ({getMergedUsers(r).length})
          </button>
        ))}
      </div>

      {/* Add user form */}
      <Card className="p-6 mb-6">
        <h3 className="font-bold text-sm mb-4" style={{ color:NAVY }}>+ Add new {ROLE_LABELS[tab]}</h3>
        <div className="grid grid-cols-4 gap-3">
          <Inp label="Employee ID" value={form.id}    onChange={v=>setForm(f=>({...f,id:v}))}    placeholder="e.g. 3201"/>
          <Inp label="Full Name"   value={form.name}  onChange={v=>setForm(f=>({...f,name:v}))}  placeholder="e.g. Priya Mehta" req/>
          <Inp label="Slack ID"    value={form.slack} onChange={v=>setForm(f=>({...f,slack:v}))} placeholder="e.g. U0XXXXXXXX"/>
          <Inp label="Email"       value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} placeholder="name@gofynd.com" req type="email"/>
        </div>
        {errors.length > 0 && (
          <div className="mb-3 p-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
            {errors.map((e,i) => <div key={i}>• {e}</div>)}
          </div>
        )}
        <Btn onClick={addUser}>Add {ROLE_LABELS[tab]}</Btn>
      </Card>

      {/* User list */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm" style={{ color:NAVY }}>
            Current {ROLE_LABELS[tab]}s <span className="font-normal text-brand-faint">({allUsers.length})</span>
          </h3>
          {(overrides[`${tab}_removed`]||[]).length > 0 && (
            <Btn variant="ghost" size="sm" onClick={restoreBase}>↺ Restore removed users</Btn>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr><th className={thCls}>Emp ID</th><th className={thCls}>Name</th><th className={thCls}>Slack ID</th><th className={thCls}>Email</th><th className={thCls}>Source</th><th className={thCls}></th></tr>
          </thead>
          <tbody>
            {allUsers.map((u, i) => (
              <tr key={u.email} className="border-b border-slate-50 last:border-0" style={{ background: i%2===0?'#fff':'#f8fafc' }}>
                <td className="px-4 py-3 text-xs text-brand-faint font-mono">{u.id}</td>
                <td className="px-4 py-3 font-semibold text-sm" style={{ color:NAVY }}>{u.name}</td>
                <td className="px-4 py-3 text-xs font-mono text-brand-muted">{u.slack}</td>
                <td className="px-4 py-3 text-xs text-brand-muted">{u.email}</td>
                <td className="px-4 py-3">
                  {addedEmails.has(u.email)
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Added</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Original</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => removeUser(u.email)} className="text-xs font-medium text-red-500 hover:text-red-700">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
        <strong>Note:</strong> Changes are stored in this browser. For the changes to apply across all users and devices, update <code className="text-xs bg-amber-100 px-1 rounded">src/constants/users.js</code> on GitHub with the same additions/removals.
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}
