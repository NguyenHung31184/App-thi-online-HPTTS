import { supabase } from '../lib/supabaseClient';

export interface AttemptsPerDay {
  date: string; // YYYY-MM-DD
  completed: number;
  passed: number;
  failedOrDisqualified: number;
}

export interface ViolationCounts {
  focus_lost: number;
  visibility_hidden: number;
  fullscreen_exited: number;
  copy_paste_blocked: number;
  photo_taken: number;
}

export interface AdminDashboardStats {
  openWindowsToday: number;
  attemptsToday: number;
  attemptsLast7Days: number;
  passedRateLast7Days: number; // 0–1
  attemptsPerDay: AttemptsPerDay[];
  violationsLast24h: ViolationCounts;
  syncFailedToday: number;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  const [windowsRes, attemptsRes, violationsRes, syncFailedRes] = await Promise.all([
    supabase
      .from('exam_windows')
      .select('id')
      .lte('start_at', now)
      .gte('end_at', now),
    supabase
      .from('attempts')
      .select('completed_at, score, disqualified, exams(pass_threshold)')
      .eq('status', 'completed')
      .gte('completed_at', Math.floor(sevenDaysAgo)),
    supabase
      .from('attempt_audit_logs')
      .select('event, created_at')
      .gte('created_at', new Date(twentyFourHoursAgo).toISOString()),
    supabase
      .from('exam_sync_log')
      .select('id, created_at, status')
      .eq('status', 'failed')
      .gte('created_at', startOfToday.toISOString()),
  ]);

  const openWindowsToday = (windowsRes.data ?? []).length;

  const attempts = (attemptsRes.data ?? []) as {
    completed_at: number | null;
    score: number | null;
    disqualified: boolean | null;
    exams?: { pass_threshold?: number | null } | null;
  }[];

  const attemptsPerDayMap = new Map<string, AttemptsPerDay>();
  let attemptsToday = 0;
  let attemptsLast7Days = 0;
  let passedCount = 0;

  attempts.forEach((a) => {
    if (!a.completed_at) return;
    const ts = typeof a.completed_at === 'number' ? a.completed_at : Number(a.completed_at);
    const d = new Date(ts);
    const key = d.toISOString().slice(0, 10);
    const isToday = ts >= startOfToday.getTime();
    const threshold = a.exams?.pass_threshold ?? 0.7;
    const score = a.score ?? 0;
    const passed = !a.disqualified && score >= threshold;

    attemptsLast7Days += 1;
    if (isToday) attemptsToday += 1;
    if (passed) passedCount += 1;

    const existing =
      attemptsPerDayMap.get(key) ??
      {
        date: key,
        completed: 0,
        passed: 0,
        failedOrDisqualified: 0,
      };
    existing.completed += 1;
    if (passed) existing.passed += 1;
    else existing.failedOrDisqualified += 1;
    attemptsPerDayMap.set(key, existing);
  });

  const attemptsPerDay = Array.from(attemptsPerDayMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const passedRateLast7Days = attemptsLast7Days > 0 ? passedCount / attemptsLast7Days : 0;

  const violations = (violationsRes.data ?? []) as { event: string }[];
  const violationsLast24h: ViolationCounts = {
    focus_lost: 0,
    visibility_hidden: 0,
    fullscreen_exited: 0,
    copy_paste_blocked: 0,
    photo_taken: 0,
  };
  violations.forEach((v) => {
    if (v.event in violationsLast24h) {
      // @ts-expect-error dynamic key
      violationsLast24h[v.event] += 1;
    }
  });

  const syncFailedToday = (syncFailedRes.data ?? []).length;

  return {
    openWindowsToday,
    attemptsToday,
    attemptsLast7Days,
    passedRateLast7Days,
    attemptsPerDay,
    violationsLast24h,
    syncFailedToday,
  };
}

