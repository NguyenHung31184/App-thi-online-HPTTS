import { describe, expect, it } from 'vitest';
import { minutesLeft, sortFailures, type AccessFailure } from './access-locks';

const now = Date.parse('2026-10-16T07:30:00Z');
const row = (userId: string, failureCount: number, lockedUntil: string | null): AccessFailure => ({
  windowId: 'w', className: 'NBN-GN4.5', examTitle: 'Đề', userId, studentCode: userId, studentName: userId,
  failureCount, lastFailedAt: '2026-10-16T07:25:00Z', lockedUntil,
});

describe('access locks', () => {
  it('counts minutes left, rounding up, zero when over or not locked', () => {
    expect(minutesLeft('2026-10-16T07:34:10Z', now)).toBe(5);
    expect(minutesLeft('2026-10-16T07:30:20Z', now)).toBe(1);
    expect(minutesLeft('2026-10-16T07:29:00Z', now)).toBe(0);
    expect(minutesLeft(null, now)).toBe(0);
  });

  it('puts locked students first, then the most wrong codes', () => {
    const sorted = sortFailures([row('a', 3, null), row('b', 5, '2026-10-16T07:20:00Z'), row('c', 5, '2026-10-16T07:35:00Z'), row('d', 4, null)], now);
    expect(sorted.map((r) => r.userId)).toEqual(['c', 'b', 'd', 'a']);
  });
});
