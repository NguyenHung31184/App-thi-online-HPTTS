import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { StudentSession, User } from '../../../types';
import {
  authConfigured, loadStudentSession, readSessionAccount, rememberVerifiedStudent, signIn as signInAccount, signOut as signOutAccount,
  userOfAccount, watchSessionAccount, type AuthAccount,
} from '../application/session';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** CCCD student session of this tab. */
  studentSession: StudentSession | null;
  signIn: (email: string, password: string) => Promise<{ error?: string; user?: User | null }>;
  signOut: () => Promise<void>;
  setStudentInfo: (
    studentId: string,
    studentCode: string,
    studentName?: string,
    extras?: { student_dob?: string; id_card_number?: string },
  ) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentSession, setStudentSession] = useState<StudentSession | null>(() => loadStudentSession());

  // Bumped on every session change; a profile read that finishes after a newer change is dropped, so a slow request
  // cannot bring back a user who has signed out.
  const authVersion = useRef(0);

  // `loading` stays true until the role is known: a guard that sees no user once loading ends sends people to /login
  // (a reload of any admin page used to do that).
  const resolveUser = useCallback(async (account: AuthAccount | null) => {
    const version = ++authVersion.current;
    const mapped = account ? await userOfAccount(account) : null;
    if (version !== authVersion.current) return;
    setUser(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authConfigured()) {
      setLoading(false);
      return;
    }
    void readSessionAccount().then(({ account, error }) => {
      if (error) {
        authVersion.current += 1;
        setUser(null);
        setLoading(false);
        return;
      }
      void resolveUser(account);
    });
    const stop = watchSessionAccount((account) => void resolveUser(account));
    return () => {
      authVersion.current += 1;
      stop();
    };
  }, [resolveUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInAccount(email, password);
    // Set the user now so the layout does not send the user back to /start on the next navigation.
    if (result.user) setUser(result.user);
    return result;
  }, []);

  const signOut = useCallback(async () => {
    await signOutAccount();
    setStudentSession(null);
  }, []);

  const setStudentInfo = useCallback<AuthContextValue['setStudentInfo']>((studentId, studentCode, studentName, extras) => {
    setStudentSession(rememberVerifiedStudent(studentId, studentCode, studentName, extras));
    setUser((prev) => (prev ? { ...prev, student_id: studentId, student_code: studentCode, student_name: studentName } : null));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, studentSession, signIn, signOut, setStudentInfo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
