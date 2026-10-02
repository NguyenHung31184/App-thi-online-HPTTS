import type { StudentSession, User, UserRole } from '../../../types';
import { teacherCanOpen } from './admin-access';

/**
 * Exam app role from `profiles.exam_role`, which only the management app sets. `user_metadata` is editable by the user
 * and `satellite_role` belongs to Sổ chuyên cần, so neither counts.
 */
export function roleFromExamRole(raw: unknown): UserRole {
  if (raw === 'admin' || raw === 'teacher' || raw === 'proctor') return raw;
  return 'student';
}

/** A student code signs in as `<code>@hptts.vn`; anything with "@" is used as is. */
export function loginEmail(username: string): string {
  const trimmed = username.trim();
  return trimmed.includes('@') ? trimmed : `${trimmed}@hptts.vn`;
}

/** Staff go to the admin dashboard; students go to the CCCD check before any exam. */
export function landingPathAfterLogin(role: UserRole | undefined): string {
  return role === 'admin' || role === 'teacher' || role === 'proctor' ? '/admin/dashboard' : '/verify-cccd';
}

export type GuardResult = { kind: 'loading' } | { kind: 'redirect'; to: string } | { kind: 'allow' };

/** Admin area: admins everywhere, teachers in their sections, everyone else out. Proctors are sent to /dashboard. */
export function adminAreaAccess(state: { loading: boolean; user: Pick<User, 'role'> | null; pathname: string }): GuardResult {
  if (state.loading) return { kind: 'loading' };
  if (!state.user) return { kind: 'redirect', to: '/login' };
  const role = state.user.role;
  if (role !== 'admin' && role !== 'teacher') return { kind: 'redirect', to: '/dashboard' };
  if (role === 'teacher' && !teacherCanOpen(state.pathname)) return { kind: 'redirect', to: '/admin/dashboard' };
  return { kind: 'allow' };
}

/** Student area: a signed-in user or a CCCD student session. */
export function studentAreaAccess(state: { loading: boolean; user: unknown; studentSession: StudentSession | null }): GuardResult {
  if (state.loading) return { kind: 'loading' };
  if (!state.user && !state.studentSession) return { kind: 'redirect', to: '/start' };
  return { kind: 'allow' };
}
