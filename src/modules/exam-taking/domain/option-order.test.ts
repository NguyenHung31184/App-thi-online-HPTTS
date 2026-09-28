import { describe, expect, it } from 'vitest';
import { optionLetter, referencesOtherOptions } from './option-order';

describe('referencesOtherOptions', () => {
  it('finds options that name other options', () => {
    for (const text of [
      'Đáp án a, b đúng',
      'Đáp án a, b, và c đúng',
      'đáp án a, c. đúng',
      'Cả hai phương án trên.',
      'Cả ba đáp án trên',
      'Tất cả các ý trên',
      'Tất cả các nguyên nhân trên.',
      'Tất cả phương án trên.',
      'Một trong các nguyên nhân trên',
      'Các đáp án nêu trên đều sai',
      'Phương án: a và b',
      'Cả B và C.',
    ]) {
      expect(referencesOtherOptions(['Nâng tải', text]), text).toBe(true);
    }
  });

  it('leaves ordinary options alone', () => {
    for (const text of [
      'Bật tất cả đèn và còi cảnh báo',
      'Cả hai đều cho phép tiếp tục làm việc bình thường',
      'Tất cả người không nhiệm vụ trong vùng đó',
      'Không có ý nghĩa gì',
      'Hạ khung chụp lên container 40 feets',
      'Gió từ cấp 6 trở lên',
      'Kiểm tra dây móc trước khi nâng',
      'Vị trí cụ thể của từng lô hàng trong các hầm tàu hoặc trên boong.',
      'Chỉ cần kiểm tra các đèn báo trên bảng điều khiển.',
    ]) {
      expect(referencesOtherOptions([text]), text).toBe(false);
    }
  });
});

describe('optionLetter', () => {
  it('counts from a', () => {
    expect([0, 1, 4].map(optionLetter)).toEqual(['a', 'b', 'e']);
  });
});
