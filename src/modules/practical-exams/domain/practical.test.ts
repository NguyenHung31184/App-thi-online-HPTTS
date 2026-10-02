import { describe, expect, it } from 'vitest';
import { canSyncToTtdt, newCriterionInput, scoreRange, scoresByCriteria, ttdtSyncBlocker, weightedTotal } from './grading';
import { durationFromInput, sessionOptionLabel, sessionTimeError, studentAttemptBlocker } from './sessions';

describe('grading', () => {
  it('weights each criterion and counts a missing score as 0', () => {
    const criteria = [{ id: 'a', weight: 2 }, { id: 'b', weight: 0.5 }, { id: 'c', weight: undefined as unknown as number }];
    expect(weightedTotal(criteria, { a: 7, b: 4, c: 3 })).toBe(19);
    expect(weightedTotal(criteria, {})).toBe(0);
  });

  it('maps saved scores and slider ranges', () => {
    expect(scoresByCriteria([{ criteria_id: 'a', score: 5 }, { criteria_id: 'b', score: 0 }])).toEqual({ a: 5, b: 0 });
    expect(scoreRange({ max_score: 20, score_step: 0.5 })).toEqual({ max: 20, step: 0.5 });
    expect(scoreRange({ max_score: undefined as unknown as number, score_step: null })).toEqual({ max: 10, step: 1 });
  });

  it('adds criteria at the end with default points', () => {
    expect(newCriterionInput('t', 2)).toEqual({ template_id: 't', order_index: 2, name: 'Tiêu chí 3', max_score: 10, weight: 1 });
  });

  it('syncs only graded attempts with a student and a module', () => {
    expect(canSyncToTtdt({ status: 'graded', total_score: 8 })).toBe(true);
    expect(canSyncToTtdt({ status: 'graded', total_score: null })).toBe(false);
    expect(canSyncToTtdt({ status: 'submitted', total_score: 8 })).toBe(false);
    expect(ttdtSyncBlocker(null, 'm')).toMatch(/^Không tìm thấy student_id/);
    expect(ttdtSyncBlocker('s', null)).toMatch(/^Đề thi chưa gắn module_id/);
    expect(ttdtSyncBlocker('s', 'm')).toBeNull();
  });
});

describe('sessions and attempts', () => {
  it('checks the time window and the duration input', () => {
    expect(sessionTimeError(10, 10)).toBe('Thời gian kết thúc phải sau thời gian bắt đầu.');
    expect(sessionTimeError(10, 11)).toBeNull();
    expect(durationFromInput('')).toBeNull();
    expect(durationFromInput('45')).toBe(45);
  });

  it('lets only the owner work on an attempt that is not submitted', () => {
    expect(studentAttemptBlocker(null, 'u')).toBe('Không tìm thấy bài làm.');
    expect(studentAttemptBlocker({ user_id: 'x', status: 'pending_upload' }, 'u')).toBe('Bạn không có quyền làm bài này.');
    expect(studentAttemptBlocker({ user_id: 'u', status: 'graded' }, 'u')).toBe('Bài làm đã nộp.');
    expect(studentAttemptBlocker({ user_id: 'u', status: 'pending_upload' }, 'u')).toBeNull();
  });

  it('labels a session option', () => {
    const session = { id: 'abcdef123456', start_at: new Date(2026, 9, 2).getTime() };
    expect(sessionOptionLabel(session, 'Lái cẩu')).toBe('Lái cẩu — 2/10/2026');
    expect(sessionOptionLabel(session, undefined)).toBe('abcdef12 — 2/10/2026');
  });
});
