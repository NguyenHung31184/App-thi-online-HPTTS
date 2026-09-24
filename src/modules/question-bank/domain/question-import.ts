import type { QuestionType } from '../../../types';
import { OPTION_IDS, buildQuestionPayload, emptyDraft, type EssayKey, type QuestionDraft, type QuestionPayload } from './question-draft';

// The column format is the one the legacy import screens read, so the center's existing files keep working.
// Unlike those screens, a cell that cannot be read turns the row into an error instead of a default answer.

export const MAX_IMPORT_ROWS = 1000;
export const IMPORT_HEADER = ['Nội dung câu hỏi', ...OPTION_IDS.map((id) => `Đáp án ${id}`), 'Đáp án đúng', 'Loại câu hỏi', 'Keys', 'Chủ đề', 'Độ khó', 'Điểm', 'Tên file ảnh'];

/** Type names written in templates and exports; parseQuestionType reads them back. */
export const IMPORT_TYPE_NAMES: Record<QuestionType, string> = {
  single_choice: 'Trắc nghiệm',
  multiple_choice: 'Nhiều đáp án',
  drag_drop: 'Kéo thả',
  true_false_multi: 'Đúng/Sai',
  matching: 'Nối đôi',
  main_idea: 'Tự luận',
  video_paragraph: 'Video tự luận',
};
const IMPORT_DIFFICULTY_NAMES: Record<string, string> = { easy: 'Dễ', medium: 'Trung bình', hard: 'Khó' };
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

export interface ImportRow {
  /** Row number as the spreadsheet shows it. */
  line: number;
  stem: string;
  /** Option cells in column order: index 0 is A. */
  optionTexts: string[];
  answer: string;
  questionType: string;
  keys: string;
  topic: string;
  difficulty: string;
  points: string;
  imageFile: string;
}

export interface ImportSheet {
  rows: ImportRow[];
  /** False when the first row did not name the columns and the legacy fixed order was used. */
  headerRecognized: boolean;
}

interface ImportColumns {
  stem: number;
  options: number[];
  answer: number;
  questionType: number;
  keys: number;
  topic: number;
  difficulty: number;
  points: number;
  imageFile: number;
}

/** Column order the legacy screens assumed when the header was not recognized. */
const FIXED_COLUMNS: ImportColumns = { stem: 0, options: [1, 2, 3, 4], answer: 5, topic: 6, difficulty: 7, points: 8, questionType: -1, keys: -1, imageFile: -1 };
export const FIXED_COLUMNS_NOTICE = 'Không nhận ra tên cột ở dòng 1, nên đã đọc theo thứ tự cột cũ: nội dung, 4 đáp án A–D, đáp án đúng, chủ đề, độ khó, điểm. Dòng 1 được bỏ qua.';

function headerName(value: unknown): string {
  return String(value ?? '').replace(/\(.*?\)/g, ' ').trim().toLowerCase().replace(/\s+/g, ' ');
}

function detectColumns(header: unknown[]): ImportColumns | null {
  const names = header.map(headerName);
  const find = (...candidates: string[]) => {
    for (const candidate of candidates) {
      const index = names.indexOf(candidate);
      if (index !== -1) return index;
    }
    return -1;
  };
  const options: number[] = [];
  for (const id of OPTION_IDS) {
    const letter = id.toLowerCase();
    const index = find(`đáp án ${letter}`, letter, `option ${letter}`, `option_${letter}`);
    if (index === -1) break;
    options.push(index);
  }
  const columns: ImportColumns = {
    stem: find('nội dung câu hỏi', 'câu hỏi', 'nội dung', 'stem'),
    options,
    answer: find('đáp án đúng', 'đáp án', 'answer'),
    questionType: find('loại câu hỏi', 'loai cau hoi', 'question_type', 'type', 'loại'),
    keys: find('keys', 'key', 'chấm ý', 'từ khóa'),
    topic: find('chủ đề', 'topic'),
    difficulty: find('độ khó', 'difficulty'),
    points: find('điểm', 'points'),
    imageFile: find('tên file ảnh', 'image_file', 'file ảnh', 'ảnh', 'hình ảnh'),
  };
  // An essay-only sheet has no option columns, so options are not required here.
  return columns.stem !== -1 && (columns.answer !== -1 || columns.keys !== -1) ? columns : null;
}

function cell(row: unknown[], column: number): string {
  if (column < 0) return '';
  const value = row[column];
  return value == null ? '' : String(value).trim();
}

