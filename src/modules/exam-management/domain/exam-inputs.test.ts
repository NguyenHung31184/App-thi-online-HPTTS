import { describe, expect, it } from 'vitest';
import { countDraws, examRowFromInput, windowExamIdAfterUpdate, windowRowFromInput } from './exam-inputs';

describe('examRowFromInput', () => {
  it('fills the defaults of a new exam', () => {
    expect(examRowFromInput({ title: 'QC' })).toEqual({
      title: 'QC', description: '', duration_minutes: 60, pass_threshold: 0.7, total_questions: 0, blueprint: [], module_id: null, created_by: null,
    });
  });
});

describe('windowRowFromInput', () => {
  const base = { class_id: 'c1', start_at: 1, end_at: 2, access_code: 'TD01' };

  it('uses the single exam and the window defaults', () => {
    expect(windowRowFromInput({ ...base, exam_id: 'e1' })).toMatchObject({
      exam_id: 'e1', exam_ids: null, is_trial: false, max_attempts: 2, proctoring_mode: 'strict', ai_risk_threshold: 6,
    });
  });

  it('shows the first of several exams', () => {
    expect(windowRowFromInput({ ...base, exam_id: 'ignored', exam_ids: ['', 'e2', 'e3'] })).toMatchObject({ exam_id: 'e2', exam_ids: ['e2', 'e3'] });
  });

  it('refuses a window without an exam', () => {
    expect(() => windowRowFromInput({ ...base, exam_ids: [] })).toThrow('Cần chọn ít nhất một đề thi');
  });
});

describe('windowExamIdAfterUpdate', () => {
  it('leaves exam_id alone when exam_ids is not updated', () => {
    expect(windowExamIdAfterUpdate({ access_code: 'X' }, 'e0')).toBeUndefined();
  });

  it('takes the first listed exam, else the given one, else the current one', () => {
    expect(windowExamIdAfterUpdate({ exam_ids: ['e2', 'e3'] }, 'e0')).toBe('e2');
    expect(windowExamIdAfterUpdate({ exam_ids: [], exam_id: 'e1' }, 'e0')).toBe('e1');
    expect(windowExamIdAfterUpdate({ exam_ids: null }, 'e0')).toBe('e0');
  });
});

describe('countDraws', () => {
  it('counts each question across attempts', () => {
    expect(countDraws([['q1', 'q2'], null, ['q1']])).toEqual({ q1: 2, q2: 1 });
  });
});
