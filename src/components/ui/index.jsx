import { useState } from 'react';
import { STATUS } from '../../constants/status.js';
import { CURRENCIES } from '../../constants/formOptions.js';

const T = '#00C3B5';
const NAVY = '#1B2B4B';
const fs = { borderColor:'#e2e8f0' };
const ff = e => { e.target.style.borderColor=T; e.target.style.boxShadow=`0 0 0 3px ${T}22`; };
const fb = e => { e.target.style.borderColor='#e2e8f0'; e.target.style.boxShadow='none'; };

export const Lbl = ({ c, req }) => (
  <label className="block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-brand-faint">
    {c}{req && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

export const Inp = ({ label, req, type='text', value, onChange, placeholder, disabled, mono, hint }) => (
  <div className="mb-4">
    {label && <Lbl c={label} req={req}/>}
    <input
      type={type} value={value||''} placeholder={placeholder} disabled={disabled}
      onChange={e => onChange?.(e.target.value)}
      className={`field-input${mono?' font-mono':''}`}
      style={fs} onFocus={e=>!disabled&&ff(e)} onBlur={fb}
    />
    {hint && <p className="text-xs mt-1 text-brand-faint">{hint}</p>}
  </div>
);

export const Sel = ({ label, req, value, onChange, options=[], disabled, hint }) => (
  <div className="mb-4">
    {label && <Lbl c={label} req={req}/>}
    <select
      value={value||''} disabled={disabled}
      onChange={e => onChange?.(e.target.value)}
      className="field-input cursor-pointer" style={fs}
    >
      <option value="">Select…</option>
      {options.map(o => {
        const v = typeof o==='object' ? o.value : o;
        const l = typeof o==='object' ? o.label : o;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
    {hint && <p className="text-xs mt-1 text-brand-faint">{hint}</p>}
  </div>
);

export const TA = ({ label, req, value, onChange, disabled, rows=3, hint, mono }) => (
  <div className="mb-4">
    {label && <Lbl c={label} req={req}/>}
    <textarea
      rows={rows} value={value||''} disabled={disabled}
      onChange={e => onChange?.(e.target.value)}
      className={`field-input resize-none${mono?' font-mono text-xs':''}`}
      style={fs}
    />
    {hint && <p className="text-xs mt-1 text-brand-faint">{hint}</p>}
  </div>
);

export const Btn = ({ children, onClick, variant='primary', disabled, size='md', type='button', className='' }) => {
  const styles = {
    primary: `bg-teal text-white`,
    navy:    `bg-navy text-white`,
    ghost:   `bg-white text-slate-600 border border-[#e2e8f0]`,
    danger:  `bg-red-500 text-white`,
    success: `bg-green-500 text-white`,
  };
  const sizes = { sm:'px-3 py-1.5 text-xs', md:'px-4 py-2 text-sm', lg:'px-5 py-2.5 text-sm' };
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      className={`${sizes[size]} ${styles[variant]} rounded-lg font-semibold transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ${className}`}
    >{children}</button>
  );
};

export const Card = ({ children, className='' }) => (
  <div className={`card ${className}`}>{children}</div>
);

export const SHdr = ({ c }) => (
  <div className="section-header">{c}</div>
);

export const StatusPill = ({ status }) => {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span style={{ background:s.bg, color:s.text }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold">
      <span style={{ background:s.dot }} className="w-1.5 h-1.5 rounded-full"/>
      {s.label}
    </span>
  );
};

export const Toast = ({ msg, type, onClose }) => (
  <div style={{ background: type==='error' ? '#ef4444' : '#22c55e' }}
       className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-medium">
    <span>{type==='error' ? '✕' : '✓'}</span>
    {msg}
    <button onClick={onClose} className="ml-1 opacity-60 text-lg leading-none">×</button>
  </div>
);

export const Toggle = ({ yes, no, value, onChange, disabled }) => (
  <div className="flex gap-2">
    {[yes||'Yes', no||'No'].map(opt => (
      <button key={opt} type="button" disabled={disabled} onClick={() => onChange?.(opt)}
        className="px-4 py-2 text-sm font-semibold rounded-lg border transition-all"
        style={value===opt
          ? { background:NAVY, color:'#fff', borderColor:NAVY }
          : { background:'#f8fafc', color:'#64748b', borderColor:'#e2e8f0' }}>
        {opt}
      </button>
    ))}
  </div>
);

export const MultiSelect = ({ label, req, options=[], value=[], onChange, disabled }) => {
  const toggle = v => onChange?.(value.includes(v) ? value.filter(x=>x!==v) : [...value, v]);
  return (
    <div className="mb-4">
      {label && <Lbl c={label} req={req}/>}
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const v = typeof o==='object' ? o.value||o.email : o;
          const l = typeof o==='object' ? o.label||o.name  : o;
          const sel = value.includes(v);
          return (
            <button key={v} type="button" disabled={disabled} onClick={() => toggle(v)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all"
              style={sel
                ? { background:T, color:'#fff', borderColor:T }
                : { background:'#f8fafc', color:'#64748b', borderColor:'#e2e8f0' }}>
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const CurrSel = ({ value, onChange, disabled }) => {
  const [all, setAll] = useState(false);
  const list = all ? CURRENCIES : CURRENCIES.slice(0,10);
  return (
    <div className="mb-4">
      <Lbl c="Billing currency" req/>
      <select value={value||'INR'} disabled={disabled} onChange={e=>!disabled&&onChange?.(e.target.value)}
        className="field-input cursor-pointer" style={fs}>
        {list.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.sym})</option>)}
      </select>
      {!disabled && (
        <button type="button" onClick={()=>setAll(a=>!a)}
          className="text-xs mt-1 font-medium" style={{ color:T }}>
          {all ? '▲ Show fewer' : '▼ Show all global currencies'}
        </button>
      )}
    </div>
  );
};

export const FileUpload = ({ label, req, value, onChange, disabled, hint }) => {
  const handleFile = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Only PDF files are accepted.'); return; }
    if (file.size > 10 * 1024 * 1024)   { alert('File must be under 10 MB.'); return; }
    const reader = new FileReader();
    reader.onload = ev => onChange?.({ name:file.name, size:file.size, data:ev.target.result });
    reader.readAsDataURL(file);
  };
  return (
    <div className="mb-4">
      {label && <Lbl c={label} req={req}/>}
      {value ? (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-green-50 border-green-200">
          <span className="text-green-700 font-medium text-sm">📎 {value.name}</span>
          <span className="text-green-500 text-xs">{(value.size/1024).toFixed(0)} KB</span>
          {!disabled && (
            <button type="button" onClick={() => onChange?.(null)}
              className="ml-auto text-xs text-red-500 font-medium">Remove</button>
          )}
        </div>
      ) : (
        <label className={`flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border-2 border-dashed transition-all cursor-pointer ${disabled?'opacity-50 cursor-default':'hover:border-teal hover:bg-teal-light/30'}`}
               style={{ borderColor:'#e2e8f0' }}>
          <span className="text-2xl">📄</span>
          <span className="text-sm font-medium text-brand-muted">Click to upload PDF</span>
          <span className="text-xs text-brand-faint">PDF only · Max 10 MB</span>
          {!disabled && <input type="file" accept="application/pdf" className="hidden" onChange={handleFile}/>}
        </label>
      )}
      {hint && <p className="text-xs mt-1 text-brand-faint">{hint}</p>}
    </div>
  );
};

export const ErrorBanner = ({ errors }) => {
  if (!errors?.length) return null;
  return (
    <div className="mb-4 p-3 rounded-xl text-sm font-medium bg-red-50 text-red-700 border border-red-200">
      <p className="font-bold mb-1">⚠️ Please fix the following:</p>
      <ul className="list-disc list-inside space-y-0.5">
        {errors.map((e,i) => <li key={i}>{e}</li>)}
      </ul>
    </div>
  );
};
export const MultiFileUpload = ({ label, value=[], onChange, disabled, hint }) => {
  const handleFile = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { alert('Only PDF files are accepted.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('File must be under 10 MB.'); return; }
    const reader = new FileReader();
    reader.onload = ev => onChange?.([...value, { name:file.name, size:file.size, data:ev.target.result }]);
    reader.readAsDataURL(file);
    e.target.value = '';
  };
  const remove = idx => onChange?.(value.filter((_,i) => i !== idx));
  return (
    <div className="mb-4">
      {label && <Lbl c={label}/>}
      {value.length > 0 && (
        <div className="space-y-2 mb-3">
          {value.map((f,i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-600 font-medium text-sm flex-1">📎 {f.name}</span>
              <span className="text-xs text-brand-faint">{(f.size/1024).toFixed(0)} KB</span>
              {!disabled && <button type="button" onClick={()=>remove(i)} className="text-xs text-red-500 font-medium">Remove</button>}
            </div>
          ))}
        </div>
      )}
      {!disabled && (
        <label className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 cursor-pointer hover:border-teal hover:bg-teal-light/20 transition-all">
          <span className="text-lg">📄</span>
          <div>
            <span className="text-sm font-medium text-brand-muted">Click to attach a PDF</span>
            <span className="text-xs text-brand-faint ml-2">PDF only · Max 10 MB each</span>
          </div>
          <input type="file" accept="application/pdf" className="hidden" onChange={handleFile}/>
        </label>
      )}
      {hint && <p className="text-xs mt-1 text-brand-faint">{hint}</p>}
    </div>
  );
};
