import { describe, expect, it } from 'vitest';
import { examOptionLabel, examsWithoutModule, longestDurationMinutes, randomAccessCode, windowFormError } from './window-form';

describe('examOptionLabel', () => {
  it('adds the description and cuts long labels', () => {
    expect(examOptionLabel({ title: 'QC', description: ' Thi kết thúc ' })).toBe('QC — Thi kết thúc');
    expect(examOptionLabel({ title: 'x'.repeat(80) })).toHaveLength(75);
  });
});

describe('randomAccessCode', () => {
  it('builds four characters from the safe alphabet', () => {
    expect(randomAccessCode(() => 0)).toBe('AAAA');
    expect(randomAccessCode(() => 0.999)).toBe('9999');
  });
});

describe('windowFormError', () => {
  const base = { isTrial: false, classId: 'c1', useMultiExams: false, examId: 'e1', selectedExamIds: [], titlesWithoutModule: [], startAt: 1, endAt: 2, accessCode: 'A1B2' };

  it('accepts a complete real window', () => {
    expect(windowFormError(base)).toBeNull();
  });

  it('checks class, exam, multi list, modules and time in that order', () => {
    expect(windowFormError({ ...base, classId: ' ' })).toMatch(/^Vui lòng chọn Lớp/);
    expect(windowFormError({ ...base, isTrial: true, classId: '' })).toBeNull();
    expect(windowFormError({ ...base, examId: '' })).toBe('Vui lòng chọn Đề thi.');
    expect(windowFormError({ ...base, useMultiExams: true })).toBe('Vui lòng thêm ít nhất một đề thi (chế độ nhiều đề).');
    expect(windowFormError({ ...base, titlesWithoutModule: ['QC'] })).toMatch(/^Không thể lưu: 1 đề chưa gắn mô-đun \(QC\)/);
    expect(windowFormError({ ...base, isTrial: true, titlesWithoutModule: ['QC'] })).toBeNull();
    expect(windowFormError({ ...base, startAt: NaN })).toBe('Vui lòng nhập thời gian Bắt đầu và Kết thúc.');
    expect(windowFormError({ ...base, endAt: 1 })).toBe('Thời gian kết thúc phải sau thời gian bắt đầu.');
    expect(windowFormError({ ...base, accessCode: '  ' })).toMatch(/^Vui lòng nhập Mã truy cập/);
  });
});

describe('examsWithoutModule', () => {
  it('lists the chosen exams that have no module', () => {
    const exams = [{ id: 'e1', title: 'Có', module_id: 'm' }, { id: 'e2', title: 'Không', module_id: ' ' }];
    expect(examsWithoutModule(['e1', 'e2', 'e9'], exams)).toEqual(['Không', 'e9']);
  });
});

describe('window length against exam duration', () => {
  const base = { isTrial: false, classId: 'c1', useMultiExams: false, examId: 'e1', selectedExamIds: [], titlesWithoutModule: [], accessCode: 'A1B2', durationMinutes: 30 };
  const start = new Date(2026, 9, 21, 8, 15).getTime();
  const minutes = (n: number) => start + n * 60_000;

  it('refuses a window shorter than the exam plus 5 minutes of preparation', () => {
    expect(windowFormError({ ...base, startAt: start, endAt: minutes(20) }))
      .toBe('Khung giờ 20 phút ngắn hơn thời gian làm bài 30 phút cộng 5 phút chuẩn bị: học viên sẽ bị nộp bài trước khi hết giờ. Đặt giờ Kết thúc từ 08:50 trở đi.');
    expect(windowFormError({ ...base, startAt: start, endAt: minutes(34) })).toMatch(/^Khung giờ 34 phút/);
  });

  it('accepts exactly the exam plus preparation, and skips the check without a duration', () => {
    expect(windowFormError({ ...base, startAt: start, endAt: minutes(35) })).toBeNull();
    expect(windowFormError({ ...base, durationMinutes: 0, startAt: start, endAt: minutes(5) })).toBeNull();
  });

  it('takes the longest of the chosen exams', () => {
    const exams = [{ id: 'a', title: 'A', duration_minutes: 30 }, { id: 'b', title: 'B', duration_minutes: 45 }, { id: 'c', title: 'C' }];
    expect(longestDurationMinutes(['a', 'b', 'c'], exams)).toBe(45);
    expect(longestDurationMinutes([], exams)).toBe(0);
  });
});
