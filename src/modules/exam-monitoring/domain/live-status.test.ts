import { describe, expect, it } from 'vitest';
import { formatDuration, formatSecondsAgo, groupByClass, initials, liveStatusOf, scoreOutOf10, tabCounter, type LiveAttemptRow } from './live-status';

function row(overrides: Partial<LiveAttemptRow> = {}): LiveAttemptRow {
  return {
    windowId: 'w1', classId: 'c1', className: 'Lớp A', enrolled: 10, examTitle: 'Đề 1', isTrial: false,
    windowEndAt: 1000, attemptId: 'a1', studentCode: 'hv1', studentName: 'An', status: 'in_progress', startedAt: 1,
    completedAt: null, score: null, attemptNumber: 1,
    answered: 3, totalQuestions: 50, violations: 0, lastViolation: null, disqualified: false,
    secondsSinceSeen: 10, secondsSinceViolation: null, ...overrides,
  };
}

describe('liveStatusOf', () => {
  it('reads each state', () => {
    expect(liveStatusOf(row())).toBe('working');
    expect(liveStatusOf(row({ violations: 2 }))).toBe('violation');
    expect(liveStatusOf(row({ secondsSinceSeen: 61 }))).toBe('disconnected');
    expect(liveStatusOf(row({ secondsSinceSeen: 60 }))).toBe('working');
    expect(liveStatusOf(row({ status: 'completed', secondsSinceSeen: 999 }))).toBe('submitted');
    expect(liveStatusOf(row({ status: 'completed', disqualified: true }))).toBe('disqualified');
  });

  it('puts a lost connection before violations', () => {
    expect(liveStatusOf(row({ violations: 3, secondsSinceSeen: 90 }))).toBe('disconnected');
  });
});

describe('groupByClass', () => {
  it('orders students by attention, then violations, then name', () => {
    const [group] = groupByClass([
      row({ attemptId: 'a1', studentCode: 'hv1', studentName: 'Bình', status: 'completed' }),
      row({ attemptId: 'a2', studentCode: 'hv2', studentName: 'Cường' }),
      row({ attemptId: 'a3', studentCode: 'hv3', studentName: 'An', violations: 1 }),
      row({ attemptId: 'a4', studentCode: 'hv4', studentName: 'Dũng', violations: 4 }),
      row({ attemptId: 'a5', studentCode: 'hv5', studentName: 'Hà', secondsSinceSeen: 120 }),
    ]);
    expect(group.students.map((s) => s.studentName)).toEqual(['Hà', 'Dũng', 'An', 'Cường', 'Bình']);
    expect(group.counts).toEqual({ disconnected: 1, violation: 2, working: 1, disqualified: 0, submitted: 1 });
    expect(group.notStarted).toBe(5);
  });

  it('keeps only the latest attempt of a student who retakes', () => {
    const [group] = groupByClass([
      row({ attemptId: 'old', startedAt: 1, status: 'completed' }),
      row({ attemptId: 'new', startedAt: 2 }),
    ]);
    expect(group.students.map((s) => s.attemptId)).toEqual(['new']);
  });

  it('merges windows of one class and lists classes needing attention first', () => {
    const groups = groupByClass([
      row({ classId: 'c1', className: 'Lớp A', windowId: 'w1', examTitle: 'Đề 1' }),
      row({ classId: 'c1', className: 'Lớp A', windowId: 'w2', examTitle: 'Đề 2', attemptId: 'a2', studentCode: 'hv2', windowEndAt: 2000 }),
      row({ classId: 'c2', className: 'Lớp B', attemptId: 'a3', studentCode: 'hv3', secondsSinceSeen: 300 }),
    ]);
    expect(groups.map((g) => g.className)).toEqual(['Lớp B', 'Lớp A']);
    expect(groups[1].examTitles).toEqual(['Đề 1', 'Đề 2']);
    expect(groups[1].endsAt).toBe(2000);
  });
});

describe('card values', () => {
  it('builds avatar letters like the sample', () => {
    expect(initials('DƯƠNG THỌ THANH LÊ')).toBe('DL');
    expect(initials('Nguyễn Văn Thắng')).toBe('NT');
    expect(initials('Tuấn')).toBe('T');
    expect(initials('  đinh   công trường ')).toBe('ĐT');
    expect(initials(null)).toBe('?');
  });

  it('shows the score on the 10-point scale', () => {
    expect(scoreOutOf10(0.76)).toBe('7.6');
    expect(scoreOutOf10(0.925)).toBe('9.3');
    expect(scoreOutOf10(1)).toBe('10.0');
    expect(scoreOutOf10(null)).toBeNull();
  });

  it('formats a duration', () => {
    expect(formatDuration(2016000)).toBe('33 phút 36 giây');
    expect(formatDuration(45000)).toBe('45 giây');
    expect(formatDuration(3900000)).toBe('1 giờ 5 phút');
  });

  it('counts finished attempts over started ones for the tab', () => {
    const [group] = groupByClass([
      row({ attemptId: 'a1', studentCode: 'hv1', status: 'completed' }),
      row({ attemptId: 'a2', studentCode: 'hv2', status: 'completed', disqualified: true }),
      row({ attemptId: 'a3', studentCode: 'hv3' }),
    ]);
    expect(tabCounter(group)).toBe('2/3');
  });
});

describe('formatSecondsAgo', () => {
  it('formats seconds and minutes', () => {
    expect(formatSecondsAgo(2)).toBe('vừa xong');
    expect(formatSecondsAgo(45)).toBe('45 giây trước');
    expect(formatSecondsAgo(185)).toBe('3 phút trước');
  });
});
