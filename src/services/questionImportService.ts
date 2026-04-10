/**
 * Parse file Excel (.xlsx, .xls) hoặc CSV để lấy danh sách câu hỏi trắc nghiệm 1 đáp án.
 * Mẫu cột: [Nội dung, Đáp án A, Đáp án B, Đáp án C, Đáp án D, Đáp án đúng, Chủ đề, Độ khó, Điểm]
 * Có thể ánh xạ cột khác (column indices 0-based).
 */
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export interface ImportRow {
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  answer: string; // A|B|C|D (sẽ chuẩn hóa)
  topic: string;
  difficulty: string;
  points: number;
}

export interface ImportColumnMap {
  stem: number;
  optionA: number;
  optionB: number;
  optionC: number;
  optionD: number;
  answer: number;
  topic: number;
  difficulty: number;
  points: number;
}

const DEFAULT_MAP: ImportColumnMap = {
  stem: 0,
  optionA: 1,
  optionB: 2,
  optionC: 3,
  optionD: 4,
  answer: 5,
  topic: 6,
  difficulty: 7,
  points: 8,
};

function cell(row: unknown[], col: number): string {
  const v = row[col];
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  return String(v).trim();
}

function normalizeAnswer(a: string): string {
  const s = String(a).trim().toUpperCase();
  if (s === '1' || s === 'A') return 'A';
  if (s === '2' || s === 'B') return 'B';
  if (s === '3' || s === 'C') return 'C';
  if (s === '4' || s === 'D') return 'D';
  return s.slice(0, 1);
}

function normalizeDifficulty(d: string): string {
  const s = String(d).trim().toLowerCase();
  if (s.includes('dễ') || s === 'easy') return 'easy';
  if (s.includes('khó') || s === 'hard') return 'hard';
  return 'medium';
}

/**
 * Đọc file Excel/CSV, trả về mảng các dòng đã map theo columnMap.
 * firstRowIsHeader: true thì bỏ qua dòng đầu.
 */
export function parseFileToRows(
  file: File,
  options: { firstRowIsHeader?: boolean; columnMap?: Partial<ImportColumnMap> }
): Promise<ImportRow[]> {
  const map = { ...DEFAULT_MAP, ...options.columnMap };
  const firstRowIsHeader = options.firstRowIsHeader !== false;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Không đọc được file'));
          return;
        }
        const wb = XLSX.read(data, { type: 'binary', cellDates: false });
        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];
        const start = firstRowIsHeader ? 1 : 0;
        const result: ImportRow[] = [];
        for (let i = start; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;
          const stem = cell(row, map.stem);
          if (!stem) continue;
          const optionA = cell(row, map.optionA);
          const optionB = cell(row, map.optionB);
          const optionC = cell(row, map.optionC);
          const optionD = cell(row, map.optionD);
          const answerRaw = cell(row, map.answer);
          const answer = normalizeAnswer(answerRaw);
          const topic = cell(row, map.topic);
          const difficulty = normalizeDifficulty(cell(row, map.difficulty));
          const pointsRaw = cell(row, map.points);
          const points = pointsRaw ? Math.max(1, parseInt(pointsRaw, 10) || 2) : 2;
          result.push({
            stem,
            optionA,
            optionB,
            optionC,
            optionD,
            answer: ['A', 'B', 'C', 'D'].includes(answer) ? answer : 'A',
            topic,
            difficulty,
            points,
          });
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Lỗi đọc file'));
    reader.readAsBinaryString(file);
  });
}

/**
 * Chuyển ImportRow sang options + answer_key cho single_choice.
 */
export function importRowToQuestionPayload(row: ImportRow): {
  stem: string;
  options: { id: string; text: string }[];
  answer_key: string;
  points: number;
  topic: string;
  difficulty: string;
} {
  const options = [
    { id: 'A', text: row.optionA || '' },
    { id: 'B', text: row.optionB || '' },
    { id: 'C', text: row.optionC || '' },
    { id: 'D', text: row.optionD || '' },
  ].filter((o) => o.text.trim() !== '');
  if (options.length < 2) {
    return {
      stem: row.stem,
      options: [{ id: 'A', text: row.optionA || '(Trống)' }, { id: 'B', text: row.optionB || '(Trống)' }],
      answer_key: 'A',
      points: row.points,
      topic: row.topic,
      difficulty: row.difficulty,
    };
  }
  const validIds = options.map((o) => o.id);
  const answer_key = validIds.includes(row.answer) ? row.answer : validIds[0];
  return {
    stem: row.stem,
    options,
    answer_key,
    points: row.points,
    topic: row.topic,
    difficulty: row.difficulty,
  };
}

