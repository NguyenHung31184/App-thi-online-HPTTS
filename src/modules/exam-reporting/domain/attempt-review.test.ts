import { describe, expect, it } from 'vitest';
import type { Attempt, Exam } from '../../../types';
import { answerLabel, attemptScore, formatAttemptDuration, orderByIds, parseOptions, studentFactsOf, toReviewItems } from './attempt-review';

const options = [{ id: 'a', text: 'Một' }, { id: 'b', text: 'Hai' }];

describe('answerLabel', () => {
  it('shows each question type in words', () => {
    expect(answerLabel(options, null, 'multiple_choice')).toBe('— (chưa chọn)');
    expect(answerLabel(options, 'b', 'multiple_choice')).toBe('Hai');
    expect(answerLabel(options, 'x', 'multiple_choice')).toBe('x');
    expect(answerLabel(options, '["T","F"]', 'true_false_multi')).toBe('Đúng / Sai');
    expect(answerLabel(options, '["b","a"]', 'ordering')).toBe('Hai → Một');
    expect(answerLabel(options, '{"a":"1"}', 'matching')).toBe('Một ↔ 1');
    expect(answerLabel(options, 'not json', 'matching')).toBe('not json');
  });
});

describe('parseOptions', () => {
  it('accepts arrays and JSON strings', () => {
    expect(parseOptions(options)).toBe(options);
    expect(parseOptions('[{"id":"a","text":"Một"}]')).toEqual([{ id: 'a', text: 'Một' }]);
    expect(parseOptions('oops')).toEqual([]);
    expect(parseOptions(null)).toEqual([]);
  });
});

describe('toReviewItems', () => {
  it('marks answers right or wrong per question type', () => {
    const items = toReviewItems(
      [
        { id: 'q1', stem: 'S1', options, answer_key: 'a', points: 1, topic: 't' },
        { id: 'q2', stem: 'S2', options: '[]', answer_key: '["T", "F"]', points: '2' as unknown as number, topic: 't', question_type: 'true_false_multi' },
        { id: 'q3', stem: 'S3', options, answer_key: 'b', points: 1, topic: 't' },
      ],
      { q1: 'a', q2: '["T","F"]' },
    );
    expect(items.map((i) => [i.chosen, i.correct, i.points])).toEqual([['a', true, 1], ['["T","F"]', true, 2], [null, false, 1]]);
    expect(items[0].question_type).toBe('multiple_choice');
  });

  it('keeps the attempt order', () => {
    expect(orderByIds(['b', 'x', 'a'], [{ id: 'a' }, { id: 'b' }])).toEqual([{ id: 'b' }, { id: 'a' }]);
  });
});

describe('student facts and duration', () => {
  it('reads whichever column the student row has', () => {
    expect(studentFactsOf({ full_name: ' Nguyễn An ', dob: '01/01/2000', id_card_number: '' , cccd: '0123' }))
      .toEqual({ name: 'Nguyễn An', dob: '01/01/2000', cccd: '0123' });
    expect(studentFactsOf(null)).toEqual({ name: null, dob: null, cccd: null });
  });

  it('formats the time taken', () => {
    expect(formatAttemptDuration(1_000, 1_000 + 65_000)).toBe('1 phút 5 giây');
    expect(formatAttemptDuration(1_000, null)).toBe('—');
  });
});

describe('attemptScore', () => {
  const exam = { pass_threshold: 0.7, total_questions: 30 } as Exam;

  it('compares rounded points with the rounded pass mark', () => {
    expect(attemptScore({ raw_score: 69.6, total_max: 100, score: 0.696 } as Attempt, exam)).toMatchObject({ earned: 69.6, denom: 100, passValue: 70, passed: true });
    expect(attemptScore({ raw_score: 69.4, total_max: 100, score: 0.694 } as Attempt, exam).passed).toBe(false);
  });

  it('falls back to the exam question count, and fails a disqualified attempt', () => {
    expect(attemptScore({ score: 0.8 } as Attempt, exam)).toMatchObject({ earned: 24, denom: 30, passed: true });
    expect(attemptScore({ score: 0.8, disqualified: true } as Attempt, exam).passed).toBe(false);
    expect(attemptScore({ score: 0.8 } as Attempt, { pass_threshold: 0.7 } as Exam)).toMatchObject({ denom: null, passValue: null, passed: true });
  });
});
