import { describe, expect, it } from 'vitest';
import {
  answersPayload, emptyResponse, formatPercent, isAnswered, isGradable, quizErrorMessage, quizSettingsError, quizState, readOptions,
  setStatement, toggleChoice, unansweredCount, type QuizAttempt, type QuizQuestion,
} from './quiz';

const options = [{ id: 'A', text: 'Một' }, { id: 'B', text: 'Hai' }, { id: 'C', text: 'Ba' }];
const question = (over: Partial<QuizQuestion>): QuizQuestion => ({ id: 'q', question_type: 'single_choice', stem: 'Câu hỏi', options, image_url: null, points: 1, ...over });
const single = question({ id: 's' });
const multi = question({ id: 'm', question_type: 'multiple_choice' });
const tf = question({ id: 't', question_type: 'true_false_multi' });
const attempt = (over: Partial<QuizAttempt>): QuizAttempt => ({ attempt_no: 1, score_percent: 50, passed: false, correct_count: 1, total_count: 2, submitted_at: '2026-10-15T08:00:00Z', ...over });

describe('dạng câu', () => {
  it('chỉ nhận ba dạng máy chủ chấm được', () => {
    expect(isGradable('single_choice')).toBe(true);
    expect(isGradable('true_false_multi')).toBe(true);
    expect(isGradable('matching')).toBe(false);
  });

  it('đọc phương án, bỏ phần tử hỏng', () => {
    expect(readOptions([{ id: 'A', text: 'x' }, { text: 'mất mã' }, null, { id: 'B' }])).toEqual([{ id: 'A', text: 'x' }, { id: 'B', text: '' }]);
    expect(readOptions('x')).toEqual([]);
  });
});

describe('trả lời', () => {
  it('câu trống ban đầu theo dạng', () => {
    expect(emptyResponse(single)).toBe('');
    expect(emptyResponse(multi)).toEqual([]);
    expect(emptyResponse(tf)).toEqual(['', '', '']);
  });

  it('đủ khi chọn một phương án, ít nhất một phương án, hoặc đánh hết các ý', () => {
    expect(isAnswered(single, 'B')).toBe(true);
    expect(isAnswered(single, '')).toBe(false);
    expect(isAnswered(multi, ['A'])).toBe(true);
    expect(isAnswered(multi, [])).toBe(false);
    expect(isAnswered(tf, ['T', 'F', 'T'])).toBe(true);
    expect(isAnswered(tf, ['T', '', 'T'])).toBe(false);
    expect(isAnswered(tf, undefined)).toBe(false);
    expect(unansweredCount([single, multi, tf], { s: 'A', m: [] })).toBe(2);
  });

  it('bật tắt phương án và đánh từng ý', () => {
    expect(toggleChoice(['A'], 'B')).toEqual(['A', 'B']);
    expect(toggleChoice(['A', 'B'], 'A')).toEqual(['B']);
    expect(toggleChoice(undefined, 'C')).toEqual(['C']);
    expect(setStatement(tf, undefined, 1, 'F')).toEqual(['', 'F', '']);
    expect(setStatement(tf, ['T', 'T', 'T'], 2, 'F')).toEqual(['T', 'T', 'F']);
  });

  it('gói gửi máy chủ chỉ có câu của quiz, nhiều đáp án sắp theo mã', () => {
    expect(answersPayload([single, multi], { s: 'B', m: ['C', 'A'], khac: 'A' })).toEqual({ s: 'B', m: ['A', 'C'] });
  });
});

describe('quizState', () => {
  it('chưa làm: còn đủ lượt, chưa có điểm', () => {
    expect(quizState([], 3)).toEqual({ passed: false, attemptsUsed: 0, attemptsLeft: 3, bestPercent: null, canSubmit: true });
  });

  it('đạt thì không nộp nữa; hết lượt thì cũng không', () => {
    expect(quizState([attempt({}), attempt({ attempt_no: 2, score_percent: 100, passed: true })], 3)).toMatchObject({ passed: true, bestPercent: 100, canSubmit: false });
    expect(quizState([attempt({}), attempt({ attempt_no: 2, score_percent: 60 })], 2)).toMatchObject({ attemptsLeft: 0, bestPercent: 60, canSubmit: false });
  });
});

describe('soạn quiz và thông báo', () => {
  it('điểm đạt 1–100, số lượt 1–10', () => {
    expect(quizSettingsError({ passPercent: '80', maxAttempts: '3' })).toBeNull();
    expect(quizSettingsError({ passPercent: '0', maxAttempts: '3' })).toMatch(/Điểm đạt/);
    expect(quizSettingsError({ passPercent: '80', maxAttempts: '1.5' })).toMatch(/Số lượt/);
    expect(quizSettingsError({ passPercent: '', maxAttempts: '3' })).toMatch(/Điểm đạt/);
  });

  it('đổi lỗi máy chủ thành câu cho học viên', () => {
    expect(quizErrorMessage(new Error('No quiz attempts left'))).toMatch(/hết số lượt/);
    expect(quizErrorMessage({ message: 'Quiz already passed' })).toMatch(/đã đạt/);
    expect(quizErrorMessage(new TypeError('Failed to fetch'))).toMatch(/chưa được nộp/);
    expect(formatPercent(66.666)).toBe('66,7%');
  });
});
