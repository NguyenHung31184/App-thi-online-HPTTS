import { describe, expect, it } from 'vitest';
import { otherTargets, readHandoffToken } from './app-handoff';

describe('chuyển app', () => {
  it('đọc mã trong #handoff=', () => {
    expect(readHandoffToken('#handoff=abc%2B123')).toBe('abc+123');
    expect(readHandoffToken('#x=1&handoff=tok')).toBe('tok');
    expect(readHandoffToken('#access_token=zzz')).toBeNull();
    expect(readHandoffToken('')).toBeNull();
  });

  it('chỉ hiện app khác app đang đứng, đúng thứ tự, bỏ giá trị lạ', () => {
    expect(otherTargets(['thi', 'quanly', 'socc', 'evil'], 'quanly')).toEqual(['socc', 'thi']);
    expect(otherTargets(['quanly'], 'quanly')).toEqual([]);
    expect(otherTargets(null, 'thi')).toEqual([]);
  });
});
