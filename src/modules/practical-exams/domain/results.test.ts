import { describe, expect, it } from 'vitest';
import { clock, currentResultAttempts, missingPpe, resultRows, resultSummary, type ResultAttempt } from './results';

const attempt = (over: Partial<ResultAttempt> & { id: string; studentId: string }): ResultAttempt => ({
  status: 'grading', started: false, totalScore: null, isDisqualified: false, syncedAt: null, gradedAt: null, liveTotal: null, ...over,
});
const students = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: `HV ${id}`, birthDate: null }));

describe('resultRows', () => {
  const attempts = [
    attempt({ id: 'a1', studentId: 'a', status: 'graded', started: true, totalScore: 94, syncedAt: '2026-10-09T03:00:00Z', gradedAt: '2026-10-09T02:59:00Z' }),
    attempt({ id: 'b1', studentId: 'b', status: 'not_eligible', started: true }),
    attempt({ id: 'c1', studentId: 'c', status: 'graded', started: true, totalScore: 55, isDisqualified: true }),
    attempt({ id: 'd1', studentId: 'd', started: true, liveTotal: 78 }),
    attempt({ id: 'x1', studentId: 'x', status: 'graded', started: true, totalScore: 60 }),
  ];
  const rows = resultRows(students, attempts, 70);

  it('gives each enrolled student a state, the score TTDT receives and the pass mark', () => {
    expect(rows.map((r) => [r.studentId, r.state, r.total, r.outOf10, r.passed, r.synced])).toEqual([
      ['a', 'graded', 94, 9.4, true, true],
      ['b', 'not_eligible', null, null, null, false],
      ['c', 'disqualified', 0, 0, false, false],
      ['d', 'grading', 78, null, null, false],
      ['e', 'waiting', null, null, null, false],
      ['x', 'graded', 60, 6, false, false],
    ]);
    expect(rows[5].name).toBe('Không còn trong danh sách lớp');
  });

  it('counts the shift', () => {
    expect(resultSummary(rows)).toEqual({ students: 6, done: 4, grading: 1, waiting: 1, passed: 1, notPassed: 2, notEligible: 1, toSend: 2 });
  });
});

describe('currentResultAttempts', () => {
  it('prefers a finished attempt, then a started one, then the newest', () => {
    const chosen = currentResultAttempts([
      attempt({ id: 'old-locked', studentId: 'a', status: 'graded', started: true }),
      attempt({ id: 'new-empty', studentId: 'a' }),
      attempt({ id: 'started', studentId: 'b', started: true }),
      attempt({ id: 'empty', studentId: 'b' }),
      attempt({ id: 'empty-1', studentId: 'c' }),
      attempt({ id: 'empty-2', studentId: 'c' }),
    ]);
    expect([chosen.a.id, chosen.b.id, chosen.c.id]).toEqual(['old-locked', 'started', 'empty-2']);
  });

  it('shows an attempt that was opened but not started as waiting', () => {
    expect(resultRows([students[0]], [attempt({ id: 'a1', studentId: 'a' })], 70)[0].state).toBe('waiting');
  });
});

describe('small helpers', () => {
  it('formats seconds and lists unticked protective equipment', () => {
    expect([clock(185), clock(59.6), clock(0)]).toEqual(['3:05', '1:00', '0:00']);
    expect(missingPpe(['Mũ', 'Giày', 'Găng tay'], { Mũ: true, Giày: false })).toEqual(['Giày', 'Găng tay']);
    expect(missingPpe(['Mũ'], null)).toEqual(['Mũ']);
  });
});
