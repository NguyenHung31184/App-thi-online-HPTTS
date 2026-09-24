import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { validateMediaUrl } from '../../../utils/mediaUrlValidator';
import { OPTION_IDS } from '../domain/question-draft';
import { IMAGE_EXTENSIONS, MAX_IMPORT_ROWS, contentKey, imageKey, planImport, readImportSheet, type ImportPlan, type ImportSheet } from '../domain/question-import';
import type { QuestionLibrary, QuestionStatus } from '../domain/question-library';
import { insertQuestions, listLibraryQuestionContent, uploadQuestionImage } from '../data/question-repository';
import { resolveLibraryCourse } from './library-course';

export interface ImportPreview {
  fileName: string;
  plan: ImportPlan;
  /** Pictures from a ZIP by `imageKey`; null for a plain spreadsheet. */
  images: Map<string, Blob> | null;
}

const SPREADSHEET = /\.(xlsx|xls|csv)$/i;
const IMAGE_MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };

function sheetFromWorkbook(workbook: XLSX.WorkBook): ImportSheet {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('File không có trang tính nào.');
  const cells = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: true });
  const firstLine = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']).s.r + 1 : 1;
  return readImportSheet(cells, firstLine);
}

function readSpreadsheet(name: string, buffer: ArrayBuffer): ImportSheet {
  if (/\.csv$/i.test(name)) {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw new Error('File CSV không lưu ở dạng UTF-8 nên sẽ mất dấu tiếng Việt. Trong Excel, lưu lại bằng "CSV UTF-8", hoặc chọn file .xlsx.');
    }
    // Read from decoded text: given raw bytes, the library reads a UTF-8 CSV without BOM as Latin-1.
    // raw keeps each cell as written, so "01" or "1.5" are not turned into numbers or dates.
    return sheetFromWorkbook(XLSX.read(text, { type: 'string', raw: true }));
  }
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch {
    throw new Error('Không đọc được file bảng tính. Mở bằng Excel, lưu lại dạng .xlsx rồi chọn lại.');
  }
  return sheetFromWorkbook(workbook);
}

async function readZip(buffer: ArrayBuffer): Promise<{ sheet: ImportSheet; images: Map<string, Blob> }> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('Không giải nén được file ZIP.');
  }
  // Skip macOS metadata and Excel lock files that ride along when a folder is zipped.
  const entries = Object.values(zip.files).filter((entry) => {
    const base = entry.name.split('/').pop() ?? '';
    return !entry.dir && !entry.name.startsWith('__MACOSX/') && !base.startsWith('._') && !base.startsWith('~$');
  });
  const spreadsheets = entries.filter((entry) => SPREADSHEET.test(entry.name));
  if (spreadsheets.length === 0) throw new Error('Trong file ZIP không có file Excel (.xlsx, .xls) hay CSV.');
  if (spreadsheets.length > 1) throw new Error(`Trong file ZIP có ${spreadsheets.length} file bảng tính. Chỉ để lại một file.`);
  const sheet = readSpreadsheet(spreadsheets[0].name, await spreadsheets[0].async('arraybuffer'));

  const inImagesFolder = (name: string) => Number(/^images\//i.test(name));
  const pictures = entries
    .filter((entry) => IMAGE_EXTENSIONS.includes(entry.name.split('.').pop()?.toLowerCase() ?? ''))
    // Loaded last, so a picture in images/ wins over one with the same name elsewhere in the ZIP.
    .sort((a, b) => inImagesFolder(a.name) - inImagesFolder(b.name));
  const images = new Map<string, Blob>();
  for (const entry of pictures) {
    const blob = await entry.async('blob');
    const extension = entry.name.split('.').pop()?.toLowerCase() ?? '';
    images.set(imageKey(entry.name), blob.slice(0, blob.size, IMAGE_MIME[extension]));
  }
  return { sheet, images };
}

