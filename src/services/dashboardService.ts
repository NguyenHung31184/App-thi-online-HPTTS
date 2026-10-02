/** Moved to the exam-reporting module; kept as re-exports until the dashboards move (phase 2). */
export {
  getAdminDashboardStats, listRecentCompletedAttemptsForDashboard,
  type AdminDashboardStats, type AttemptsPerDay, type DashboardRecentAttemptRow, type ViolationCounts,
} from '../modules/exam-reporting/public';
