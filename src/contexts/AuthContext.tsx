import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getMyProfile, updateMyStudentId } from '../services/profileService';
import type { User, UserRole } from '../types';

const STORAGE_STUDENT_ID = 'exam_student_id';
const STORAGE_STUDENT_CODE = 'exam_student_code';

function getRoleFromRaw(raw: unknown): UserRole {
  if (raw === 'admin' || raw === 'teacher' || raw === 'proctor') return raw;
  return 'student';
}

async function mapUserWithProfile(u: SupabaseUser): Promise<User | null> {
  const studentIdStorage = sessionStorage.getItem(STORAGE_STUDENT_ID) ?? undefined;
  const studentCodeStorage = sessionStorage.getItem(STORAGE_STUDENT_CODE) ?? undefined;
  let role: UserRole = getRoleFromRaw((u.user_metadata as Record<string, unknown>)?.role);
  let studentId = studentIdStorage;
  try {
    const profile = await getMyProfile();
    if (profile) {
      role = getRoleFromRaw(profile.role);
      if (profile.student_id) studentId = profile.student_id;
    }
  } catch (_) {}
  return {
    id: u.id,
    email: u.email ?? undefined,
    role,
    name: (u.user_metadata?.name as string) ?? u.email ?? undefined,
    student_id: studentId,
    student_code: studentCodeStorage,
  };
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  setStudentInfo: (studentId: string, studentCode: string, studentName?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const applyUser = useCallback((u: SupabaseUser | null, set: (user: User | null) => void) => {
    if (!u) {
      set(null);
      return;
    }
    mapUserWithProfile(u).then(set);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) applyUser(s.user, setUser);
      else setUser(null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) applyUser(s.user, setUser);
      else setUser(null);
    });

    return () => subscription.unsubscribe();
  }, [applyUser]);

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

  const setStudentInfo = useCallback((studentId: string, studentCode: string, studentName?: string) => {
    sessionStorage.setItem(STORAGE_STUDENT_ID, studentId);
    sessionStorage.setItem(STORAGE_STUDENT_CODE, studentCode);
    setUser((prev) =>
      prev ? { ...prev, student_id: studentId, student_code: studentCode, student_name: studentName } : null
    );
    updateMyStudentId(studentId).catch(() => {});
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
