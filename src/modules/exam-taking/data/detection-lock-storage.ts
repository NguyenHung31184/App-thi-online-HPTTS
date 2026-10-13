const key = (attemptId: string) => `exam_ai_locks_${attemptId}`;

/** Violation kinds this tab left locked for the attempt; empty when nothing is stored or storage is blocked. */
export function readDetectionLocks(attemptId: string): string[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key(attemptId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((kind): kind is string => typeof kind === 'string') : [];
  } catch {
    return [];
  }
}

export function writeDetectionLocks(attemptId: string, kinds: readonly string[]): void {
  try {
    if (kinds.length > 0) sessionStorage.setItem(key(attemptId), JSON.stringify(kinds));
    else sessionStorage.removeItem(key(attemptId));
  } catch {
    /* storage blocked: a reload starts unlocked, as it did before */
  }
}
