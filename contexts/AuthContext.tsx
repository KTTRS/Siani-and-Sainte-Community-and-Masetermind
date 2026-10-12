import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, onAuthStateChange } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface UserConsent {
  shareConversations: boolean;
  shareLocation: boolean;
  allowNotifications: boolean;
  allowLeaderboard: boolean;
}

interface UserProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  xp: number;
  level: number;
  currentStreak: number;
  userType: 'member' | 'icon' | 'chw' | 'admin';
  isVerified: boolean;
  onboardingComplete: boolean;
  consent?: UserConsent | null;
  termsAcceptedAt?: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, displayName?: string, userType?: string, realName?: string, zipCode?: string, consent?: UserConsent, termsAccepted?: boolean) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  }, []);

  const syncUser = useCallback(async (
    accessToken: string,
    email: string,
    displayName?: string,
    realName?: string,
    zipCode?: string,
    consent?: UserConsent,
    termsAccepted?: boolean,
  ) => {
    try {
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email, displayName, realName, zipCode, consent, termsAccepted }),
      });
    } catch (error) {
      console.error('Failed to sync user:', error);
    }
  }, []);

  const syncAndFetchProfile = useCallback(async (session: Session) => {
    if (!session?.access_token) return;
    
    // First try to fetch profile
    const response = await fetch('/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      setProfile(data);
    } else if (response.status === 404) {
      // Profile doesn't exist, create it via sync
      const email = session.user?.email;
      const displayName = session.user?.user_metadata?.display_name;
      
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email, displayName }),
      });
      
      // Fetch the newly created profile
      const newResponse = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (newResponse.ok) {
        const data = await newResponse.json();
        setProfile(data);
      }
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        syncAndFetchProfile(session);
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        syncAndFetchProfile(session);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [syncAndFetchProfile]);

  const signUp = async (
    email: string,
    password: string,
    displayName?: string,
    userType: string = 'member',
    realName?: string,
    zipCode?: string,
    consent?: UserConsent,
    termsAccepted?: boolean,
  ) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
            user_type: userType,
            real_name: realName,
            zip_code: zipCode,
            consent,
            terms_accepted: termsAccepted ?? false,
            terms_accepted_at: termsAccepted ? new Date().toISOString() : null,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        await syncUser(data.session.access_token, email, displayName, realName, zipCode, consent, termsAccepted);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      if (data.session) {
        await syncUser(data.session.access_token, email);
        await fetchProfile(data.session.access_token);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
  };

  const refreshProfile = async () => {
    if (session?.access_token) {
      await fetchProfile(session.access_token);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        isAuthenticated: !!session && !!profile,
        signUp,
        signIn,
        signOut,
        resetPassword,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useRequireAuth(allowedRoles?: string[]) {
  const { isAuthenticated, profile, isLoading } = useAuth();
  
  const hasAccess = isAuthenticated && (
    !allowedRoles || 
    (profile && allowedRoles.includes(profile.userType))
  );

  return { isAuthenticated, hasAccess, isLoading, profile };
}
