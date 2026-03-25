import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const NAVY = '#1B2B4B';
const T    = '#00C3B5';

const ROLES = [
  { id:'sales',   lbl:'Sales',           desc:'Submit & track Order Forms',    icon:'🤝' },
  { id:'revops',  lbl:'Business / RevOps',desc:'Review & validate submissions', icon:'🔍' },
  { id:'finance', lbl:'Finance',          desc:'Assign OF# & final approval',   icon:'💼' },
];

export default function LoginPage() {
  const { handleCredential } = useAuth();
  const [role,    setRole]   = useState('');
  const [error,   setError]  = useState('');
  const [loading, setLoading]= useState(false);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!CLIENT_ID) { setError('Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to .env'); return; }
    const init = () => {
      window.google.accounts.id.initialize({
        client_id:  CLIENT_ID,
        callback:   handleToken,
        ux_mode:    'popup',
        auto_select:false,
      });
      if (btnRef.current) {
        window.google.accounts.id.renderButton(btnRef.current, {
          theme:'outline', size:'large', text:'signin_with',
          shape:'rectangular', width: btnRef.current.offsetWidth || 300,
        });
      }
    };
    if (window.google?.accounts) init();
    else { const t = setInterval(() => { if (window.google?.accounts) { clearInterval(t); init(); } }, 200); }
  }, []); // eslint-disable-line

  const handleToken = async ({ credential }) => {
    setLoading(true); setError('');
    const result = handleCredential(credential, role);
    if (!result.ok) { setError(result.reason); setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background:`linear-gradient(135deg,${NAVY} 0%,#0d1a2e 100%)` }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">

       {/* Logo */}
<div className="mb-8">
  <img
    src={`${import.meta.env.BASE_URL}Fynd_Horizontal_Dark.svg`}
    alt="Fynd"
    className="h-10 mb-2"
  />
  <div className="text-sm mt-1 text-brand-faint">Order Form Management Platform</div>
</div>

        {/* Role selector */}
        <p className="text-xs font-bold uppercase tracking-widest mb-3 text-brand-faint">Select your role</p>
        <div className="space-y-2 mb-6">
          {ROLES.map(r => (
            <button key={r.id} onClick={() => setRole(r.id)}
              className="w-full flex items-center gap-4 p-3.5 rounded-xl border-2 text-left transition-all"
              style={role===r.id
                ? { borderColor:T, background:'#e0f7f5' }
                : { borderColor:'#f1f5f9', background:'#f8fafc' }}>
              <span className="text-xl">{r.icon}</span>
              <div>
                <div className="font-bold text-sm" style={{ color:role===r.id?NAVY:'#475569' }}>{r.lbl}</div>
                <div className="text-xs text-brand-faint">{r.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Google Sign-In button */}
        <p className="text-xs font-bold uppercase tracking-widest mb-3 text-brand-faint">Sign in with Fynd Google account</p>
        {!CLIENT_ID ? (
          <div className="text-xs text-red-500 p-3 rounded-lg bg-red-50 border border-red-200">
            ⚠️ {error || 'VITE_GOOGLE_CLIENT_ID not set in .env'}
          </div>
        ) : (
          <div ref={btnRef} className="w-full"/>
        )}

        {error && <p className="mt-3 text-sm text-red-600 font-medium text-center">{error}</p>}
        {loading && <p className="mt-3 text-sm text-brand-faint text-center">Verifying…</p>}

        <p className="mt-5 text-xs text-center text-brand-faint">
          Only authorised @gofynd.com and @fynd.team accounts can access this platform.
        </p>
      </div>
    </div>
  );
}