/** Reads the file and checks every row against the library; nothing is stored. */
export async function previewQuestionImport(libraryId: string, file: File): Promise<ImportPreview> {
  const buffer = await file.arrayBuffer();
  let sheet: ImportSheet;
  let images: Map<string, Blob> | null = null;
  if (/\.zip$/i.test(file.name)) ({ sheet, images } = await readZip(buffer));
  else if (SPREADSHEET.test(file.name)) sheet = readSpreadsheet(file.name, buffer);
  else throw new Error('Chỉ nhận file .xlsx, .xls, .csv hoặc .zip.');

  if (sheet.rows.length === 0) throw new Error('Trang tính đầu tiên không có dòng câu hỏi nào dưới dòng tiêu đề.');
  if (sheet.rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`File có ${sheet.rows.length} dòng, mỗi lần nhập tối đa ${MAX_IMPORT_ROWS} dòng. Tách thành nhiều file.`);
  }

  const existing = await listLibraryQuestionContent(libraryId);
  const plan = planImport(sheet, {
    validateMediaUrl,
    imageSizes: images && new Map([...images].map(([key, blob]) => [key, blob.size])),
    existingKeys: new Set(existing.map((question) => contentKey(question.stem, question.options))),
  });
  return { fileName: file.name, plan, images };
}

export type ImportProgress = { step: 'images'; done: number; total: number } | { step: 'saving' };

export interface RunImportInput {
  library: QuestionLibrary;
  preview: ImportPreview;
  status: QuestionStatus;
  createdBy: string | null;
  onProgress?: (progress: ImportProgress) => void;
}

async function uploadWithRetry(file: File, libraryId: string, nameHint: string): Promise<string> {
  try {
    return await uploadQuestionImage(file, libraryId, nameHint);
  } catch {
    return uploadQuestionImage(file, libraryId, nameHint);
  }
}

/** Uploads the pictures, then stores every ready row in one insert. Returns the number of questions stored. */
export async function runQuestionImport({ library, preview, status, createdBy, onProgress }: RunImportInput): Promise<number> {
  const { ready } = preview.plan;
  if (ready.length === 0) throw new Error('Không có câu nào sẵn sàng để nhập.');
  const course = await resolveLibraryCourse(library);

  const keys = [...new Set(ready.flatMap((row) => (row.imageName ? [imageKey(row.imageName)] : [])))];
  const urls = new Map<string, string>();
  for (const [index, key] of keys.entries()) {
    onProgress?.({ step: 'images', done: index, total: keys.length });
    const blob = preview.images?.get(key);
    if (!blob) throw new Error(`Không còn ảnh "${key}" trong file đã đọc. Chọn lại file.`);
    try {
      urls.set(key, await uploadWithRetry(new File([blob], key, { type: blob.type }), library.id, `import-${index + 1}`));
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : 'lỗi mạng';
      throw new Error(`Không tải được ảnh "${key}" lên (${detail}). Chưa lưu câu nào, bấm nhập lại.`);
    }
  }

  onProgress?.({ step: 'saving' });
  return insertQuestions(ready.map((row) => ({
    ...row.payload,
    status,
    image_url: row.imageName ? urls.get(imageKey(row.imageName)) ?? null : null,
    library_id: library.id,
    module_id: library.moduleId,
    occupation_id: course,
    source: 'spreadsheet_import',
    created_by: createdBy,
  })));
}

const TEMPLATE_HEADER = ['Nội dung câu hỏi', ...OPTION_IDS.map((id) => `Đáp án ${id}`), 'Đáp án đúng', 'Loại câu hỏi', 'Keys', 'Chủ đề', 'Độ khó', 'Điểm', 'Tên file ảnh'];

function exampleRow(stem: string, options: string[], answer: string, type: string, keys: string, topic: string, points: number, image = ''): (string | number)[] {
  return [stem, ...OPTION_IDS.map((_, index) => options[index] ?? ''), answer, type, keys, topic, 'Trung bình', points, image];
}

const TEMPLATE_RULES = [
  'Cách ghi',
  'Hệ thống chỉ đọc trang tính đầu tiên (Cau_hoi). Mỗi dòng là một câu. Trang này chỉ để xem mẫu.',
  'Loại câu hỏi để trống: có đáp án thì là Trắc nghiệm, không có đáp án mà có Keys thì là Tự luận.',
  'Trắc nghiệm: Đáp án đúng ghi một chữ A–J hoặc số 1–10.',
  'Nhiều đáp án: các đáp án đúng cách nhau bằng dấu chấm phẩy, ví dụ A;C.',
  'Kéo thả: thứ tự đúng của tất cả các nhãn, ví dụ B;A;D;C.',
  'Đúng/Sai: một giá trị cho mỗi phát biểu A, B, C…, ví dụ Đ;S;Đ;S (hoặc T;F;T;F).',
  'Nối đôi: cột trái là các đáp án A, B, C…; cột phải ghi ở Keys, cách nhau bằng dấu chấm phẩy; Đáp án đúng ghi A-1;B-2.',
  'Tự luận: để trống Đáp án đúng; Keys ghi các ý chấm dạng ý|điểm;ý|điểm.',
  'Độ khó: Dễ, Trung bình hoặc Khó, để trống là Trung bình. Điểm: số nguyên từ 1, để trống là 2.',
  'Tên file ảnh: chỉ dùng khi nhập ZIP. Ảnh để trong thư mục images/ cạnh file Excel; JPG, PNG, GIF hoặc WEBP, tối đa 5 MB.',
];

