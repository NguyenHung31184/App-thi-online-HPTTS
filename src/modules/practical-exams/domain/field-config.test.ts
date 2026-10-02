import { describe, expect, it } from 'vitest';
import {
  countedSeconds, deductionsFromText, deductionsToText, DEFAULT_PPE, equalBands, fieldConfigProblems, fieldConfigRow, fieldTotals,
  readFieldConfig, scoreAfterDeductions, timeScore, type TimeRule,
} from './field-config';

const rule: TimeRule = { limits: [120, 240, 360], points: [20, 10, 5], aggregate: 'average' };

describe('time bands', () => {
  it('splits the standard time into three equal bands', () => {
    expect(equalBands(360)).toEqual([120, 240, 360]);
  });
  it('scores each band and 0 past the standard time', () => {
    expect([0, 119, 120, 239, 240, 359, 360, 500].map((s) => timeScore(s, rule))).toEqual([20, 20, 10, 10, 5, 5, 0, 0]);
  });
  it('counts the average, fastest or last timed cycle', () => {
    expect(countedSeconds([100, 200, 0], 'average')).toBe(150);
    expect(countedSeconds([100, 200], 'fastest')).toBe(100);
    expect(countedSeconds([100, 200], 'last')).toBe(200);
    expect(countedSeconds([], 'average')).toBeNull();
  });
});

describe('scores', () => {
  it('takes deductions from the maximum, never below 0', () => {
    expect(scoreAfterDeductions(15, [{ label: 'a', points: 2 }, { label: 'b', points: 1.5 }])).toBe(11.5);
    expect(scoreAfterDeductions(5, [{ label: 'a', points: 9 }])).toBe(0);
  });
  it('totals on 100 and 10, with the pass mark, and 0 when disqualified', () => {
    expect(fieldTotals([10, 10, 15, 15, 17.5, 5, 5, 10], false, 70)).toEqual({ total: 87.5, outOf10: 8.8, passed: true });
    expect(fieldTotals([10, 50], false, 70)).toEqual({ total: 60, outOf10: 6, passed: false });
    expect(fieldTotals([90], true, 70)).toEqual({ total: 0, outOf10: 0, passed: false });
  });
  it('reads quick deductions from "label | points" lines and back', () => {
    const list = deductionsFromText('Rung lắc | 2\nbad line\nChạm khung | 3\n | 1');
    expect(list).toEqual([{ label: 'Rung lắc', points: 2 }, { label: 'Chạm khung', points: 3 }]);
    expect(deductionsToText(list)).toBe('Rung lắc | 2\nChạm khung | 3');
  });
});

describe('field config', () => {
  it('fills defaults and drops malformed parts', () => {
    const config = readFieldConfig({ steps: [{ name: 'Nâng hạ', cycle: true, photo: 'Container tại vị trí' }, { name: '' }, 3], time: { limits: [1] } });
    expect(config.ppe).toEqual(DEFAULT_PPE);
    expect(config.steps).toEqual([{ key: 's1', name: 'Nâng hạ', cycle: true, photo: 'Container tại vị trí' }]);
    expect(config.time).toBeNull();
    expect(config.disqualifyReasons.length).toBeGreaterThan(5);
  });
  it('round-trips through the stored form', () => {
    const config = readFieldConfig({ ppe: ['Mũ'], disqualify_reasons: ['Va chạm'], steps: [{ key: 'a', name: 'A' }], time: rule });
    expect(readFieldConfig(fieldConfigRow(config))).toEqual(config);
  });
  it('flags duplicate step keys and bands out of order', () => {
    const config = readFieldConfig({ steps: [{ key: 'a', name: 'A' }, { key: 'a', name: 'B' }], time: { ...rule, limits: [200, 100, 300] } });
    expect(fieldConfigProblems(config)).toEqual(['Hai bước trùng mã.', 'Mốc thời gian phải tăng dần và lớn hơn 0.']);
  });
});
