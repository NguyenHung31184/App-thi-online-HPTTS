import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { User, UserRole } from '../types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  setStudentInfo: (studentId: string, studentCode: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_STUDENT_ID = 'exam_student_id';
const STORAGE_STUDENT_CODE = 'exam_student_code';

function getRoleFromRaw(raw: unknown): UserRole {
  if (raw === 'admin' || raw === 'teacher' || raw === 'proctor') return raw;
  return 'student';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const mapSupabaseUser = useCallback((u: SupabaseUser | null): User | null => {
    if (!u) return null;
    const role = getRoleFromRaw((u.user_metadata as Record<string, unknown>)?.role);
    const studentId = sessionStorage.getItem(STORAGE_STUDENT_ID) ?? undefined;
    const studentCode = sessionStorage.getItem(STORAGE_STUDENT_CODE) ?? undefined;
    return {
      id: u.id,
      email: u.email ?? undefined,
      role,
      name: (u.user_metadata?.name as string) ?? u.email ?? undefined,
      student_id: studentId,
      student_code: studentCode,
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ? mapSupabaseUser(s.user) : null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ? mapSupabaseUser(s.user) : null);
    });

    return () => subscription.unsubscribe();
  }, [mapSupabaseUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!isSupabaseConfigured()) return { error: 'Chưa cấu hình Supabase.' };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem(STORAGE_STUDENT_ID);
    sessionStorage.removeItem(STORAGE_STUDENT_CODE);
  }, []);

  const setStudentInfo = useCallback((studentId: string, studentCode: string) => {
    sessionStorage.setItem(STORAGE_STUDENT_ID, studentId);
    sessionStorage.setItem(STORAGE_STUDENT_CODE, studentCode);
    setUser((prev) =>
      prev ? { ...prev, student_id: studentId, student_code: studentCode } : null
    );
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    signIn,
    signOut,
    setStudentInfo,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
