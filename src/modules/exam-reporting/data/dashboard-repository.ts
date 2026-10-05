import { supabase } from '../../../platform/supabase/client';
import type { DashboardAttempt } from '../domain/dashboard-stats';
import type { RecentAttemptRecord } from '../domain/recent-attempts';

export async function selectRecentCompletedAttempts(limit: number): Promise<RecentAttemptRecord[]> {
  const { data, error } = await supabase
    .from('attempts')
    .select(
      'id, exam_id, window_id, started_at, completed_at, score, raw_score, total_max, disqualified, user_id, exams ( title, pass_threshold, duration_minutes ), exam_windows ( id, start_at, end_at, access_code, class_id )',
    )
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as RecentAttemptRecord[];
}

export interface DashboardSources {
  openWindows: number;
  attempts: DashboardAttempt[];
  auditEvents: { event: string }[];
  syncFailures: number;
}

/** Each source fails soft to empty, as the dashboard did before the move. */
export async function selectDashboardSources(now: number, startOfToday: number): Promise<DashboardSources> {
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  const [windowsRes, attemptsRes, violationsRes, syncFailedRes] = await Promise.all([
    supabase.from('exam_windows').select('id').eq('is_deleted', false).lte('start_at', now).gte('end_at', now),
    supabase
      .from('attempts')
      .select('completed_at, score, disqualified, exams(pass_threshold)')
      .eq('status', 'completed')
      .gte('completed_at', Math.floor(sevenDaysAgo)),
    supabase.from('attempt_audit_logs').select('event, created_at').gte('created_at', new Date(twentyFourHoursAgo).toISOString()),
    supabase
      .from('exam_sync_log')
      .select('id, created_at, status')
      .eq('status', 'failed')
      .gte('created_at', new Date(startOfToday).toISOString()),
  ]);
  return {
    openWindows: (windowsRes.data ?? []).length,
    attempts: (attemptsRes.data ?? []) as DashboardAttempt[],
    auditEvents: (violationsRes.data ?? []) as { event: string }[],
    syncFailures: (syncFailedRes.data ?? []).length,
  };
}
