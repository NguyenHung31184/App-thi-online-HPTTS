/**
 * Parse file Excel (.xlsx, .xls) hoặc CSV để lấy danh sách câu hỏi.
 * Hỗ trợ tối đa 10 đáp án (A–J). Phát hiện cột tự động từ hàng tiêu đề.
 */
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

export const ALL_OPTION_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
type OptionId = (typeof ALL_OPTION_IDS)[number];

export interface ImportRow {
  stem: string;
  /** Texts cho tối đa 10 đáp án theo thứ tự: index 0 = A, 1 = B, ..., 9 = J. Chuỗi rỗng = không có đáp án. */
  optionTexts: string[];
  answer: string; // A–J (đã chuẩn hóa)
  topic: string;
  difficulty: string;
  points: number;
  /** Chuỗi keys cho câu tự luận, format: "tai nạn|2;sai quy trình|2;..." (text|điểm, phân cách bằng ;). */
  keys: string;
}

export interface ImportColumnMap {
  stem: number;
  /** Chỉ số các cột đáp án theo thứ tự A, B, C, ... (tối đa 10). */
  optionCols: number[];
  answer: number;
  topic: number;
  difficulty: number;
  points: number;
  keys: number;
}

const DEFAULT_MAP: ImportColumnMap = {
  stem: 0,
  optionCols: [1, 2, 3, 4], // A=col1, B=col2, C=col3, D=col4
  answer: 5,
  topic: 6,
  difficulty: 7,
  points: 8,
  keys: -1, // không có cột keys mặc định
};

function cell(row: unknown[], col: number): string {
  if (col < 0) return '';
  const v = row[col];
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  return String(v).trim();
}

function normalizeAnswer(a: string): string {
  const s = String(a).trim().toUpperCase();
  const byNum: Record<string, string> = {
    '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E',
    '6': 'F', '7': 'G', '8': 'H', '9': 'I', '10': 'J',
  };
  if (byNum[s]) return byNum[s];
  if (/^[A-J]$/.test(s)) return s;
  return s.slice(0, 1);
}

function normalizeDifficulty(d: string): string {
  const s = String(d).trim().toLowerCase();
  if (s.includes('dễ') || s === 'easy') return 'easy';
  if (s.includes('khó') || s === 'hard') return 'hard';
  return 'medium';
}

/** Phát hiện vị trí cột từ hàng tiêu đề. Trả về DEFAULT_MAP nếu không nhận dạng được. */
function detectColumns(headerRow: unknown[]): ImportColumnMap {
  const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const headers = (Array.isArray(headerRow) ? headerRow : []).map(norm);

  const find = (...candidates: string[]): number => {
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i !== -1) return i;
    }
    return -1;
  };

  const stemIdx = find('nội dung câu hỏi', 'stem', 'câu hỏi', 'nội dung');
  const answerIdx = find(
    'đáp án đúng (a/b/c/d/e/f/g/h/i/j hoặc 1/2/3/4/5/6/7/8/9/10)',
    'đáp án đúng (a/b/c/d hoặc 1/2/3/4)',
    'đáp án đúng',
    'answer',
    'đáp án',
  );
  const topicIdx = find('chủ đề', 'topic');
  const diffIdx = find('độ khó (easy/medium/hard hoặc dễ/trung bình/khó)', 'độ khó', 'difficulty');
  const pointsIdx = find('điểm', 'points');
  const keysIdx = find('keys', 'chấm ý', 'key', 'từ khóa');

  // Tìm tuần tự cột đáp án A, B, C, ... — dừng ở chỗ đầu tiên không tìm thấy
  const optionCols: number[] = [];
  for (const id of ALL_OPTION_IDS) {
    const lc = id.toLowerCase();
    const idx = find(`đáp án ${lc}`, lc, `option ${lc}`, `option_${lc}`);
    if (idx !== -1) optionCols.push(idx);
    else break;
  }

  if (stemIdx === -1 || optionCols.length === 0 || answerIdx === -1) {
    return DEFAULT_MAP;
  }

  return {
    stem: stemIdx,
    optionCols,
    answer: answerIdx,
    topic: topicIdx,
    difficulty: diffIdx,
    points: pointsIdx,
    keys: keysIdx,
  };
}

/**
 * Đọc file Excel/CSV, trả về mảng các ImportRow.
 * Khi firstRowIsHeader=true: phát hiện cột tự động từ header, hỗ trợ A–J.
 * Khi firstRowIsHeader=false: dùng vị trí cột cố định (A-D backward compat).
 */
