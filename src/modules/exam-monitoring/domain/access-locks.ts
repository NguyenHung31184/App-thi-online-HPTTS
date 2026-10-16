/**
 * Students entering a wrong access code at an open exam (migration 20261016110000_exam_access_unlock).
 * start_exam_attempt locks a student out of one window for 10 minutes after 5 wrong codes.
 */
export const ACCESS_LOCK_FAILURES = 5;

export interface AccessFailure {
  windowId: string;
  className: string | null;
  examTitle: string | null;
  userId: string;
  studentCode: string | null;
  studentName: string | null;
  failureCount: number;
  lastFailedAt: string;
  /** Set only when the student is locked out. */
  lockedUntil: string | null;
}

/** Whole minutes left on a lock, at least 1 while it lasts; 0 when not locked or already over. */
export function minutesLeft(lockedUntil: string | null, nowMs: number): number {
  if (!lockedUntil) return 0;
  const ms = new Date(lockedUntil).getTime() - nowMs;
  return ms > 0 ? Math.max(1, Math.ceil(ms / 60_000)) : 0;
}

/** Locked students first, then the most wrong codes. */
export function sortFailures(rows: AccessFailure[], nowMs: number): AccessFailure[] {
  return [...rows].sort((a, b) =>
    Number(minutesLeft(b.lockedUntil, nowMs) > 0) - Number(minutesLeft(a.lockedUntil, nowMs) > 0)
    || b.failureCount - a.failureCount
    || b.lastFailedAt.localeCompare(a.lastFailedAt));
}
