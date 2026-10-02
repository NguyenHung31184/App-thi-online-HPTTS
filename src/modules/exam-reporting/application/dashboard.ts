import { selectDashboardSources, selectRecentCompletedAttempts } from '../data/dashboard-repository';
import { selectReportDirectory } from '../data/directory-repository';
import { countViolations, summarizeAttempts, type AdminDashboardStats } from '../domain/dashboard-stats';
import { toRecentAttemptRow, type DashboardRecentAttemptRow } from '../domain/recent-attempts';

const presentIds = (ids: (string | null | undefined)[]) => [...new Set(ids.filter((id): id is string => typeof id === 'string'))];

/** Latest completed attempts (1–200, default 80) for staff. */
export async function listRecentCompletedAttemptsForDashboard(limit: number): Promise<DashboardRecentAttemptRow[]> {
  const cap = Math.min(200, Math.max(1, Math.floor(limit) || 80));
  const rows = await selectRecentCompletedAttempts(cap);
  const directory = await selectReportDirectory(
    presentIds(rows.map((r) => r.user_id)),
    presentIds(rows.map((r) => r.exam_windows?.class_id)),
  );
  return rows.map((r) => toRecentAttemptRow(r, directory));
}

/** Open windows now, completed attempts of today and the last 7 days, signals of the last 24 h, sync failures today. */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sources = await selectDashboardSources(now, startOfToday.getTime());
  return {
    openWindowsToday: sources.openWindows,
    ...summarizeAttempts(sources.attempts, startOfToday.getTime()),
    violationsLast24h: countViolations(sources.auditEvents),
    syncFailedToday: sources.syncFailures,
  };
}
