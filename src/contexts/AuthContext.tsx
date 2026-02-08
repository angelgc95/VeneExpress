import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/types/shipping';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  approved: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  approved: false,
  isAdmin: false,
  isStaff: false,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      const [roleRes, profileRes] = await Promise.all([
        (supabase as any).from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        (supabase as any).from('profiles').select('approved').eq('user_id', userId).maybeSingle(),
      ]);
      if (roleRes.data) setRole(roleRes.data.role as AppRole);
      if (profileRes.data) setApproved(profileRes.data.approved === true);
    } catch (e) {
      console.error('Error fetching user data:', e);
    }
  };

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
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      role,
      approved,
      isAdmin: role === 'admin' && approved,
      isStaff: (role === 'staff' || role === 'admin') && approved,
      loading,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
