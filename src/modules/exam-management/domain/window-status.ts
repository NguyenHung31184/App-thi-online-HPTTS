import type { ExamWindow } from '../../../types';

export type WindowStatus = 'active' | 'upcoming' | 'ended';

const STATUS_ORDER: Record<WindowStatus, number> = { active: 0, upcoming: 1, ended: 2 };
export const UNKNOWN_CLASS = '__unknown__';

export function windowStatus(startAt: number, endAt: number, now: number): WindowStatus {
  if (now < startAt) return 'upcoming';
  if (now > endAt) return 'ended';
  return 'active';
}

/** A class is "active" when one of its windows is running, else "upcoming" when one is still to come. */
export function classGroupStatus(windows: ExamWindow[], now: number): WindowStatus {
  const statuses = windows.map((window) => windowStatus(window.start_at, window.end_at, now));
  if (statuses.includes('active')) return 'active';
  if (statuses.includes('upcoming')) return 'upcoming';
  return 'ended';
}

/**
 * Windows grouped by class. Groups: running, then upcoming, then ended, ties by class name; inside a group the same
 * order, ties newest first.
 */
export function groupWindowsByClass(windows: ExamWindow[], classNames: Record<string, string>, now: number): [string, ExamWindow[]][] {
  const byClass = new Map<string, ExamWindow[]>();
  for (const window of windows) {
    const key = window.class_id ?? UNKNOWN_CLASS;
    byClass.set(key, [...(byClass.get(key) ?? []), window]);
  }
  const order = (window: ExamWindow) => STATUS_ORDER[windowStatus(window.start_at, window.end_at, now)];
  for (const list of byClass.values()) list.sort((a, b) => order(a) - order(b) || b.start_at - a.start_at);
  return [...byClass.entries()].sort(([aId, aList], [bId, bList]) =>
    STATUS_ORDER[classGroupStatus(aList, now)] - STATUS_ORDER[classGroupStatus(bList, now)]
      || (classNames[aId] ?? '').localeCompare(classNames[bId] ?? '', 'vi'));
}
