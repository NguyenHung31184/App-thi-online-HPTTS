import { describe, expect, it } from 'vitest';
import {
  aiRiskPoints, evidenceFramesOf, evidencePathsOf, evidenceUrlOf, isPassed, resultSheetRows, reviewStatusOf, searchResultRows,
  searchViolationSummaries, studentDisplayName, summarizeViolations, violationSheetRows,
  type AttemptReportRow, type ReportDirectory, type ViolationReportRow,
} from './report-rows';

const directory = (over: Partial<ReportDirectory> = {}): ReportDirectory => ({
  profiles: new Map(), classNames: new Map(), studentsById: new Map(), studentsByExamEmail: new Map(), ...over,
});

describe('aiRiskPoints', () => {
  it('scores machine-confirmed AI signals only', () => {
    expect(aiRiskPoints('ai_cell_phone', { machine_confirmed: true })).toBe(3);
    expect(aiRiskPoints('ai_multiple_face', { machine_confirmed: 'true' })).toBe(2);
    expect(aiRiskPoints('ai_no_face', { machine_confirmed: true })).toBe(1);
    expect(aiRiskPoints('ai_prohibited_object', { machine_confirmed: true })).toBe(2);
    expect(aiRiskPoints('ai_cell_phone', {})).toBe(0);
    expect(aiRiskPoints('focus_lost', { machine_confirmed: true })).toBe(0);
  });
});

describe('isPassed', () => {
  it('needs a score at the threshold and no disqualification', () => {
    expect(isPassed(0.7, false, 0.7)).toBe(true);
    expect(isPassed(0.69, false, 0.7)).toBe(false);
    expect(isPassed(0.9, true, 0.7)).toBe(false);
    expect(isPassed(null, false, 0)).toBe(false);
  });
});

describe('studentDisplayName', () => {
  it('prefers the TTDT name by id, then by exam email, then the profile', () => {
    const profile = { name: 'Hồ sơ', email: 'hv@hptts.vn', student_id: 's1' };
    expect(studentDisplayName(profile, directory({ studentsById: new Map([['s1', { name: 'Theo id' }]]) }))).toBe('Theo id');
    expect(studentDisplayName(profile, directory({ studentsByExamEmail: new Map([['hv@hptts.vn', { name: 'Theo email' }]]) }))).toBe('Theo email');
    expect(studentDisplayName(profile, directory())).toBe('Hồ sơ');
    expect(studentDisplayName({ name: '', email: 'hv@hptts.vn' }, directory())).toBe('hv@hptts.vn');
    expect(studentDisplayName(undefined, directory())).toBe('');
  });
});

describe('evidence', () => {
  const metadata = {
    evidence_path: 'a/single.jpg',
    evidence: [{ path: 'a/before.jpg', phase: 'before' }, { publicUrl: 'https://old/during.jpg', phase: 'during' }, { path: 'a/gone.jpg' }, null],
  };
  const signed = new Map([['a/single.jpg', 'https://signed/single'], ['a/before.jpg', 'https://signed/before']]);

  it('collects every stored path', () => {
    expect(evidencePathsOf(metadata)).toEqual(['a/single.jpg', 'a/before.jpg', 'a/gone.jpg']);
    expect(evidencePathsOf(null)).toEqual([]);
  });

  it('uses a fresh signed URL, else the saved URL, and drops frames without either', () => {
    expect(evidenceUrlOf(metadata, signed)).toBe('https://signed/single');
    expect(evidenceUrlOf({ evidence_url: 'https://old/x.jpg' }, signed)).toBe('https://old/x.jpg');
    expect(evidenceFramesOf(metadata, signed)).toEqual([
      { phase: 'before', publicUrl: 'https://signed/before' },
      { phase: 'during', publicUrl: 'https://old/during.jpg' },
    ]);
  });

  it('reads the review status', () => {
    expect(reviewStatusOf({ review_status: 'rejected' })).toBe('rejected');
    expect(reviewStatusOf({})).toBe('');
  });
});

const signal = (over: Partial<ViolationReportRow>): ViolationReportRow => ({
  id: 'l', attempt_id: 'a1', user_id: 'u1', user_name: 'Nguyễn An', user_email: 'an@hptts.vn', exam_id: 'e', exam_title: 'QC',
  window_id: 'w', class_id: 'c', class_name: 'K1', event: 'focus_lost', created_at: '', metadata: null, risk_points: 0,
  review_status: '', evidence_url: '', evidence: [], ...over,
});

describe('summarizeViolations', () => {
  it('counts signals per attempt and skips AI points reviewed as false detections', () => {
    const rows = summarizeViolations([
      signal({ event: 'focus_lost' }),
      signal({ event: 'focus_lost' }),
      signal({ event: 'ai_cell_phone', risk_points: 3 }),
      signal({ event: 'ai_no_face', risk_points: 1, review_status: 'rejected' }),
      signal({ attempt_id: 'a2', user_name: 'Trần Bình', event: 'photo_taken' }),
      signal({ attempt_id: '' }),
    ]);
    expect(rows.map((r) => r.attempt_id)).toEqual(['a1', 'a2']);
    expect(rows[0]).toMatchObject({ focusLostCount: 2, aiCellPhoneCount: 1, aiNoFaceCount: 1, aiRiskScore: 3 });
    expect(rows[1]).toMatchObject({ photoTakenCount: 1, aiRiskScore: 0 });
    expect(searchViolationSummaries(rows, ' trần ').map((r) => r.attempt_id)).toEqual(['a2']);
    expect(searchViolationSummaries(rows, '')).toHaveLength(2);
  });
});

const result = (over: Partial<AttemptReportRow>): AttemptReportRow => ({
  id: 'abc123', user_id: 'u', user_name: 'Nguyễn An', user_email: 'an@hptts.vn', exam_id: 'e', exam_title: 'QC', window_id: 'w1',
  class_id: 'c1', class_name: 'FL-K103', score: 0.755, raw_score: 15, passed: true, disqualified: false, completed_at: '1/10/2026',
  synced_to_ttdt_at: null, ...over,
});

describe('result rows', () => {
  it('searches name, email, exam, class and attempt id', () => {
    const rows = [result({}), result({ id: 'zzz', user_name: 'Bình', user_email: '', exam_title: 'Khác', class_name: '' })];
    expect(searchResultRows(rows, 'fl-k103').map((r) => r.id)).toEqual(['abc123']);
    expect(searchResultRows(rows, 'ZZZ').map((r) => r.id)).toEqual(['zzz']);
  });

  it('builds the "Kết quả thi" sheet', () => {
    const sheet = resultSheetRows([result({}), result({ score: null, disqualified: true, synced_to_ttdt_at: 'x', class_name: '' })]);
    expect(sheet[0]).toHaveLength(9);
    expect(sheet[1]).toEqual(['abc123', 'Nguyễn An', 'an@hptts.vn', 'QC', 'w1 / FL-K103', '75.5% (15)', 'Đạt', '1/10/2026', 'Chưa']);
    expect(sheet[2].slice(4)).toEqual(['w1 / c1', '', 'Loại', '1/10/2026', 'Có']);
  });

  it('builds the "Vi pham" sheet', () => {
    const sheet = violationSheetRows(summarizeViolations([signal({ event: 'ai_cell_phone', risk_points: 3 })]));
    expect(sheet[0]).toHaveLength(13);
    expect(sheet[1]).toEqual(['a1', 'Nguyễn An', 'an@hptts.vn', 0, 0, 0, 0, 0, 0, 0, 1, 0, 3]);
  });
});
