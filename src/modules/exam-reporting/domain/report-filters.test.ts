import { describe, expect, it } from 'vitest';
import type { ExamWindow } from '../../../types';
import { classesWithWindows, examsOfWindows, reportFiltersFor, windowOptionLabel, windowsForClassAndTrial, windowsForExam } from './report-filters';

const win = (over: Partial<ExamWindow>): ExamWindow =>
  ({ id: 'w', exam_id: 'e1', class_id: 'c1', start_at: new Date(2026, 9, 2).getTime(), end_at: 0, access_code: 'TD30', is_trial: false, ...over }) as ExamWindow;

const classNames = { c1: { name: 'Lái xe nâng', code: 'FL-K103' }, c2: { name: 'An toàn' } };

describe('report filters', () => {
  const windows = [
    win({ id: 'w1' }),
    win({ id: 'w2', class_id: 'c2', exam_id: 'e2', is_trial: true }),
    win({ id: 'w3', class_id: 'c9' }),
    win({ id: 'w4', class_id: '' }),
  ];

  it('lists classes that have windows, labelled and sorted', () => {
    expect(classesWithWindows(windows, classNames)).toEqual([
      { id: 'c2', label: 'An toàn' },
      { id: 'c9', label: 'c9' },
      { id: 'c1', label: 'Lái xe nâng (FL-K103)' },
    ]);
  });

  it('narrows windows by class, trial, then exam', () => {
    expect(windowsForClassAndTrial(windows, 'c1', 'all').map((w) => w.id)).toEqual(['w1']);
    expect(windowsForClassAndTrial(windows, '', 'trial').map((w) => w.id)).toEqual(['w2']);
    expect(windowsForClassAndTrial(windows, '', 'real').map((w) => w.id)).toEqual(['w1', 'w3', 'w4']);
    expect(windowsForExam(windows, 'e2').map((w) => w.id)).toEqual(['w2']);
    expect(windowsForExam(windows, '')).toHaveLength(4);
    expect(examsOfWindows([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }], windows.slice(0, 1))).toEqual([{ id: 'e1' }]);
  });

  it('prefers the window over the exam', () => {
    expect(reportFiltersFor('e1', 'w1')).toEqual({ window_id: 'w1' });
    expect(reportFiltersFor('e1', '')).toEqual({ exam_id: 'e1' });
    expect(reportFiltersFor('', '')).toEqual({});
  });

  it('labels a window option', () => {
    expect(windowOptionLabel(win({ is_trial: true }), classNames)).toBe('[Thử] 2/10/2026 – TD30 • FL-K103');
    expect(windowOptionLabel(win({ class_id: 'c2' }), classNames)).toBe('2/10/2026 – TD30 • An toàn');
  });
});