export function parseFileToRows(
  file: File,
  options: { firstRowIsHeader?: boolean; columnMap?: Partial<ImportColumnMap> }
): Promise<ImportRow[]> {
  const firstRowIsHeader = options.firstRowIsHeader !== false;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) { reject(new Error('Không đọc được file')); return; }
        const wb = XLSX.read(data, { type: 'binary', cellDates: false });
        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }) as unknown[][];

        let map: ImportColumnMap;
        let start: number;

        if (firstRowIsHeader && rows.length > 0) {
          map = detectColumns(rows[0]);
          start = 1;
        } else {
          map = { ...DEFAULT_MAP, ...options.columnMap };
          start = firstRowIsHeader ? 1 : 0;
        }

        const result: ImportRow[] = [];
        for (let i = start; i < rows.length; i++) {
          const row = rows[i];
          if (!Array.isArray(row)) continue;
          const stem = cell(row, map.stem);
          if (!stem) continue;

          const optionTexts = map.optionCols.map((col) => cell(row, col));
          const answerRaw = normalizeAnswer(cell(row, map.answer));
          const validAnswerIds = ALL_OPTION_IDS.slice(0, optionTexts.length) as string[];
          const topic = cell(row, map.topic);
          const difficulty = normalizeDifficulty(cell(row, map.difficulty));
          const pointsRaw = cell(row, map.points);
          const points = pointsRaw ? Math.max(1, parseInt(pointsRaw, 10) || 2) : 2;

          result.push({
            stem,
            optionTexts,
            answer: validAnswerIds.includes(answerRaw) ? answerRaw : (validAnswerIds[0] ?? 'A'),
            topic,
            difficulty,
            points,
            keys: cell(row, map.keys),
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
 * Parse chuỗi keys "tai nạn|2;sai quy trình|2" thành array JSON cho essay grading.
 */
export function parseEssayKeys(raw: string): { text: string; points: number }[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(';')
    .map((part) => {
      const pipeIdx = part.lastIndexOf('|');
      if (pipeIdx === -1) return { text: part.trim(), points: 2 };
      const text = part.slice(0, pipeIdx).trim();
      const pts = parseFloat(part.slice(pipeIdx + 1).trim());
      return { text, points: isNaN(pts) ? 2 : pts };
    })
    .filter((k) => k.text !== '');
}

/**
 * Chuyển ImportRow sang payload cho question_bank.
 * - ≥2 đáp án → single_choice
 * - 0 đáp án + có keys → main_idea (câu tự luận chấm key)
 * - 0 đáp án + không có keys → single_choice (fallback với đáp án giả)
 */
export function importRowToQuestionPayload(row: ImportRow): {
  stem: string;
  options: { id: string; text: string }[];
  answer_key: string;
  points: number;
  topic: string;
  difficulty: string;
  question_type: string;
} {
  const options = row.optionTexts
    .map((text, idx) => ({ id: ALL_OPTION_IDS[idx] as string, text: text || '' }))
    .filter((o) => o.text.trim() !== '');

  const parsedKeys = parseEssayKeys(row.keys);

  // Nếu không có đáp án và có keys → câu tự luận chấm ý
  if (options.length === 0 && parsedKeys.length > 0) {
    return {
      stem: row.stem,
      options: [],
      answer_key: JSON.stringify(parsedKeys),
      points: row.points,
      topic: row.topic,
      difficulty: row.difficulty,
      question_type: 'main_idea',
    };
  }

  if (options.length < 2) {
    return {
      stem: row.stem,
      options: [
        { id: 'A', text: row.optionTexts[0] || '(Trống)' },
        { id: 'B', text: row.optionTexts[1] || '(Trống)' },
      ],
      answer_key: 'A',
      points: row.points,
      topic: row.topic,
      difficulty: row.difficulty,
      question_type: 'single_choice',
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
    question_type: 'single_choice',
  };
}

function normalizeText(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface ImportAuditIssue {
  /** Số thứ tự dòng 1-based trong danh sách đã parse (sau khi bỏ header). */
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
  const optParts = ALL_OPTION_IDS.map((id) => normalizeText(optById[id] ?? '')).join('|');
  const ans = normalizeText(q.answer_key).toUpperCase();
  return [stem, optParts, ans].join('||');
}

export function auditSingleChoicePayloads(
  payloads: Array<{ stem: string; options: { id: string; text: string }[]; answer_key: string }>,
  existing?: Array<{ stem: string; options: { id: string; text: string }[]; answer_key: string }>
): ImportAuditIssue[] {
  const issues: ImportAuditIssue[] = [];
  const seen = new Map<string, number>();
  const firstPayloadBySig = new Map<string, { stem: string; options: { id: string; text: string }[]; answer_key: string }>();
  const existingSet = new Set<string>((existing ?? []).map(buildSingleChoiceSignature));

  const formatPayload = (p: { stem: string; options: { id: string; text: string }[]; answer_key: string }): string => {
    const optById: Record<string, string> = {};
    for (const o of p.options ?? []) optById[o.id] = o.text ?? '';
    const parts = (ALL_OPTION_IDS as readonly string[])
      .map((id) => (optById[id] ? `${id}="${optById[id]}"` : null))
      .filter(Boolean)
      .join(' | ');
    return `Q="${String(p.stem ?? '').trim()}" | ${parts} | Đúng=${String(p.answer_key ?? '').trim().toUpperCase()}`;
  };

  payloads.forEach((p, idx0) => {
    const row = idx0 + 1;
    const sig = buildSingleChoiceSignature(p);
    const ids = (p.options ?? []).map((o) => o.id);
    const ans = String(p.answer_key ?? '').trim().toUpperCase();

    if (!ids.includes(ans)) {
      issues.push({
        row,
        type: 'invalid_answer',
        message: `Dòng ${row}: Đáp án đúng "${p.answer_key}" không khớp với bất kỳ lựa chọn nào trong dòng.`,
      });
    }

    const first = seen.get(sig);
    if (first != null) {
      const firstPayload = firstPayloadBySig.get(sig);
      issues.push({
        row,
        type: 'duplicate_in_file',
        message: `Dòng ${row}: Trùng với dòng ${first}.\n- Dòng ${first}: ${firstPayload ? formatPayload(firstPayload) : '...'}\n- Dòng ${row}: ${formatPayload(p)}`,
      });
    } else {
      seen.set(sig, row);
      firstPayloadBySig.set(sig, p);
    }

    if (existingSet.has(sig)) {
      issues.push({
        row,
        type: 'duplicate_existing',
        message: `Dòng ${row}: Có vẻ đã tồn tại trong ngân hàng.\n- ${formatPayload(p)}`,
      });
    }
  });

  return issues;
}

// ─── ZIP Import ───────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Câu hỏi đã parse từ zip: ImportRow + blob ảnh (nếu có). */
export interface ZipParsedRow extends ImportRow {
  imageFile: string;
  imageBlob: Blob | null;
  imageWarning: string | null;
}

function guessImageMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  };
  return map[ext] ?? 'image/jpeg';
}

function detectZipColumns(headerRow: unknown[]): { map: ImportColumnMap; imageFileIdx: number | null } {
  const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const headers = (Array.isArray(headerRow) ? headerRow : []).map(norm);

  const find = (...candidates: string[]): number => {
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i !== -1) return i;
    }
    return -1;
  };

  const stemIdx = find('nội dung câu hỏi', 'stem', 'câu hỏi', 'nội dung');
  const answerIdx = find(
    'đáp án đúng (a/b/c/d/e/f/g/h/i/j hoặc 1/2/3/4/5/6/7/8/9/10)',
    'đáp án đúng (a/b/c/d hoặc 1/2/3/4)',
    'đáp án đúng',
    'answer',
    'đáp án',
  );
  const topicIdx = find('chủ đề', 'topic');
  const diffIdx = find('độ khó (easy/medium/hard hoặc dễ/trung bình/khó)', 'độ khó', 'difficulty');
  const pointsIdx = find('điểm', 'points');
  const imgIdx = find('image_file', 'file ảnh', 'ảnh', 'hình ảnh');
  const keysIdx = find('keys', 'chấm ý', 'key', 'từ khóa');

  const optionCols: number[] = [];
  for (const id of ALL_OPTION_IDS) {
    const lc = id.toLowerCase();
    const idx = find(`đáp án ${lc}`, lc, `option ${lc}`);
    if (idx !== -1) optionCols.push(idx);
    else break;
  }

  if (stemIdx === -1 || optionCols.length === 0 || answerIdx === -1) {
    return { map: DEFAULT_MAP, imageFileIdx: imgIdx !== -1 ? imgIdx : null };
  }

  return {
    map: { stem: stemIdx, optionCols, answer: answerIdx, topic: topicIdx, difficulty: diffIdx, points: pointsIdx, keys: keysIdx },
    imageFileIdx: imgIdx !== -1 ? imgIdx : null,
  };
}

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

  const excelEntry = Object.values(zip.files).find(
    (f) => !f.dir && /\.(xlsx|xls)$/i.test(f.name.replace(/.*\//, '')) && !f.name.startsWith('__MACOSX'),
  );
  if (!excelEntry) throw new Error('Không tìm thấy file Excel (.xlsx/.xls) trong zip.');

  const hasImages = Object.keys(zip.files).some(
    (k) => /^images\//i.test(k) && !zip.files[k].dir,
  );
  if (!hasImages) warnings.push('Không tìm thấy thư mục images/ trong zip — các câu hỏi sẽ import không có ảnh.');

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

    const optionTexts = map.optionCols.map((col) => cell(row, col));
    const answerRaw = normalizeAnswer(cell(row, map.answer));
    const validAnswerIds = ALL_OPTION_IDS.slice(0, optionTexts.length) as string[];
    const pointsRaw = cell(row, map.points);
    const imageFile = imageFileIdx !== null ? cell(row, imageFileIdx) : '';

    const importRow: ImportRow = {
      stem,
      optionTexts,
      answer: validAnswerIds.includes(answerRaw) ? answerRaw : (validAnswerIds[0] ?? 'A'),
      topic: cell(row, map.topic),
      difficulty: normalizeDifficulty(cell(row, map.difficulty)),
      points: pointsRaw ? Math.max(1, parseInt(pointsRaw, 10) || 2) : 2,
      keys: cell(row, map.keys),
    };

    let imageBlob: Blob | null = null;
    let imageWarning: string | null = null;

    if (imageFile) {
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

// Re-export OptionId type for consumers
export type { OptionId };
