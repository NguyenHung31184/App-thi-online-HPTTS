import { describe, expect, it } from 'vitest';
import { newCriterionInput } from './grading';
import { durationFromInput, sessionTimeError } from './sessions';

describe('criteria', () => {
  it('adds criteria at the end with default points', () => {
    expect(newCriterionInput('t', 2)).toEqual({ template_id: 't', order_index: 2, name: 'Tiêu chí 3', max_score: 10, weight: 1 });
  });
});

describe('sessions', () => {
  it('checks the time window and the duration input', () => {
    expect(sessionTimeError(10, 10)).toBe('Thời gian kết thúc phải sau thời gian bắt đầu.');
    expect(sessionTimeError(10, 11)).toBeNull();
    expect(durationFromInput('')).toBeNull();
    expect(durationFromInput('45')).toBe(45);
  });
});
