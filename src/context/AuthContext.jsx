import { createContext, useContext, useState, useCallback } from 'react';
import { resolveRole, getUserByEmail, ALLOWED_DOMAINS } from '../constants/users.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { email, name, picture, role, accessToken, slackId }

  /** Called by GoogleLogin component after JWT decode */
  const handleCredential = useCallback((credential, selectedRole) => {
    try {
      // Decode JWT payload (client-side only — sufficient for this app)
      const payload = JSON.parse(atob(credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      const { email, name, picture, hd, email_verified } = payload;

      // Domain check
      if (!email_verified) return { ok:false, reason:'Email not verified by Google.' };
      if (!ALLOWED_DOMAINS.includes(hd))
        return { ok:false, reason:`Only @gofynd.com and @fynd.team accounts are permitted.` };

      // Role check
      const detectedRole = resolveRole(email);
      if (!detectedRole)
        return { ok:false, reason:'Your account is not on the authorised user list.' };

      // Universal bypasses role selection; others must select matching role
      const finalRole = detectedRole === 'universal' ? (selectedRole || 'finance') : detectedRole;
      if (detectedRole !== 'universal' && selectedRole && selectedRole !== detectedRole)
        return { ok:false, reason:`Your account is not authorised for the ${selectedRole} role.` };

      const dbUser = getUserByEmail(email);
      setUser({ email, name, picture, role: finalRole, isUniversal: detectedRole === 'universal',
                slackId: dbUser?.slack || '', empId: dbUser?.id || '' });
      return { ok:true };
    } catch(e) {
      console.error('Auth error', e);
      return { ok:false, reason:'Authentication failed. Please try again.' };
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