/** The question sheet (header only) comes first because the importer reads the first sheet. */
export async function buildImportTemplate(kind: 'spreadsheet' | 'zip'): Promise<{ fileName: string; blob: Blob }> {
  const examples = [
    exampleRow('Máy nâng dùng để làm gì?', ['Nâng hàng', 'Lái xe', 'Đóng gói', 'Kiểm tra hàng'], 'A', 'Trắc nghiệm', '', 'Kiến thức cơ bản', 1, kind === 'zip' ? 'cau1.jpg' : ''),
    exampleRow('Thiết bị nào sau đây thuộc nhóm thiết bị nâng?', ['Cẩu trục', 'Palăng xích', 'Xe đẩy tay', 'Thang nâng'], 'A;B;D', 'Nhiều đáp án', '', 'Thiết bị', 2),
    exampleRow('Sắp xếp quy trình nâng hàng theo đúng thứ tự', ['Móc cẩu vào hàng', 'Kiểm tra tải trọng', 'Ra lệnh nâng', 'Quan sát vùng nguy hiểm'], 'B;A;D;C', 'Kéo thả', '', 'Vận hành thiết bị', 2),
    exampleRow('Xác định Đúng hoặc Sai cho từng phát biểu về an toàn vận hành cẩu RTG:', ['Phải kiểm tra khu vực trước khi nâng hàng.', 'Được phép nâng vượt tải 20% khi khẩn cấp.', 'Mọi hạn vị phải hoạt động trước mỗi ca.', 'Không cần tắt nguồn khi bảo trì nhỏ.'], 'Đ;S;Đ;S', 'Đúng/Sai', '', 'An toàn vận hành', 4),
    exampleRow('Nối thiết bị RTG với chức năng đúng:', ['Bộ chống lắc hàng', 'Công tắc hành trình', 'Thiết bị đo tải', 'Cơ cấu Skew'], 'A-1;B-2;C-3;D-4', 'Nối đôi', 'Hãm lắc container khi xe con tăng/giảm tốc;Ngắt mạch khi chạm điểm giới hạn;Đo tải và ngắt tời khi quá tải;Vi chỉnh góc xoay để căn lỗ chốt gù', 'Thiết bị', 4),
    exampleRow('Nêu các nguyên nhân gây tai nạn lao động tại cảng biển.', [], '', 'Tự luận', 'sai quy trình|2;thiếu bảo hộ|2;không kiểm tra thiết bị|2;vi phạm quy định|2;chủ quan|2', 'An toàn lao động', 10),
  ];
  const questions = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADER]);
  const sample = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADER, ...examples, [], ...TEMPLATE_RULES.map((line) => [line])]);
  const widths = [{ wch: 50 }, ...OPTION_IDS.map(() => ({ wch: 20 })), { wch: 16 }, { wch: 16 }, { wch: 40 }, { wch: 18 }, { wch: 12 }, { wch: 8 }, { wch: 16 }];
  questions['!cols'] = widths;
  sample['!cols'] = widths;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, questions, 'Cau_hoi');
  XLSX.utils.book_append_sheet(workbook, sample, 'Vi_du');
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;

  if (kind === 'spreadsheet') {
    return { fileName: 'Mau_nhap_cau_hoi.xlsx', blob: new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) };
  }
  const zip = new JSZip();
  zip.file('cau_hoi.xlsx', bytes);
  zip.folder('images');
  return { fileName: 'Mau_nhap_cau_hoi_kem_anh.zip', blob: await zip.generateAsync({ type: 'blob' }) };
}
