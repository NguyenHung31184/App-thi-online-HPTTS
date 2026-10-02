import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../../platform/supabase/client';

/** The signed-in account as the rest of the module sees it. */
export interface AuthAccount {
  id: string;
  email?: string;
  name?: string;
}

const accountOf = (u: SupabaseUser): AuthAccount => ({
  id: u.id,
  email: u.email ?? undefined,
  name: (u.user_metadata?.name as string) ?? u.email ?? undefined,
});

export const authConfigured = (): boolean => isSupabaseConfigured();

/** The stored session's account; an unreadable session is signed out (`error: true`). */
export async function readSessionAccount(): Promise<{ account: AuthAccount | null; error: boolean }> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    void supabase.auth.signOut();
    return { account: null, error: true };
  }
  return { account: data.session?.user ? accountOf(data.session.user) : null, error: false };
}

/**
 * Calls back on every session change. Supabase holds its session lock during the callback and a query made inside it
 * can deadlock, so a signed-in account is passed on in a fresh task.
 */
export function watchSessionAccount(onChange: (account: AuthAccount | null) => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      const next = accountOf(session.user);
      setTimeout(() => onChange(next), 0);
    } else {
      onChange(null);
    }
  });
  return () => subscription.unsubscribe();
}

export async function signInWithPassword(email: string, password: string): Promise<{ error?: string; account?: AuthAccount | null }> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { account: data.session?.user ? accountOf(data.session.user) : null };
}

export async function signOutSession(): Promise<void> {
  await supabase.auth.signOut();
}

export async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
