import { describe, expect, it } from 'vitest';
import { fromDatetimeLocal, toDatetimeLocal } from './datetime-local';

describe('datetime-local values', () => {
  it('round-trips a minute in the local time zone', () => {
    const ts = new Date(2026, 9, 2, 7, 5).getTime();
    expect(toDatetimeLocal(ts)).toBe('2026-10-02T07:05');
    expect(fromDatetimeLocal('2026-10-02T07:05')).toBe(ts);
  });
});
