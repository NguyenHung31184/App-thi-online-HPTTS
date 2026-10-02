export { AuthProvider, useAuth, type AuthContextValue } from './queries/auth-context';
export { adminAreaAccess, landingPathAfterLogin, loginEmail, studentAreaAccess, type GuardResult } from './domain/access';
export { teacherCanOpen } from './domain/admin-access';
export { verifyCccdForExam } from './application/session';
