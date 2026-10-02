import { describe, expect, it } from 'vitest';
import { countViolations, passFailCounts, summarizeAttempts } from './dashboard-stats';
import { formatDurationMs, toRecentAttemptRow, type RecentAttemptRecord } from './recent-attempts';

describe('summarizeAttempts', () => {
  it('counts today, the week, the pass rate and each day', () => {
    const today = Date.UTC(2026, 9, 2, 0, 0);
    const summary = summarizeAttempts(
      [
        { completed_at: today + 3_600_000, score: 0.8, disqualified: false },
        { completed_at: today + 7_200_000, score: 0.9, disqualified: true },
        { completed_at: today - 3_600_000, score: 0.5, disqualified: false, exams: { pass_threshold: 0.5 } },
        { completed_at: today - 3_600_000, score: null, disqualified: false },
        { completed_at: null, score: 1, disqualified: false },
      ],
      today,
    );
    expect(summary.attemptsToday).toBe(2);
    expect(summary.attemptsLast7Days).toBe(4);
    expect(summary.passedRateLast7Days).toBe(0.5);
    expect(summary.attemptsPerDay).toEqual([
      { date: '2026-10-01', completed: 2, passed: 1, failedOrDisqualified: 1 },
      { date: '2026-10-02', completed: 2, passed: 1, failedOrDisqualified: 1 },
    ]);
    expect(summarizeAttempts([], today).passedRateLast7Days).toBe(0);
  });
});

describe('countViolations', () => {
  it('counts the five browser signals only', () => {
    const counts = countViolations([{ event: 'focus_lost' }, { event: 'focus_lost' }, { event: 'photo_taken' }, { event: 'ai_no_face' }]);
    expect(counts).toEqual({ focus_lost: 2, visibility_hidden: 0, fullscreen_exited: 0, copy_paste_blocked: 0, photo_taken: 1 });
  });
});

describe('passFailCounts', () => {
  it('splits passed, failed and disqualified', () => {
    expect(passFailCounts([{ passed: true, disqualified: false }, { passed: true, disqualified: true }, { passed: false, disqualified: false }]))
      .toEqual({ passed: 1, failed: 1, disqualified: 1, total: 3 });
    expect(passFailCounts([]).total).toBe(1);
  });
});

describe('recent attempt rows', () => {
  it('formats the time taken', () => {
    expect(formatDurationMs(-1)).toBe('—');
    expect(formatDurationMs(125_000)).toBe('2 phút 5 giây');
    expect(formatDurationMs(130 * 60_000)).toBe('2 giờ 10 phút');
  });

  it('builds a dashboard row', () => {
    const record: RecentAttemptRecord = {
      id: 'a', exam_id: 'e', window_id: 'w', started_at: 1_000, completed_at: 1_000 + 31 * 60_000, score: 0.75, raw_score: 15,
      total_max: 20, disqualified: false, user_id: 'u',
      exams: { title: 'QC', duration_minutes: 30 },
      exam_windows: { access_code: 'TD30', class_id: 'c' },
    };
    const row = toRecentAttemptRow(record, {
      profiles: new Map([['u', { name: 'Hồ sơ', email: 'hv@hptts.vn' }]]),
      classNames: new Map([['c', 'FL-K103']]),
      studentsById: new Map(),
      studentsByExamEmail: new Map(),
    });
    expect(row).toMatchObject({
      exam_title: 'QC', student_label: 'Hồ sơ', window_label: 'FL-K103 · Mã TD30', duration_label: '31 phút 0 giây',
      raw_display: '15 / 20', passed: true, overtime: true,
    });
    const bare = toRecentAttemptRow({ ...record, user_id: null, total_max: null, exams: null, exam_windows: null }, {
      profiles: new Map(), classNames: new Map(), studentsById: new Map(), studentsByExamEmail: new Map(),
    });
    expect(bare).toMatchObject({ exam_title: '—', student_label: '—', window_label: '—', raw_display: '75%', overtime: false });
  });
});
