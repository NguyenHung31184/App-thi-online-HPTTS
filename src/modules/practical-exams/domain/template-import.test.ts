import { describe, expect, it } from 'vitest';
import { draftFromSheets, draftFromWord, secondsFrom, type WordTextBlock } from './template-import';

describe('Excel template', () => {
  const sheets = {
    Chung: [['Mục', 'Giá trị'], ['Tên đề', 'RTG Khóa 44'], ['Điểm đạt', 70], ['Mốc khung 1', '3:30'], ['Mốc khung 2', '5:00'], ['Mốc khung 3', '6:30'],
      ['Điểm khung 1', 20], ['Điểm khung 2', 10], ['Điểm khung 3', 5], ['Tính nhiều chu kỳ', 'nhanh nhất']],
    'Bước': [['Tên bước', 'Chu kỳ bấm giờ', 'Ảnh cần chụp'], ['Kiểm tra an toàn', '', ''], ['Nâng – di chuyển – hạ', 'x', 'Container tại vị trí']],
    'Tiêu chí': [
      ['Bước', 'Tiêu chí', 'Điểm tối đa', 'Tiêu chí đánh giá chi tiết', 'Lỗi trừ nhanh', 'Loại'],
      [1, 'Kiểm tra an toàn', 30, 'Phanh, còi, đèn', 'Bỏ sót hạng mục | 2; Không báo cáo | 1', ''],
      ['Nâng – di chuyển – hạ', 'Hạ container', 50, '', 'Hạ mạnh | 3', ''],
      [2, 'Thời gian một chu kỳ', 20, '', '', 'Thời gian'],
      ['', 'Không điểm', '', '', '', ''],
    ],
    'Bảo hộ & lỗi loại': [['Bảo hộ', 'Lỗi loại'], ['Mũ', 'Va chạm'], ['Giày', 'Rơi hàng']],
  };

  it('reads steps, criteria, bands, lists and the pass mark', () => {
    const draft = draftFromSheets(sheets);
    expect(draft.title).toBe('RTG Khóa 44');
    expect(draft.config.steps).toEqual([
      { key: 's1', name: 'Kiểm tra an toàn', cycle: false, photo: '' },
      { key: 's2', name: 'Nâng – di chuyển – hạ', cycle: true, photo: 'Container tại vị trí' },
    ]);
    expect(draft.config.time).toEqual({ limits: [210, 300, 390], points: [20, 10, 5], aggregate: 'fastest' });
    expect(draft.criteria.map((c) => [c.name, c.maxScore, c.stepKey, c.kind])).toEqual([
      ['Kiểm tra an toàn', 30, 's1', 'score'], ['Hạ container', 50, 's2', 'score'], ['Thời gian một chu kỳ', 20, 's2', 'time'],
    ]);
    expect(draft.criteria[0].deductions).toEqual([{ label: 'Bỏ sót hạng mục', points: 2 }, { label: 'Không báo cáo', points: 1 }]);
    expect(draft.config.ppe).toEqual(['Mũ', 'Giày']);
    expect(draft.config.disqualifyReasons).toEqual(['Va chạm', 'Rơi hàng']);
    expect(draft.warnings).toEqual(['Tiêu chí "Không điểm" không có điểm tối đa, bỏ qua.']);
  });

  it('reads times typed as m:ss, minutes or Excel time', () => {
    expect([secondsFrom('3:30'), secondsFrom('3,5'), secondsFrom(5), secondsFrom(210 / 86400)]).toEqual([210, 210, 300, 210]);
  });
});