function normalizeText(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export interface ImportAuditIssue {
  /** 1-based row number in the parsed list (after header removed). */
  row: number;
  type: 'duplicate_in_file' | 'duplicate_existing' | 'invalid_answer';
  message: string;
}

export function buildSingleChoiceSignature(q: {
  stem: string;
  options: { id: string; text: string }[];
  answer_key: string;
}): string {
  const optById: Record<string, string> = {};
  for (const o of q.options ?? []) optById[o.id] = o.text ?? '';
  const stem = normalizeText(q.stem);
  const a = normalizeText(optById.A ?? '');
  const b = normalizeText(optById.B ?? '');
  const c = normalizeText(optById.C ?? '');
  const d = normalizeText(optById.D ?? '');
  const ans = normalizeText(q.answer_key).toUpperCase();
  return [stem, a, b, c, d, ans].join('|');
}

export function auditSingleChoicePayloads(
  payloads: Array<{ stem: string; options: { id: string; text: string }[]; answer_key: string }>,
  existing?: Array<{ stem: string; options: { id: string; text: string }[]; answer_key: string }>
): ImportAuditIssue[] {
  const issues: ImportAuditIssue[] = [];

  const seen = new Map<string, number>(); // signature -> first row (1-based)
  const firstPayloadBySig = new Map<string, { stem: string; options: { id: string; text: string }[]; answer_key: string }>();
  const existingSet = new Set<string>((existing ?? []).map(buildSingleChoiceSignature));

  const formatPayload = (p: { stem: string; options: { id: string; text: string }[]; answer_key: string }): string => {
    const optById: Record<string, string> = {};
    for (const o of p.options ?? []) optById[o.id] = o.text ?? '';
    const stem = String(p.stem ?? '').trim();
    const a = String(optById.A ?? '').trim();
    const b = String(optById.B ?? '').trim();
    const c = String(optById.C ?? '').trim();
    const d = String(optById.D ?? '').trim();
    const ans = String(p.answer_key ?? '').trim().toUpperCase();
    return `Q="${stem}" | A="${a}" | B="${b}" | C="${c}" | D="${d}" | Đúng=${ans}`;
  };

  payloads.forEach((p, idx0) => {
    const row = idx0 + 1;
    const sig = buildSingleChoiceSignature(p);

    // Invalid answer mapping
    const ids = (p.options ?? []).map((o) => o.id);
    const ans = String(p.answer_key ?? '').trim().toUpperCase();
    const hasAnswer = ids.includes(ans);
    if (!hasAnswer) {
      issues.push({
        row,
        type: 'invalid_answer',
        message: `Dòng ${row}: Đáp án đúng "${p.answer_key}" không khớp với bất kỳ lựa chọn nào (A/B/C/D) trong dòng.`,
      });
    }

    // Duplicate in file
    const first = seen.get(sig);
    if (first != null) {
      const firstPayload = firstPayloadBySig.get(sig);
      issues.push({
        row,
        type: 'duplicate_in_file',
        message: `Dòng ${row}: Trùng với dòng ${first}.\n- Dòng ${first}: ${firstPayload ? formatPayload(firstPayload) : '(không lấy được nội dung)'}\n- Dòng ${row}: ${formatPayload(p)}`,
      });
    } else {
      seen.set(sig, row);
      firstPayloadBySig.set(sig, p);
    }

    // Duplicate with existing
    if (existingSet.has(sig)) {
      issues.push({
        row,
        type: 'duplicate_existing',
        message: `Dòng ${row}: Có vẻ đã tồn tại trong ngân hàng.\n- Dòng ${row}: ${formatPayload(p)}`,
      });
    }
  });

  return issues;
}

// ─── ZIP Import ───────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Câu hỏi đã parse từ zip: kết quả ImportRow + blob ảnh (nếu có). */
export interface ZipParsedRow extends ImportRow {
  /** Tên file ảnh từ cột image_file trong Excel (rỗng nếu không có). */
  imageFile: string;
  /** Blob ảnh đã extract từ zip, null nếu không tìm thấy / quá lớn. */
  imageBlob: Blob | null;
  /** Cảnh báo riêng cho câu này (null = không có vấn đề). */
  imageWarning: string | null;
}

/** Dự đoán MIME type từ tên file ảnh. */
function guessImageMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  };
  return map[ext] ?? 'image/jpeg';
}

/**
 * Nhận diện vị trí cột từ hàng tiêu đề (tiếng Việt hoặc tiếng Anh).
 * Trả về ImportColumnMap + index cột image_file (null nếu không có).
 */
