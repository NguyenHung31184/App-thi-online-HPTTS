import { describe, expect, it } from 'vitest';
import { isExamPassed } from './exam-result';

describe('exam pass decision', () => {
  it('does not round a failing score into a pass', () => {
    expect(isExamPassed(0.696, false, 0.7)).toBe(false);
    expect(isExamPassed(0.7, false, 0.7)).toBe(true);
    expect(isExamPassed(0.704, false, 0.7)).toBe(true);
  });
  it('rejects missing, invalid or disqualified results, including a zero pass mark', () => {
    expect(isExamPassed(null, false, 0)).toBe(false);
    expect(isExamPassed(Number.NaN, false, 0.7)).toBe(false);
    expect(isExamPassed(0, true, 0)).toBe(false);
    expect(isExamPassed(0, false, 0)).toBe(true);
  });
});
