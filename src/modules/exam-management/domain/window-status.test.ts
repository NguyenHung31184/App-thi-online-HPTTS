import { describe, expect, it } from 'vitest';
import type { ExamWindow } from '../../../types';
import { classGroupStatus, groupWindowsByClass, windowStatus } from './window-status';

const window = (id: string, classId: string | null, startAt: number, endAt: number) =>
  ({ id, class_id: classId, start_at: startAt, end_at: endAt }) as unknown as ExamWindow;

describe('windowStatus', () => {
  it('reads upcoming, active and ended', () => {
    expect([windowStatus(10, 20, 5), windowStatus(10, 20, 10), windowStatus(10, 20, 21)]).toEqual(['upcoming', 'active', 'ended']);
  });
});

describe('groupWindowsByClass', () => {
  it('puts running classes first, then upcoming, then ended by class name, and orders windows inside', () => {
    const now = 100;
    const windows = [
      window('old-b', 'B', 0, 50),
      window('soon-a', 'A', 150, 200),
      window('run-c', 'C', 90, 110),
      window('older-b', 'B', 0, 40),
      window('none', null, 0, 10),
    ];
    const groups = groupWindowsByClass(windows, { A: 'Lớp A', B: 'Lớp B', C: 'Lớp C' }, now);
    expect(groups.map(([id, list]) => [id, list.map((w) => w.id)])).toEqual([
      ['C', ['run-c']],
      ['A', ['soon-a']],
      ['__unknown__', ['none']],
      ['B', ['old-b', 'older-b']],
    ]);
    expect(classGroupStatus(groups[0][1], now)).toBe('active');
  });
});