/** `cells` is the first sheet as rows of cells; `firstLine` is the spreadsheet row number of cells[0]. */
export function readImportSheet(cells: unknown[][], firstLine = 1): ImportSheet {
  const header = Array.isArray(cells[0]) ? cells[0] : [];
  const detected = detectColumns(header);
  const columns = detected ?? FIXED_COLUMNS;
  const rows: ImportRow[] = [];
  for (let index = 1; index < cells.length; index++) {
    const row = cells[index];
    if (!Array.isArray(row) || row.every((value) => String(value ?? '').trim() === '')) continue;
    rows.push({
      line: firstLine + index,
      stem: cell(row, columns.stem),
      optionTexts: columns.options.map((column) => cell(row, column)),
      answer: cell(row, columns.answer),
      questionType: cell(row, columns.questionType),
      keys: cell(row, columns.keys),
      topic: cell(row, columns.topic),
      difficulty: cell(row, columns.difficulty),
      points: cell(row, columns.points),
      imageFile: cell(row, columns.imageFile),
    });
  }
  return { rows, headerRecognized: detected !== null };
}

/** Lower case, no diacritics, letters and digits only: "Đúng/Sai" → "dungsai". */
function plainKey(value: string): string {
  return value
    .replace(/\(.*?\)/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

// Checked in order: "Đúng/Sai nhiều phát biểu" must hit true/false before "nhiều" hits multiple choice.
const TYPE_RULES: [QuestionType, RegExp][] = [
  ['video_paragraph', /video/],
  ['true_false_multi', /truefalse|dungsai|^tf$/],
  ['drag_drop', /dragdrop|keotha|sapxep|thutu|ordering|^order$/],
  ['matching', /matching|noidoi|ghepnoi|^match$|^noi$/],
  ['main_idea', /mainidea|tuluan|ychinh|essay/],
  ['multiple_choice', /multiple|nhieudapan|checkbox/],
  ['single_choice', /singlechoice|^single$|tracnghiem|motdapan|^radio$/],
];

function parseQuestionType(raw: string): QuestionType | null | 'unknown' {
  const key = plainKey(raw);
  if (!key) return null;
  return TYPE_RULES.find(([, pattern]) => pattern.test(key))?.[0] ?? 'unknown';
}

function parseDifficulty(raw: string): string | null {
  const key = plainKey(raw);
  if (!key || ['medium', 'trungbinh', 'tb', 'vua'].includes(key)) return 'medium';
  if (['easy', 'de'].includes(key)) return 'easy';
  if (['hard', 'kho'].includes(key)) return 'hard';
  return null;
}

/** "A", "a.", "3" → option id; anything else → null. */
function optionId(raw: string): string | null {
  const value = raw.trim().toUpperCase().replace(/[.)]$/, '');
  if (/^(10|[1-9])$/.test(value)) return OPTION_IDS[Number(value) - 1];
  return /^[A-J]$/.test(value) ? value : null;
}

function splitList(raw: string): string[] {
  return raw.split(/[;,\s]+/).filter(Boolean);
}

function trueFalseValue(raw: string): 'T' | 'F' | null {
  const key = plainKey(raw);
  if (['t', 'true', 'd', 'dung', '1'].includes(key)) return 'T';
  if (['f', 'false', 's', 'sai', '0'].includes(key)) return 'F';
  return null;
}

/** "tai nạn|2;sai quy trình|2" → key points; a key without "|points" is worth 2, as in the legacy import. */
export function parseEssayKeys(raw: string): EssayKey[] {
  return raw
    .split(';')
    .map((part) => {
      const bar = part.lastIndexOf('|');
      if (bar === -1) return { text: part.trim(), points: 2 };
      const points = parseFloat(part.slice(bar + 1).trim());
      return { text: part.slice(0, bar).trim(), points: Number.isNaN(points) ? 2 : points };
    })
    .filter((key) => key.text !== '');
}

type DraftResult = { ok: true; draft: QuestionDraft } | { ok: false; error: string };

function draftFromImportRow(row: ImportRow): DraftResult {
  const fail = (error: string): DraftResult => ({ ok: false, error });
  if (!row.stem) return fail('Thiếu nội dung câu hỏi.');

  const hint = parseQuestionType(row.questionType);
  if (hint === 'unknown') return fail(`Không hiểu loại câu hỏi "${row.questionType}".`);
  const difficulty = parseDifficulty(row.difficulty);
  if (!difficulty) return fail(`Không hiểu độ khó "${row.difficulty}". Ghi Dễ, Trung bình hoặc Khó.`);

  const draft = emptyDraft();
  draft.stem = row.stem;
  draft.topic = row.topic;
  draft.difficulty = difficulty;
  draft.points = row.points === '' ? 2 : Number(row.points.replace(',', '.'));
  draft.options = OPTION_IDS.map((id, index) => ({ id, text: row.optionTexts[index] ?? '' }));
  const filledIds = draft.options.filter((option) => option.text !== '').map((option) => option.id);
  const type: QuestionType = hint ?? (filledIds.length === 0 && row.keys !== '' ? 'main_idea' : 'single_choice');
  draft.questionType = type;

  switch (type) {
    case 'single_choice': {
      if (row.answer === '') return fail('Thiếu đáp án đúng.');
      const id = optionId(row.answer);
      if (!id) return fail(`Đáp án đúng "${row.answer}" không đọc được. Ghi một chữ A–J hoặc số 1–10.`);
      draft.singleAnswer = id;
      break;
    }
    case 'multiple_choice': {
      const parts = splitList(row.answer);
      if (parts.length === 0) return fail('Ghi các đáp án đúng, ví dụ A;C.');
      const ids = parts.map(optionId);
      const bad = parts.find((_, index) => !ids[index] || !filledIds.includes(ids[index] as string));
      if (bad) return fail(`Đáp án đúng "${bad}" không có trong các đáp án đã nhập.`);
      draft.multipleAnswers = ids as string[];
      break;
    }
    case 'drag_drop': {
      const parts = splitList(row.answer);
      if (parts.length === 0) return fail('Ghi thứ tự đúng của các nhãn, ví dụ B;A;D;C.');
      if (parts.length !== filledIds.length) return fail(`Thứ tự đúng cần đủ ${filledIds.length} nhãn, file ghi ${parts.length}.`);
      const ids = parts.map(optionId);
      if (ids.some((id) => !id)) return fail(`Thứ tự "${row.answer}" có giá trị không phải chữ A–J.`);
      draft.zoneAnswers = ids as string[];
      break;
    }
    case 'true_false_multi': {
      const parts = splitList(row.answer);
      if (parts.length !== filledIds.length) return fail(`Cần ${filledIds.length} giá trị Đúng/Sai (T;F hoặc Đ;S), file ghi ${parts.length}.`);
      const values = parts.map(trueFalseValue);
      const bad = parts.find((_, index) => !values[index]);
      if (bad) return fail(`Giá trị "${bad}" không phải Đúng (T, Đ) hay Sai (F, S).`);
      draft.trueFalse = values as ('T' | 'F')[];
      break;
    }
    case 'matching': {
      const rightTexts = row.keys.split(';').map((text) => text.trim()).filter(Boolean);
      const pairs = row.answer.split(/[;,]+/).map((part) => part.trim()).filter(Boolean);
      const map = new Map<string, number>();
      for (const pair of pairs) {
        const match = /^([A-J])\s*[-–:.]?\s*(\d+)$/i.exec(pair);
        if (!match) return fail(`Không đọc được cặp nối "${pair}". Ghi dạng A-1;B-2.`);
        map.set(match[1].toUpperCase(), Number(match[2]));
      }
      const right: string[] = [];
      for (const [index, id] of filledIds.entries()) {
        const position = map.size > 0 ? map.get(id) : index + 1;
        if (position === undefined) return fail(`Thiếu cặp nối cho đáp án ${id}.`);
        if (position < 1 || position > rightTexts.length) return fail(`Cặp ${id}-${position} trỏ tới cột phải không có (cột Keys có ${rightTexts.length} mục).`);
        right.push(rightTexts[position - 1]);
      }
      // Stored with a sequential map (right[i] belongs to the i-th option), as the legacy import did.
      draft.matchingRight = right;
      break;
    }
    default:
      draft.essayKeys = parseEssayKeys(row.keys);
  }
  return { ok: true, draft };
}

export interface ExportableQuestion {
  questionType: string;
  stem: string;
  options: unknown;
  answerKey: string;
  points: number;
  topic: string;
  difficulty: string;
}

function parsedKey(answerKey: string): unknown {
  try { return JSON.parse(answerKey); } catch { return null; }
}

/**
 * A stored question as the import columns, without the picture column, so an exported file can be
 * edited and imported again. The video link of a video question has no column and is not exported.
 */
export function importCellsFor(question: ExportableQuestion): (string | number)[] {
  const options = Array.isArray(question.options) ? question.options as { id?: unknown; text?: unknown }[] : [];
  const optionCells = OPTION_IDS.map((id) => String(options.find((option) => option?.id === id)?.text ?? ''));
  const key = parsedKey(question.answerKey);
  const list = Array.isArray(key) ? key : [];
  let answer = '';
  let keys = '';
  switch (question.questionType) {
    case 'single_choice':
      answer = question.answerKey;
      break;
    case 'multiple_choice':
    case 'drag_drop':
      answer = list.map(String).join(';');
      break;
    case 'true_false_multi':
      answer = list.map((value) => (value === 'F' ? 'S' : 'Đ')).join(';');
      break;
    case 'matching': {
      const { right, map } = (key && typeof key === 'object' ? key : {}) as { right?: unknown[]; map?: Record<string, unknown> };
      keys = (right ?? []).map(String).join(';');
      answer = Object.entries(map ?? {}).map(([id, position]) => `${id}-${String(position)}`).join(';');
      break;
    }
    default:
      keys = list.map((item) => `${String((item as EssayKey)?.text ?? '')}|${Number((item as EssayKey)?.points ?? 0)}`).join(';');
  }
  const typeName = IMPORT_TYPE_NAMES[question.questionType as QuestionType] ?? question.questionType;
  return [question.stem, ...optionCells, answer, typeName, keys, question.topic, IMPORT_DIFFICULTY_NAMES[question.difficulty] ?? question.difficulty, question.points];
}

export function imageKey(fileName: string): string {
  return (fileName.split(/[\\/]/).pop() ?? '').trim().toLowerCase();
}

/** Same comparison as the exam draw: stem and options, case and runs of whitespace ignored. */
export function contentKey(stem: string, options: unknown): string {
  const squash = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  const list = Array.isArray(options) ? options as { id?: unknown; text?: unknown }[] : [];
  return `${squash(stem)}|${list.map((option) => `${String(option?.id ?? '')}:${squash(String(option?.text ?? ''))}`).join('|')}`;
}

export interface ReadyRow {
  line: number;
  payload: QuestionPayload;
  /** File name as written in the sheet; null when the question has no picture. */
  imageName: string | null;
  note: string | null;
}

export interface SkippedRow {
  line: number;
  stem: string;
  reason: string;
}

export interface ImportPlan {
  ready: ReadyRow[];
  errors: SkippedRow[];
  duplicates: SkippedRow[];
  notices: string[];
}

export interface ImportContext {
  validateMediaUrl: (url: string) => { valid: boolean; error?: string };
  /** Picture sizes in bytes by `imageKey`; null for a plain spreadsheet, which cannot carry pictures. */
  imageSizes: Map<string, number> | null;
  /** `contentKey` of every question already in the library. */
  existingKeys: Set<string>;
}

function imageError(name: string, imageSizes: Map<string, number> | null): string | null {
  if (!imageSizes) return `Có tên ảnh "${name}" nhưng file không phải ZIP. Nén file Excel cùng thư mục images/ thành một file ZIP.`;
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (!IMAGE_EXTENSIONS.includes(extension)) return `Ảnh "${name}" phải là JPG, PNG, GIF hoặc WEBP.`;
  const size = imageSizes.get(imageKey(name));
  if (size === undefined) return `Không thấy ảnh "${name}" trong file ZIP.`;
  if (size > MAX_IMAGE_BYTES) return `Ảnh "${name}" nặng ${(size / 1024 / 1024).toFixed(1)} MB, tối đa 5 MB.`;
  return null;
}

export function planImport(sheet: ImportSheet, context: ImportContext): ImportPlan {
  const plan: ImportPlan = { ready: [], errors: [], duplicates: [], notices: [] };
  if (!sheet.headerRecognized) plan.notices.push(FIXED_COLUMNS_NOTICE);
  const seen = new Map<string, number>();

  for (const row of sheet.rows) {
    const skip = (reason: string) => ({ line: row.line, stem: row.stem, reason });
    const imageName = row.imageFile || null;
    const badImage = imageName ? imageError(imageName, context.imageSizes) : null;
    if (badImage) { plan.errors.push(skip(badImage)); continue; }

    const drafted = draftFromImportRow(row);
    if (!drafted.ok) { plan.errors.push(skip(drafted.error)); continue; }
    const built = buildQuestionPayload(drafted.draft, context.validateMediaUrl, imageName !== null);
    if (!built.ok) { plan.errors.push(skip(built.error)); continue; }

    const key = contentKey(built.payload.stem, built.payload.options);
    const firstLine = seen.get(key);
    if (firstLine !== undefined) { plan.duplicates.push(skip(`Trùng dòng ${firstLine} trong file.`)); continue; }
    if (context.existingKeys.has(key)) { plan.duplicates.push(skip('Đã có trong ngân hàng.')); continue; }
    seen.set(key, row.line);

    const onImage = built.payload.question_type === 'drag_drop' && built.payload.rubric !== undefined;
    plan.ready.push({
      line: row.line,
      payload: built.payload,
      imageName,
      note: onImage ? 'Gắn nhãn lên ảnh: 4 ô đang ở vị trí mặc định, mở câu sau khi nhập để đặt lại.' : null,
    });
  }
  return plan;
}