describe('Word score sheet', () => {
  let row = 0;
  const p = (text: string, listFormat: string | null = null): WordTextBlock => ({ text, tableRow: null, tableCell: null, listFormat });
  const tr = (...cells: string[][]): WordTextBlock[] => {
    row += 1;
    return cells.flatMap((lines, cell) => lines.map((text) => ({ text, tableRow: row, tableCell: cell, listFormat: null })));
  };
  const sheet: WordTextBlock[] = [
    p('PHẦN CHẤM ĐIỂM THỰC HÀNH'), p('VẬN HÀNH CẦN TRỤC GIÀN RTG'),
    p('Lớp :Vận hành cần trục giàn RTG – Khóa 43'),
    ...tr(['STT'], ['Nội dung', 'kiểm tra'], ['Tiêu chí đánh giá chi tiết'], ['Điểm', 'tối đa'], ['Điểm', 'đạt được'], ['Nhận xét']),
    ...tr(['1'], ['Kiểm tra an toàn trước khi vận hành RTG'], ['- Kiểm tra phanh, còi, đèn.', '- Kiểm tra khu vực làm việc.'], ['10'], [''], ['']),
    ...tr(['2'], ['Khởi động và di chuyển cầu giàn RTG'], ['- Đúng quy trình khởi động.'], ['10'], [''], ['']),
    ...tr(['3'], ['Căn chỉnh và nâng container'], ['- Căn chỉnh spreader chính xác.'], ['15'], [''], ['']),
    ...tr(['4'], ['Di chuyển container'], ['- Giữ container cân bằng.'], ['15'], [''], ['']),
    ...tr(['5'], ['Hạ container'], ['- Hạ nhẹ nhàng.'], ['20'], [''], ['']),
    ...tr(['6'], ['Kết thúc và bàn giao thiết bị'], ['- Tắt máy đúng trình tự.'], ['5'], [''], ['']),
    ...tr(['7'], ['Tác phong, tuân thủ an toàn'], ['- Trang bị bảo hộ đúng quy định.'], ['5'], [''], ['']),
    ...tr(['8'], ['Thời gian hoàn thành cho một chu kỳ'], ['Dưới 3,5 phút (18 move/ giờ)', 'Từ 4,5 phút – 5 phút', 'Trên 5 phút'], ['20', '10', '5'], [''], ['']),
    ...tr([''], ['TỔNG CỘNG'], [''], ['100'], [''], ['']),
    p('Ghi chú:'), p('- Không thực hiện đầy đủ BHLĐ: Không được tham gia kiểm tra thực hành;'), p('- Đánh rơi, đổ mã hàng: không đạt.'),
  ];

  it('reads the criteria, the time bands and the notes of the RTG Khóa 43 sheet', () => {
    const draft = draftFromWord(sheet);
    expect(draft.title).toBe('Vận hành cần trục giàn RTG – Khóa 43');
    expect(draft.criteria.map((c) => [c.name, c.maxScore, c.kind])).toEqual([
      ['Kiểm tra an toàn trước khi vận hành RTG', 10, 'score'], ['Khởi động và di chuyển cầu giàn RTG', 10, 'score'],
      ['Căn chỉnh và nâng container', 15, 'score'], ['Di chuyển container', 15, 'score'], ['Hạ container', 20, 'score'],
      ['Kết thúc và bàn giao thiết bị', 5, 'score'], ['Tác phong, tuân thủ an toàn', 5, 'score'], ['Thời gian hoàn thành cho một chu kỳ', 20, 'time'],
    ]);
    expect(draft.criteria[0].description).toBe('Kiểm tra phanh, còi, đèn.; Kiểm tra khu vực làm việc.');
    expect(draft.config.time).toEqual({ limits: [210, 300, 390], points: [20, 10, 5], aggregate: 'average' });
    expect(draft.config.disqualifyReasons).toEqual(['Đánh rơi, đổ mã hàng']);
  });

  it('proposes steps: one timed cycle for lifting, moving and lowering; none for conduct', () => {
    const draft = draftFromWord(sheet);
    expect(draft.config.steps.map((s) => [s.key, s.name, s.cycle])).toEqual([
      ['s1', 'Kiểm tra an toàn trước khi vận hành RTG', false], ['s2', 'Khởi động và di chuyển cầu giàn RTG', false],
      ['s3', 'Chu kỳ nâng – di chuyển – hạ', true], ['s4', 'Kết thúc và bàn giao thiết bị', false],
    ]);
    expect(draft.criteria.map((c) => c.stepKey)).toEqual(['s1', 's2', 's3', 's3', 's3', 's4', null, 's3']);
    expect(draft.warnings.some((w) => w.startsWith('Khung thời gian suy từ phiếu'))).toBe(true);
  });

  it('reads the numbered faults under "Các lỗi vi phạm", skipping the a/b/c group titles', () => {
    const test = [
      p('V. Các lỗi vi phạm (Loại trực tiếp nếu có)'),
      p('Học viên sẽ bị loại trực tiếp nếu vi phạm một trong các lỗi dưới đây:'),
      p('Vi phạm an toàn lao động', 'lowerLetter'),
      p('1. Không mang hoặc mang thiếu trang bị bảo hộ lao động.'),
      p('Điều khiển cần trục khi chưa được phép.', 'decimal'),
      p('b. Vi phạm kỹ thuật – quy trình vận hành'),
      p('1. Hạ container sai vị trí;'),
      p('Không gài khóa spreader đúng kỹ thuật.'),
      p('Nơi nhận:'), p('1. Lưu TTĐT.'),
    ];
    const draft = draftFromWord([...sheet.filter((b) => !b.text.startsWith('- Đánh rơi')), ...test]);
    expect(draft.config.disqualifyReasons).toEqual([
      'Không mang hoặc mang thiếu trang bị bảo hộ lao động', 'Điều khiển cần trục khi chưa được phép', 'Hạ container sai vị trí',
      'Không gài khóa spreader đúng kỹ thuật',
    ]);
    expect(draft.passScore).toBe(70);
  });
});
