import { describe, expect, it } from 'vitest';
import { ocrHttpError, ocrNetworkError, ocrResultFrom } from './ocr';
import { explainTheorySyncError } from './sync-errors';

describe('theory sync error help', () => {
  it('picks the help by what the TTDT response mentions', () => {
    expect(explainTheorySyncError('Missing module_id')).toMatch(/^Lỗi liên quan module_id/);
    expect(explainTheorySyncError('bad CLASS_ID')).toMatch(/^Lỗi liên quan class_id/);
    expect(explainTheorySyncError('no enrollment_id')).toMatch(/^Lỗi liên quan student_id/);
    expect(explainTheorySyncError('HTTP 401')).toMatch(/^Lỗi xác thực API TTDT/);
    expect(explainTheorySyncError(null)).toMatch(/^Không nhận diện được/);
  });
});

describe('OCR responses', () => {
  it('maps the proxy fields', () => {
    expect(ocrResultFrom({ id_card_number: '012', name: 'An', dob: '1/1/2000', address: 'HP', gender: 'Nam' })).toEqual({
      id_card_number: '012', full_name: 'An', name: 'An', dob: '1/1/2000', date_of_birth: '1/1/2000',
      id_card_issue_date: undefined, id_card_issue_place: undefined, permanent_address: 'HP', address: 'HP', gender: 'Nam',
    });
  });

  it('explains HTTP and network failures', () => {
    expect(ocrHttpError(429, {})).toMatch(/đang bận/);
    expect(ocrHttpError(500, {})).toMatch(/tạm thời lỗi/);
    expect(ocrHttpError(502, {})).toBe('Lỗi OCR (502)');
    expect(ocrHttpError(500, { error: 'Ảnh mờ' })).toBe('Ảnh mờ');
    const abort = new Error('x');
    abort.name = 'AbortError';
    expect(ocrNetworkError(abort)).toMatch(/quá nhiều thời gian/);
    expect(ocrNetworkError(new TypeError('Failed to fetch'))).toMatch(/^Không kết nối được/);
    expect(ocrNetworkError(new Error('Khác'))).toBe('Khác');
  });
});
