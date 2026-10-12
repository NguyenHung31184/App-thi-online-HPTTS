import { describe, expect, it } from 'vitest';
import { formatRemaining, hasStudentAnswer, hashStringToSeed, shuffleWithSeed } from './session-paper';

describe('issued paper presentation', () => {
  it('keeps order stable after reload without mutating the issued paper', () => {
    const issued = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
    const original = [...issued];
    const seed = hashStringToSeed('attempt-1');
    expect(shuffleWithSeed(issued, seed)).toEqual(shuffleWithSeed(issued, seed));
    expect(shuffleWithSeed(issued, seed).sort()).toEqual([...issued].sort());
    expect(issued).toEqual(original);
    expect(hashStringToSeed('attempt-2')).not.toBe(seed);
  });

  it('counts partially answered structured questions but ignores empty or corrupt drafts', () => {
    expect(hasStudentAnswer('true_false_multi', '["", "F", ""]')).toBe(true);
    expect(hasStudentAnswer('true_false_multi', '["", ""]')).toBe(false);
    expect(hasStudentAnswer('matching', '{"A":"2"}')).toBe(true);
    for (const value of ['{}', 'null', 'broken', '']) expect(hasStudentAnswer('matching', value)).toBe(false);
    expect(hasStudentAnswer('main_idea', ' Nội dung ')).toBe(true);
    expect(hasStudentAnswer('single_choice', undefined)).toBe(false);
  });

  it('shows zero after expiry and keeps minute/second boundaries', () => {
    expect(formatRemaining(-100)).toBe('0:00');
    expect(formatRemaining(59_999)).toBe('0:59');
    expect(formatRemaining(60_000)).toBe('1:00');
  });
});
