export { AuthProvider, useAuth, type AuthContextValue } from './queries/auth-context';
export { adminAreaAccess, landingPathAfterLogin, loginEmail, studentAreaAccess, type GuardResult } from './domain/access';
export { teacherCanOpen } from './domain/admin-access';
export { verifyCccdForExam } from './application/session';
export { default as LoginPage } from './ui/LoginPage';
export { default as RoleSelectPage } from './ui/RoleSelectPage';
export { default as VerifyCccdPage } from './ui/verify-cccd/VerifyCccdPage';
