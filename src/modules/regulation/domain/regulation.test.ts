import { describe, expect, it } from 'vitest';
import { needsRegulationAck, regulationAckErrorMessage, regulationCheckApplies } from './regulation';

const status = { title: 'Quy chế đào tạo', url: 'https://x/qc.pdf', version: '2026-11-05T01:00:00.123456+00:00' };

describe('regulation acknowledgement', () => {
  it('asks only when a regulation is published and not yet confirmed', () => {
    expect(needsRegulationAck(null)).toBe(false);
    expect(needsRegulationAck({ ...status, acknowledgedAt: null })).toBe(true);
    expect(needsRegulationAck({ ...status, acknowledgedAt: '2026-11-05T02:00:00+00:00' })).toBe(false);
  });

  it('checks student accounts on every page except a running exam', () => {
    expect(regulationCheckApplies('/dashboard', 'hv1')).toBe(true);
    expect(regulationCheckApplies('/student/learn/abc', 'hv1')).toBe(true);
    expect(regulationCheckApplies('/exam/123', 'hv1')).toBe(false);
    expect(regulationCheckApplies('/exam/123/result', 'hv1')).toBe(false);
    expect(regulationCheckApplies('/dashboard', null)).toBe(false);
  });

  it('turns server codes into Vietnamese messages', () => {
    expect(regulationAckErrorMessage('regulation_changed')).toMatch(/cập nhật Quy chế/);
    expect(regulationAckErrorMessage(' not_exam_student ')).toMatch(/giám thị/);
    expect(regulationAckErrorMessage('Failed to fetch')).toMatch(/kết nối/);
  });
});
