import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types/shipping';
import type { LanguageCode } from '@/lib/i18n';
import { resolveHighestRole } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  approved: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  language: LanguageCode;
  loading: boolean;
  signOut: () => Promise<void>;
  setLanguagePreference: (language: LanguageCode) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  approved: false,
  isAdmin: false,
  isStaff: false,
  language: 'en',
  loading: true,
  signOut: async () => {},
  setLanguagePreference: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [approved, setApproved] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      const [rolesRes, profileRes] = await Promise.all([
        (supabase as any).from('user_roles').select('role').eq('user_id', userId),
        (supabase as any).from('profiles').select('approved, preferred_language').eq('user_id', userId).maybeSingle(),
      ]);

      if (rolesRes.error) {
        console.error('Error fetching user roles:', rolesRes.error);
      }

      const nextRole = resolveHighestRole(
        ((rolesRes.data as Array<{ role: AppRole }> | null) ?? []).map(({ role }) => role),
      );
      setRole(nextRole);

      if (profileRes.data) {
        setApproved(profileRes.data.approved === true);
        setLanguage((profileRes.data.preferred_language as LanguageCode) || 'en');
      } else {
        setApproved(false);
        setLanguage('en');
      }
    } catch (e) {
      console.error('Error fetching user data:', e);
    }
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Defer to avoid auth deadlock
        setTimeout(() => {
          if (isMounted) fetchUserData(session.user.id);
        }, 0);
      } else {
        setRole(null);
        setApproved(false);
        setLanguage('en');
      }
    });

    // Initial load: wait for full data before clearing loading
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRole(null);
    setApproved(false);
    setLanguage('en');
  };

  const setLanguagePreference = async (nextLanguage: LanguageCode) => {
    if (!user) return;

    const previousLanguage = language;
    setLanguage(nextLanguage);

    const { error } = await (supabase as any)
      .from('profiles')
      .update({ preferred_language: nextLanguage })
      .eq('user_id', user.id);

    if (error) {
      setLanguage(previousLanguage);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      role,
      approved,
      isAdmin: role === 'admin' && approved,
      isStaff: (role === 'staff' || role === 'admin') && approved,
      language,
      loading,
      signOut,
      setLanguagePreference,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
