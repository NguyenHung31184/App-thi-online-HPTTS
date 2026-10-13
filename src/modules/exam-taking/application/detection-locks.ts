import { readDetectionLocks, writeDetectionLocks } from '../data/detection-lock-storage';
import { AI_VIOLATION_KINDS, type AiViolationKind } from '../domain/proctoring-policy';

/**
 * Kinds whose incident was already recorded and has not cleared yet. Kept per tab so that reloading the page
 * during a violation does not record the same violation again.
 */
export function loadLockedDetectionKinds(attemptId: string | undefined): AiViolationKind[] {
  if (!attemptId) return [];
  const stored = readDetectionLocks(attemptId);
  return AI_VIOLATION_KINDS.filter((kind) => stored.includes(kind));
}

export function saveLockedDetectionKinds(attemptId: string | undefined, kinds: readonly AiViolationKind[]): void {
  if (attemptId) writeDetectionLocks(attemptId, kinds);
}
