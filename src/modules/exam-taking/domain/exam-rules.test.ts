import { describe, expect, it } from 'vitest';
import { examRuleFacts, examRuleSections } from './exam-rules';

describe('examRuleFacts', () => {
  it('lists the figures of a real exam', () => {
    expect(examRuleFacts({ durationMinutes: 30, totalQuestions: 50, passThreshold: 0.6, maxAttempts: 2 })).toEqual([
      { label: 'Số câu hỏi', value: '50 câu' },
      { label: 'Thời gian làm bài', value: '30 phút' },
      { label: 'Điểm đạt', value: 'từ 60/100' },
      { label: 'Số lượt thi', value: 'tối đa 2 lượt' },
    ]);
  });

  it('marks a trial instead of an attempt limit and skips unknown figures', () => {
    expect(examRuleFacts({ isTrial: true, maxAttempts: 2 })).toEqual([{ label: 'Loại kỳ thi', value: 'Thi thử' }]);
    expect(examRuleFacts({})).toEqual([]);
  });
});

describe('examRuleSections', () => {
  it('states the attempt limit and the auto-submit count', () => {
    const text = examRuleSections({ maxAttempts: 2 }).flatMap((section) => section.items).join(' ');
    expect(text).toContain('tối đa 2 lượt');
    expect(text).toContain('đến lần thứ 5 hệ thống tự nộp bài');
  });

  it('tells a trial student the score is not recorded', () => {
    const text = examRuleSections({ isTrial: true, maxAttempts: 2 }).flatMap((section) => section.items).join(' ');
    expect(text).toContain('điểm không ghi vào hồ sơ học tập');
    expect(text).not.toContain('tối đa 2 lượt');
  });
});