function detectZipColumns(headerRow: unknown[]): {
  map: ImportColumnMap;
  imageFileIdx: number | null;
} {
  const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const headers = (Array.isArray(headerRow) ? headerRow : []).map(norm);

  const find = (...candidates: string[]): number => {
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i !== -1) return i;
    }
    return -1;
  };

  const stemIdx    = find('nội dung câu hỏi', 'stem', 'câu hỏi', 'nội dung');
  const aIdx       = find('đáp án a', 'a', 'option a');
  const bIdx       = find('đáp án b', 'b', 'option b');
  const cIdx       = find('đáp án c', 'c', 'option c');
  const dIdx       = find('đáp án d', 'd', 'option d');
  const answerIdx  = find('đáp án đúng (a/b/c/d hoặc 1/2/3/4)', 'đáp án đúng', 'answer', 'đáp án');
  const topicIdx   = find('chủ đề', 'topic');
  const diffIdx    = find('độ khó (easy/medium/hard hoặc dễ/trung bình/khó)', 'độ khó', 'difficulty');
  const pointsIdx  = find('điểm', 'points');
  const imgIdx     = find('image_file', 'file ảnh', 'ảnh', 'hình ảnh');

  const map: ImportColumnMap = {
    stem:       stemIdx   !== -1 ? stemIdx   : DEFAULT_MAP.stem,
    optionA:    aIdx      !== -1 ? aIdx      : DEFAULT_MAP.optionA,
    optionB:    bIdx      !== -1 ? bIdx      : DEFAULT_MAP.optionB,
    optionC:    cIdx      !== -1 ? cIdx      : DEFAULT_MAP.optionC,
    optionD:    dIdx      !== -1 ? dIdx      : DEFAULT_MAP.optionD,
    answer:     answerIdx !== -1 ? answerIdx : DEFAULT_MAP.answer,
    topic:      topicIdx  !== -1 ? topicIdx  : DEFAULT_MAP.topic,
    difficulty: diffIdx   !== -1 ? diffIdx   : DEFAULT_MAP.difficulty,
    points:     pointsIdx !== -1 ? pointsIdx : DEFAULT_MAP.points,
  };

  return { map, imageFileIdx: imgIdx !== -1 ? imgIdx : null };
}

/**
 * Giải nén zip, đọc file Excel bên trong, extract blob ảnh cho từng câu hỏi.
 * Không gọi network — chỉ xử lý local.
 *
 * @param zipFile  File .zip do admin chọn
 * @returns rows   Mảng ZipParsedRow đã kèm imageBlob (nếu có)
 * @returns warnings  Danh sách cảnh báo không nghiêm trọng (ảnh thiếu, quá lớn…)
 */
export async function parseZipToRows(
  zipFile: File,
): Promise<{ rows: ZipParsedRow[]; warnings: string[] }> {
  const warnings: string[] = [];

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipFile);
  } catch {
    throw new Error('Không thể giải nén file .zip. Vui lòng kiểm tra file hợp lệ.');
  }

  // Tìm file Excel đầu tiên trong zip (bỏ qua __MACOSX/)
  const excelEntry = Object.values(zip.files).find(
    (f) => !f.dir && /\.(xlsx|xls)$/i.test(f.name.replace(/.*\//, '')) && !f.name.startsWith('__MACOSX'),
  );
  if (!excelEntry) {
    throw new Error('Không tìm thấy file Excel (.xlsx/.xls) trong zip.');
  }

  // Kiểm tra thư mục images/
  const hasImages = Object.keys(zip.files).some(
    (k) => /^images\//i.test(k) && !zip.files[k].dir,
  );
  if (!hasImages) {
    warnings.push('Không tìm thấy thư mục images/ trong zip — các câu hỏi sẽ import không có ảnh.');
  }

  // Đọc & parse Excel
  const excelBuffer = await excelEntry.async('arraybuffer');
  const wb = XLSX.read(excelBuffer, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];

  if (allRows.length < 2) {
    throw new Error('File Excel trong zip không có dữ liệu (cần ít nhất 1 hàng tiêu đề + 1 hàng dữ liệu).');
  }

  const { map, imageFileIdx } = detectZipColumns(allRows[0]);
  const rows: ZipParsedRow[] = [];

  for (let i = 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!Array.isArray(row)) continue;
    const stem = cell(row, map.stem);
    if (!stem) continue;

    const answerRaw = normalizeAnswer(cell(row, map.answer));
    const pointsRaw = cell(row, map.points);
    const imageFile = imageFileIdx !== null ? cell(row, imageFileIdx) : '';

    const importRow: ImportRow = {
      stem,
      optionA:    cell(row, map.optionA),
      optionB:    cell(row, map.optionB),
      optionC:    cell(row, map.optionC),
      optionD:    cell(row, map.optionD),
      answer:     ['A', 'B', 'C', 'D'].includes(answerRaw) ? answerRaw : 'A',
      topic:      cell(row, map.topic),
      difficulty: normalizeDifficulty(cell(row, map.difficulty)),
      points:     pointsRaw ? Math.max(1, parseInt(pointsRaw, 10) || 2) : 2,
    };

    let imageBlob: Blob | null = null;
    let imageWarning: string | null = null;

    if (imageFile) {
      // Tìm trong images/<tên> trước, fallback root zip
      const entry = zip.file(`images/${imageFile}`) ?? zip.file(imageFile);
      if (!entry) {
        imageWarning = `Câu ${i}: không tìm thấy ảnh "${imageFile}" trong zip → import không có ảnh.`;
        warnings.push(imageWarning);
      } else {
        const blob = await entry.async('blob');
        if (blob.size > MAX_IMAGE_BYTES) {
          imageWarning = `Câu ${i}: ảnh "${imageFile}" quá lớn (${(blob.size / 1024 / 1024).toFixed(1)} MB > 5 MB) → bỏ qua ảnh.`;
          warnings.push(imageWarning);
        } else {
          imageBlob = new Blob([blob], { type: blob.type || guessImageMime(imageFile) });
        }
      }
    }

    rows.push({ ...importRow, imageFile, imageBlob, imageWarning });
  }

  return { rows, warnings };
}
