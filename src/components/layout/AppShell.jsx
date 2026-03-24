import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const NAVY = '#1B2B4B';
const T    = '#00C3B5';

const ROLE_COLOR = { sales:NAVY, revops:'#7c3aed', finance:T, universal:'#ef4444' };

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { pathname }     = useLocation();
  const navigate         = useNavigate();

  const navItems = [
    { to:'/dashboard',   lbl:'Dashboard' },
    { to:'/repository',  lbl:'Repository' },
    ...(user?.role === 'finance' || user?.isUniversal ? [{ to:'/signed', lbl:'Signed OFs' }] : []),
    ...(user?.role === 'revops'  || user?.isUniversal ? [{ to:'/churn-void', lbl:'Churn / Void Request' }] : []),
  ];

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="flex min-h-screen bg-[#F7F8FC]">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col" style={{ background:NAVY }}>
        {/* Logo */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
              <path d="M50 8C28 8 12 26 12 48C12 70 33 87 50 96C67 87 88 70 88 48C88 26 72 8 50 8Z"
                    stroke="white" strokeWidth="6" fill="none"/>
              <path d="M37 48L50 33L63 48L54.5 57L54.5 72L45.5 72L45.5 57Z" fill="white"/>
            </svg>
            <div className="text-white font-black text-xl tracking-tight">Fynd</div>
          </div>
          <div className="text-[11px] mt-1" style={{ color:'rgba(255,255,255,0.35)' }}>OF Platform</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {navItems.map(it => (
            <Link key={it.to} to={it.to}
              className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={pathname.startsWith(it.to)
                ? { background:'rgba(255,255,255,0.12)', color:'#fff' }
                : { color:'rgba(255,255,255,0.45)' }}>
              {it.lbl}
            </Link>
          ))}
          {(user?.role === 'sales' || user?.isUniversal) && (
            <Link to="/form/new"
              className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={pathname === '/form/new'
                ? { background:'rgba(255,255,255,0.12)', color:'#fff' }
                : { color:'rgba(255,255,255,0.45)' }}>
              + New Order Form
            </Link>
          )}
        </nav>

        {/* User block */}
        <div className="p-4 border-t" style={{ borderColor:'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2.5 mb-3">
            {user?.picture
              ? <img src={user.picture} alt="" className="w-8 h-8 rounded-full object-cover shrink-0"/>
              : <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                     style={{ background: ROLE_COLOR[user?.role] || NAVY }}>
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
          <button onClick={handleLogout}
            className="text-[11px] hover:text-white transition-colors"
            style={{ color:'rgba(255,255,255,0.35)' }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
