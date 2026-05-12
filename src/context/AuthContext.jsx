import { createContext, useContext, useState, useCallback } from 'react';
import { resolveRole, getUserByEmail, ALLOWED_DOMAINS } from '../constants/users.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const handleCredential = useCallback((credential, selectedRole) => {
    try {
      const payload = JSON.parse(atob(credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      const { email, name, picture, hd, email_verified } = payload;

      if (!email_verified)
        return { ok: false, reason: 'Email not verified by Google.' };
      if (!ALLOWED_DOMAINS.includes(hd))
        return { ok: false, reason: 'Only @gofynd.com and @fynd.team accounts are permitted.' };

      const detectedRole = resolveRole(email);

      // Not in any list and not gofynd.com → no access screen
      if (!detectedRole)
        return { ok: false, reason: 'no_access', email };

      // gofynd.com but not in any list → viewer (read-only, no role selection needed)
      if (detectedRole === 'viewer') {
        setUser({ email, name, picture, role: 'viewer', isUniversal: false, slackId: '', empId: '' });
        return { ok: true };
      }

      // Universal bypasses role selection; others must select matching role
      const finalRole = detectedRole === 'universal' ? (selectedRole || 'finance') : detectedRole;
      if (detectedRole !== 'universal' && selectedRole && selectedRole !== detectedRole)
        return { ok: false, reason: `Your account is not authorised for the ${selectedRole} role.` };

      const dbUser = getUserByEmail(email);
      setUser({
        email, name, picture, role: finalRole,
        isUniversal: detectedRole === 'universal',
        slackId: dbUser?.slack || '', empId: dbUser?.id || '',
      });
      return { ok: true };
    } catch (e) {
      console.error('Auth error', e);
      return { ok: false, reason: 'Authentication failed. Please try again.' };
    }
  }, []);

  const logout = useCallback(() => {
    if (window.google?.accounts?.id) window.google.accounts.id.revoke(user?.email, () => {});
    setUser(null);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, handleCredential, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
