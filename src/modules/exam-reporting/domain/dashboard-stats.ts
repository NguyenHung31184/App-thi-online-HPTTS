import { DEFAULT_PASS_THRESHOLD } from './report-rows';

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

export interface DashboardAttempt {
  completed_at: number | null;
  score: number | null;
  disqualified: boolean | null;
  exams?: { pass_threshold?: number | null } | null;
}

/** Completed attempts of the last 7 days, counted per day (UTC date key) and for today (local midnight). */
export function summarizeAttempts(attempts: DashboardAttempt[], startOfToday: number) {
  const perDay = new Map<string, AttemptsPerDay>();
  let attemptsToday = 0;
  let attemptsLast7Days = 0;
  let passedCount = 0;

  for (const a of attempts) {
    if (!a.completed_at) continue;
    const ts = typeof a.completed_at === 'number' ? a.completed_at : Number(a.completed_at);
    const key = new Date(ts).toISOString().slice(0, 10);
    const threshold = a.exams?.pass_threshold ?? DEFAULT_PASS_THRESHOLD;
    // A missing score counts as 0, so it passes only when the threshold is 0.
    const passed = !a.disqualified && (a.score ?? 0) >= threshold;

    attemptsLast7Days += 1;
    if (ts >= startOfToday) attemptsToday += 1;
    if (passed) passedCount += 1;

    const day = perDay.get(key) ?? { date: key, completed: 0, passed: 0, failedOrDisqualified: 0 };
    day.completed += 1;
    if (passed) day.passed += 1;
    else day.failedOrDisqualified += 1;
    perDay.set(key, day);
  }

  return {
    attemptsToday,
    attemptsLast7Days,
    passedRateLast7Days: attemptsLast7Days > 0 ? passedCount / attemptsLast7Days : 0,
    attemptsPerDay: Array.from(perDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Counts the five browser signals; AI signals and other events are not shown on the dashboard. */
export function countViolations(events: { event: string }[]): ViolationCounts {
  const counts: ViolationCounts = { focus_lost: 0, visibility_hidden: 0, fullscreen_exited: 0, copy_paste_blocked: 0, photo_taken: 0 };
  for (const { event } of events) {
    if (event in counts) counts[event as keyof ViolationCounts] += 1;
  }
  return counts;
}

/** Recent completed attempts split into passed, failed and disqualified. */
export function passFailCounts(rows: { passed: boolean; disqualified: boolean }[]) {
  let passed = 0;
  let failed = 0;
  let disqualified = 0;
  for (const r of rows) {
    if (r.disqualified) disqualified++;
    else if (r.passed) passed++;
    else failed++;
  }
  return { passed, failed, disqualified, total: rows.length || 1 };
}
