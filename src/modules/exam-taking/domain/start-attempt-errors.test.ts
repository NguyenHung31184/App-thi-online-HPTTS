import { describe, expect, it } from 'vitest';
import { startAttemptErrorMessage } from './start-attempt-errors';

describe('startAttemptErrorMessage', () => {
  it('turns server codes into a sentence the student can act on', () => {
    expect(startAttemptErrorMessage('access_code_rate_limited')).toMatch(/sai mã truy cập 5 lần.*giám thị/);
    expect(startAttemptErrorMessage(' attempt_limit_reached ')).toBe('Bạn đã dùng hết số lần thi của kỳ thi này.');
  });

  it('keeps unknown messages and falls back when empty', () => {
    expect(startAttemptErrorMessage('Failed to fetch')).toBe('Failed to fetch');
    expect(startAttemptErrorMessage(undefined)).toMatch(/Không vào được bài thi/);
  });
});
