import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getMyProfile } from '../services/profileService';
import type { User, UserRole, StudentSession } from '../types';

const STORAGE_STUDENT_ID = 'exam_student_id';
const STORAGE_STUDENT_CODE = 'exam_student_code';
const STORAGE_STUDENT_NAME = 'exam_student_name';
const STORAGE_STUDENT_DOB = 'exam_student_dob';

function getRoleFromRaw(raw: unknown): UserRole {
  if (raw === 'admin' || raw === 'teacher' || raw === 'proctor') return raw;
  return 'student';
}

async function maybeUpgradeToTeacherByInstructor(
  email: string | null | undefined,
  currentRole: UserRole
): Promise<UserRole> {
  if (!email) return currentRole;
  if (currentRole === 'admin') return currentRole;
  try {
    const { data, error } = await supabase
      .from('instructors')
      .select('specialization, is_deleted')
      // email trong instructors có thể khác hoa/thường → so sánh không phân biệt case
      .ilike('email', email)
      .limit(1)
      .maybeSingle();
    if (error || !data?.specialization) return currentRole;
    if (data.is_deleted === true) return currentRole;
    const spec = String(data.specialization).toLowerCase();
    if (spec.includes('lý thuyết') || spec.includes('ly thuyet')) {
      return 'teacher';
    }
  } catch (_) {
    // ignore
  }
  return currentRole;
}

async function mapUserWithProfile(u: SupabaseUser): Promise<User | null> {
  const studentIdStorage = sessionStorage.getItem(STORAGE_STUDENT_ID) ?? undefined;
  const studentCodeStorage = sessionStorage.getItem(STORAGE_STUDENT_CODE) ?? undefined;
  const studentNameStorage = sessionStorage.getItem(STORAGE_STUDENT_NAME) ?? undefined;
  const studentDobStorage = sessionStorage.getItem(STORAGE_STUDENT_DOB) ?? undefined;
  let role: UserRole = getRoleFromRaw((u.user_metadata as Record<string, unknown>)?.role);
  let studentId = studentIdStorage;
  try {
    const profile = await getMyProfile();
    if (profile) {
      role = getRoleFromRaw(profile.role);
      if (profile.student_id) studentId = profile.student_id;
    }
  } catch (_) {}
  // Nếu chưa phải admin mà email thuộc giảng viên có chuyên ngành Lý thuyết thì nâng role lên teacher.
  role = await maybeUpgradeToTeacherByInstructor(u.email, role);
  return {
    id: u.id,
    email: u.email ?? undefined,
    role,
    name: (u.user_metadata?.name as string) ?? u.email ?? undefined,
    student_id: studentId,
    student_code: studentCodeStorage,
    student_name: studentNameStorage,
    student_dob: studentDobStorage,
  };
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Phiên thí sinh tối giản (không cần Supabase auth). */
  studentSession: StudentSession | null;
  signIn: (email: string, password: string) => Promise<{ error?: string; user?: User | null }>;
  signOut: () => Promise<void>;
  /** Lưu thông tin thí sinh để vào thi (họ tên + ngày sinh). */
  setStudentIdentity: (studentName: string, studentDob: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentSession, setStudentSession] = useState<StudentSession | null>(null);

  const applyUser = useCallback((u: SupabaseUser | null, set: (user: User | null) => void) => {
    if (!u) {
      set(null);
      return;
    }
    mapUserWithProfile(u).then(set);
  }, []);

  // Khởi tạo phiên thí sinh từ sessionStorage (không dùng Supabase auth).
  useEffect(() => {
    const sname = sessionStorage.getItem(STORAGE_STUDENT_NAME) ?? undefined;
    const sdob = sessionStorage.getItem(STORAGE_STUDENT_DOB) ?? undefined;
    if (sname || sdob) {
      setStudentSession({
        student_name: sname,
        student_dob: sdob,
      });
    }
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
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      let mappedUser: User | null = null;
      // Cập nhật session/user ngay để Layout không redirect về /start khi navigate (tránh phải đăng nhập 2 lần).
      if (data.session?.user) {
        setSession(data.session);
        mappedUser = await mapUserWithProfile(data.session.user);
        setUser(mappedUser);
      }
      return { user: mappedUser };
    },
    [applyUser]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    sessionStorage.removeItem(STORAGE_STUDENT_ID);
    sessionStorage.removeItem(STORAGE_STUDENT_CODE);
    sessionStorage.removeItem(STORAGE_STUDENT_NAME);
    sessionStorage.removeItem(STORAGE_STUDENT_DOB);
    setStudentSession(null);
  }, []);

  const setStudentIdentity = useCallback((studentName: string, studentDob: string) => {
    const name = studentName.trim();
    const dob = studentDob.trim();
    sessionStorage.setItem(STORAGE_STUDENT_NAME, name);
    sessionStorage.setItem(STORAGE_STUDENT_DOB, dob);
    setStudentSession({
      student_name: name,
      student_dob: dob,
    });
    setUser((prev) =>
      prev ? { ...prev, student_name: name, student_dob: dob } : null
    );
    // Không cập nhật profile student_id trong chế độ tối giản.
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    studentSession,
    signIn,
    signOut,
    setStudentIdentity,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
