import { describe, expect, it } from 'vitest';
import { examOptionLabel, examsWithoutModule, fromDatetimeLocal, randomAccessCode, toDatetimeLocal, windowFormError } from './window-form';

describe('datetime-local values', () => {
  it('round-trips a minute in the local time zone', () => {
    const ts = new Date(2026, 9, 2, 7, 5).getTime();
    expect(toDatetimeLocal(ts)).toBe('2026-10-02T07:05');
    expect(fromDatetimeLocal('2026-10-02T07:05')).toBe(ts);
  });
});

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
  const base = { isTrial: false, classId: 'c1', useMultiExams: false, examId: 'e1', selectedExamIds: [], titlesWithoutModule: [], startAt: 1, endAt: 2 };

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
    expect(windowFormError({ ...base, endAt: 1 })).toBe('Thời gian kết thúc phải sau thời gian bắt đầu.');
  });
});

describe('examsWithoutModule', () => {
  it('lists the chosen exams that have no module', () => {
    const exams = [{ id: 'e1', title: 'Có', module_id: 'm' }, { id: 'e2', title: 'Không', module_id: ' ' }];
    expect(examsWithoutModule(['e1', 'e2', 'e9'], exams)).toEqual(['Không', 'e9']);
  });
});
