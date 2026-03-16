import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getProfile } from '../lib/supabase';

const AuthContext = createContext(null);

// Allowed email domain
const ALLOWED_DOMAIN = 'leucinetech.com';

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadProfile(session.user);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadProfile(session.user);
      else { setUser(null); setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(authUser) {
    setUser(authUser);
    try {
      const p = await getProfile(authUser.id);
      setProfile(p);
    } catch {
      setProfile({ id: authUser.id, email: authUser.email, role: 'dm' });
    }
    setLoading(false);
  }

  // Role helpers
  const isAdmin      = () => profile?.role === 'admin';
  const isDM         = () => profile?.role === 'dm';
  const isLeadership = () => profile?.role === 'leadership';
  const canEdit      = () => profile?.role === 'admin' || profile?.role === 'dm';

  // Check if user can edit a specific project
  const canEditProject = (project) => {
    if (!profile) return false;
    if (isAdmin()) return true;
    if (isDM() && project?.dm_id === profile.id) return true;
    return false;
  };

  const value = {
    user,
    profile,
    loading,
    isAdmin,
    isDM,
    isLeadership,
    canEdit,
    canEditProject,
    ALLOWED_DOMAIN,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
