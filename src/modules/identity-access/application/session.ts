import type { OcrCccdResult, StudentSession, User, VerifyCccdResponse } from '../../../types';
import {
  authConfigured, readSessionAccount, signInWithPassword, signOutSession, watchSessionAccount, type AuthAccount,
} from '../data/auth-session';
import { callVerifyCccd } from '../data/cccd-check';
import { selectMyProfile, updateMyStudentId } from '../data/profile-repository';
import { clearStudentSession, loadStudentSession, saveStudentSession, storedStudentIds } from '../data/student-session-storage';
import { roleFromExamRole } from '../domain/access';
import { normalizeCccd, studentSessionOf, verifyRequest } from '../domain/cccd';

export { authConfigured, loadStudentSession, readSessionAccount, watchSessionAccount };
export type { AuthAccount };

/** The app user for an account: role and TTDT student from the profile, falling back to this tab's CCCD session. */
export async function userOfAccount(account: AuthAccount): Promise<User> {
  const stored = storedStudentIds();
  let role: User['role'] = 'student';
  let studentId = stored.studentId;
  try {
    const profile = await selectMyProfile();
    if (profile) {
      role = roleFromExamRole(profile.exam_role);
      if (profile.student_id) studentId = profile.student_id;
    }
  } catch {
    // The profile can be unreadable offline or under RLS; the user stays a student.
  }
  return { id: account.id, email: account.email, role, name: account.name, student_id: studentId, student_code: stored.studentCode };
}

export async function signIn(email: string, password: string): Promise<{ error?: string; user?: User | null }> {
  if (!authConfigured()) return { error: 'Chưa cấu hình Supabase.' };
  const result = await signInWithPassword(email, password);
  if (result.error) return { error: result.error };
  return { user: result.account ? await userOfAccount(result.account) : null };
}

/** Signs out of Supabase and forgets this tab's CCCD session. */
export async function signOut(): Promise<void> {
  await signOutSession();
  clearStudentSession();
}

/** Keeps the verified student for this tab and links the account to them; a failed link does not stop the student. */
export function rememberVerifiedStudent(
  studentId: string,
  studentCode: string,
  studentName?: string,
  extras?: { student_dob?: string; id_card_number?: string },
): StudentSession {
  const session = studentSessionOf(studentId, studentCode, studentName, extras);
  saveStudentSession(session);
  updateMyStudentId(studentId).catch(() => {});
  return session;
}

/** The server check of a CCCD read from the card or typed in. */
export async function verifyCccdForExam(
  card: OcrCccdResult,
  examAccountEmail: string | undefined,
): Promise<{ success: boolean; data?: VerifyCccdResponse; error?: string }> {
  const request = verifyRequest(card, examAccountEmail);
  const idCardNumber = normalizeCccd(request.id_card_number);
  if (!idCardNumber) return { success: false, error: 'Số CCCD không được để trống.' };
  return callVerifyCccd({ ...request, id_card_number: idCardNumber });
}
