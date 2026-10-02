import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import type { PracticalExamTemplate } from '../../../types';
import { readDocxBlocks } from '../../question-bank/public';
import { insertCriteria, insertTemplate } from '../data/template-repository';
import { fieldConfigRow } from '../domain/field-config';
import { draftFromSheets, draftFromWord, type TemplateDraft } from '../domain/template-import';

export type { TemplateDraft };

async function readWord(buffer: ArrayBuffer): Promise<TemplateDraft> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Không mở được file Word. Mở bằng Word, lưu lại dạng .docx rồi chọn lại.');
  }
  const part = (name: string) => zip.file(name)?.async('string') ?? Promise.resolve(null);
  const document = await part('word/document.xml');
  if (!document) throw new Error('File không phải văn bản Word (.docx).');
  const blocks = readDocxBlocks({
    document,
    numbering: await part('word/numbering.xml'),
    relationships: await part('word/_rels/document.xml.rels'),
    styles: await part('word/styles.xml'),
  });
  return draftFromWord(blocks.map((b) => ({ text: b.text, tableRow: b.tableRow, tableCell: b.tableCell, listFormat: b.numbering?.format ?? null })));
}

function readExcel(buffer: ArrayBuffer): TemplateDraft {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch {
    throw new Error('Không đọc được file Excel.');
  }
  const sheets: Record<string, unknown[][]> = {};
  for (const name of workbook.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: '', blankrows: false });
  }
  return draftFromSheets(sheets);
}

/** Reads a .xlsx/.xls (our template) or .docx (the centre's score sheet) into a draft; nothing is saved. */
export async function readTemplateFile(file: File): Promise<TemplateDraft> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (name.endsWith('.docx')) return readWord(buffer);
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return readExcel(buffer);
  if (name.endsWith('.doc')) throw new Error('File .doc cũ: mở bằng Word, lưu lại dạng .docx rồi chọn lại.');
  throw new Error('Chọn file Excel (.xlsx) theo mẫu hoặc file Word (.docx) của phiếu chấm.');
}

/** Creates the template and its criteria from a checked draft. */
export async function createTemplateFromDraft(
  draft: TemplateDraft, input: { title: string; moduleId: string | null; passScore: number; createdBy: string | null },
): Promise<PracticalExamTemplate> {
  const template = await insertTemplate({
    title: input.title, module_id: input.moduleId, pass_score: input.passScore, config: fieldConfigRow(draft.config), created_by: input.createdBy,
  });
  for (const [index, c] of draft.criteria.entries()) {
    await insertCriteria({
      template_id: template.id, order_index: index, name: c.name, description: c.description, max_score: c.maxScore,
      weight: 1, score_step: 1, step_key: c.stepKey, kind: c.kind, deductions: c.deductions,
    });
  }
  return template;
}

/** The Excel template to fill in, with one worked example (RTG). */
export function buildExcelTemplate(): Blob {
  const book = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[][], widths: number[]) => {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(book, sheet, name);
  };
  add('Chung', [
    ['Mục', 'Giá trị', 'Ghi chú'],
    ['Tên đề', 'Vận hành cần trục giàn RTG – Khóa 44', ''],
    ['Điểm đạt', 70, 'trên 100'],
    ['Mốc khung 1', '3:30', 'phút:giây; dưới mốc này được điểm khung 1'],
    ['Mốc khung 2', '5:00', ''],
    ['Mốc khung 3', '6:30', 'từ mốc này trở lên: 0 điểm'],
    ['Điểm khung 1', 20, ''], ['Điểm khung 2', 10, ''], ['Điểm khung 3', 5, ''],
    ['Tính nhiều chu kỳ', 'trung bình', 'trung bình / nhanh nhất / chu kỳ cuối'],
  ], [20, 40, 45]);
  add('Bước', [
    ['Tên bước', 'Chu kỳ bấm giờ', 'Ảnh cần chụp'],
    ['Kiểm tra an toàn trước khi vận hành', '', ''],
    ['Khởi động và di chuyển cầu giàn', '', ''],
    ['Chu kỳ nâng – di chuyển – hạ container', 'x', 'Container tại vị trí đặt'],
    ['Kết thúc và bàn giao thiết bị', '', 'Spreader về vị trí an toàn'],
  ], [40, 16, 32]);
  add('Tiêu chí', [
    ['Bước', 'Tiêu chí', 'Điểm tối đa', 'Tiêu chí đánh giá chi tiết', 'Lỗi trừ nhanh', 'Loại'],
    [1, 'Kiểm tra an toàn trước khi vận hành RTG', 10, 'Phanh, còi, đèn, camera, cáp, móc khóa', 'Bỏ sót hạng mục kiểm tra | 2; Không báo tình trạng thiết bị | 2', ''],
    [2, 'Khởi động và di chuyển cầu giàn RTG', 10, 'Đúng quy trình khởi động; không rung lắc', 'Sai trình tự khởi động | 2; Rung lắc khi di chuyển | 2', ''],
    [3, 'Căn chỉnh và nâng container', 15, '', 'Căn chỉnh spreader nhiều lần | 2; Khóa chốt sai thao tác | 3', ''],
    [3, 'Di chuyển container', 15, '', 'Container lắc | 2; Chạm khung nhẹ | 3', ''],
    [3, 'Hạ container', 20, '', 'Hạ mạnh | 3; Lệch vị trí, phải chỉnh lại | 3', ''],
    [4, 'Kết thúc và bàn giao thiết bị', 5, '', 'Không ghi sổ bàn giao | 1', ''],
    ['', 'Tác phong, tuân thủ an toàn', 5, 'Để trống cột Bước: chấm được ở mọi bước', 'Không tuân thủ tín hiệu | 2', ''],
    [3, 'Thời gian hoàn thành một chu kỳ', 20, 'Điểm theo khung thời gian ở sheet Chung', '', 'Thời gian'],
  ], [10, 40, 12, 42, 60, 12]);
  add('Bảo hộ & lỗi loại', [
    ['Bảo hộ lao động', 'Lỗi loại trực tiếp'],
    ['Mũ bảo hộ', 'Điều khiển khi chưa được phép của giám khảo'],
    ['Giày bảo hộ', 'Không dừng thiết bị khi phát hiện sự cố nguy hiểm'],
    ['Áo phản quang', 'Container nghiêng, va đập xe mooc hoặc hàng hóa khác'],
    ['Găng tay', 'Đánh rơi, đổ mã hàng'],
  ], [24, 55]);
  const data = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
