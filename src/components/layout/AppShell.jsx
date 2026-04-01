import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForms } from '../../context/FormsContext.jsx';

const NAVY = '#1B2B4B';
const T    = '#00C3B5';
const ROLE_COLOR = { sales:NAVY, revops:'#7c3aed', finance:T, universal:'#ef4444' };

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { forms }        = useForms();
  const { pathname }     = useLocation();
  const navigate         = useNavigate();

  // Badge counts
  const pendingRevops  = forms.filter(f => f.status==='submitted').length;
  const pendingFinance = forms.filter(f => f.status==='revops_approved').length;
  const overdueCount   = forms.filter(f => {
    if (f.status!=='approved'||f.signed_date) return false;
    const d = f.approved_at||f.submitted_at;
    return d && Math.floor((new Date()-new Date(d))/86400000)>=30;
  }).length;

  // Pending requests badge — role-specific
  const myPendingCount = user?.isUniversal
    ? forms.filter(f=>['submitted','revops_approved','revops_rejected','draft'].includes(f.status)).length
    : user?.role==='sales'
    ? forms.filter(f=>['draft','revops_rejected'].includes(f.status)&&f.sales_rep_email===user.email).length
    : user?.role==='revops'
    ? pendingRevops
    : user?.role==='finance'
    ? pendingFinance
    : 0;

  const navItems = [
    { to:'/dashboard',  lbl:'Dashboard' },
    { to:'/pending',    lbl:'Pending Requests', badge: myPendingCount > 0 ? myPendingCount : null, badgeColor:'#ef4444' },
    { to:'/repository', lbl:'Repository' },
    ...(user?.role==='finance'||user?.isUniversal ? [{
      to:'/signed', lbl:'Signed OFs',
      badge: overdueCount > 0 ? overdueCount : null, badgeColor:'#ef4444'
    }] : []),
    ...(user?.role==='revops'||user?.isUniversal  ? [{ to:'/churn-void', lbl:'Churn / Void' }] : []),
    ...(user?.isUniversal ? [
      { to:'/admin-users', lbl:'User Management' },
      { to:'/settings',    lbl:'⚙️ Settings' },
    ] : []),
  ];

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="flex min-h-screen bg-[#F7F8FC]">
      <aside className="w-56 shrink-0 flex flex-col" style={{ background:NAVY }}>
        {/* Logo */}
        <div className="p-5 pb-4">
          <img
            src={`${import.meta.env.BASE_URL}Fynd_Horizontal_Dark.svg`}
            alt="Fynd" className="h-7"
            style={{ filter:'brightness(0) invert(1)' }}
          />
          <div className="text-[11px] mt-2" style={{ color:'rgba(255,255,255,0.35)' }}>OF Platform</div>
        </div>

        {/* New OF button — all roles */}
        <div className="px-3 pb-2">
          <button onClick={() => navigate('/form/new')}
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={pathname==='/form/new'
              ? { background:'rgba(255,255,255,0.18)', color:'#fff' }
              : { background:T, color:'#fff' }}>
            + New Order Form
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {navItems.map(it => (
            <Link key={it.to} to={it.to}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={pathname.startsWith(it.to)
                ? { background:'rgba(255,255,255,0.12)', color:'#fff' }
                : { color:'rgba(255,255,255,0.45)' }}>
              <span>{it.lbl}</span>
              {it.badge > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                  style={{ background: it.badgeColor||'#f59e0b', color:'#fff' }}>
                  {it.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t" style={{ borderColor:'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5 mb-3">
            {user?.picture
              ? <img src={user.picture} alt="" className="w-8 h-8 rounded-full object-cover shrink-0"/>
              : <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                     style={{ background: ROLE_COLOR[user?.role]||NAVY }}>
                  {user?.name?.[0]?.toUpperCase()}
                </div>
            }
            <div>
              <div className="text-white text-xs font-semibold truncate w-28">{user?.name}</div>
              <div className="text-[11px] capitalize" style={{ color:'rgba(255,255,255,0.35)' }}>
                {user?.isUniversal ? 'Universal' : user?.role}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} className="text-[11px] hover:text-white transition-colors"
            style={{ color:'rgba(255,255,255,0.35)' }}>Sign out</button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
