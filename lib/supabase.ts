import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';

export const supabaseConfigError: string | null =
  !supabaseUrl
    ? 'VITE_SUPABASE_URL is not set'
    : !supabaseAnonKey
      ? 'VITE_SUPABASE_ANON_KEY is not set'
      : null;

if (supabaseConfigError) {
  console.error(
    `[supabase] ${supabaseConfigError}. Auth features will fail — app will render a config notice instead of a blank screen.`,
  );
}

function makeStub(): SupabaseClient {
  const err = () => {
    throw new Error(supabaseConfigError ?? 'Supabase not configured');
  };
  const authStub = {
    signUp: err,
    signInWithPassword: err,
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: err,
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: (_cb: unknown) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
  };
  return { auth: authStub } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = supabaseConfigError
  ? makeStub()
  : createClient(supabaseUrl as string, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });

export type AuthError = {
  message: string;
  status?: number;
};

export async function signUp(email: string, password: string, displayName?: string, userType: string = 'member') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        user_type: userType,
      },
    },
  });

  if (error) {
    throw { message: error.message, status: error.status } as AuthError;
  }

  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw { message: error.message, status: error.status } as AuthError;
  }

  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw { message: error.message, status: error.status } as AuthError;
  }
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw { message: error.message, status: error.status } as AuthError;
  }
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    throw { message: error.message, status: error.status } as AuthError;
  }
  return session;
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    throw { message: error.message, status: error.status } as AuthError;
  }
  return user;
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
