/**
 * Practical template drafts read from a file: our Excel template, or the centre's Word score sheet (and its list of
 * disqualifying faults). Pure: the caller turns the file into sheet rows or text blocks.
 */
import {
  DEFAULT_DISQUALIFY_REASONS, DEFAULT_PPE, deductionsFromText, type Deduction, type FieldConfig, type FieldStep, type TimeAggregate,
  type TimeRule,
} from './field-config';

export interface DraftCriterion {
  name: string;
  description: string;
  maxScore: number;
  stepKey: string | null;
  kind: 'score' | 'time';
  deductions: Deduction[];
}

export interface TemplateDraft {
  title: string;
  passScore: number;
  config: FieldConfig;
  criteria: DraftCriterion[];
  /** Things the importer guessed or could not read; shown before creating. */
  warnings: string[];
}

/** One paragraph of a Word file, as the question bank's docx reader returns it (only what is used here). */
export interface WordTextBlock {
  text: string;
  tableRow: number | null;
  tableCell: number | null;
  /** Automatic list format of the paragraph ("decimal", "lowerLetter", "bullet"…), null when not in a list. */
  listFormat: string | null;
}

/** Lower case without Vietnamese marks, for matching headers typed in different ways. */
export const plain = (value: unknown): string =>
  String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();

const numberOf = (value: unknown): number | null => {
  const n = Number(String(value ?? '').replace(',', '.').trim());
  return Number.isFinite(n) && String(value ?? '').trim() !== '' ? n : null;
};

/** "3:30" → 210; "3,5" or "3.5" (minutes) → 210; Excel time fractions (0.0024…) are read as days. */
export function secondsFrom(value: unknown): number | null {
  if (typeof value === 'number') return value > 0 && value < 1 ? Math.round(value * 86400) : Math.round(value * 60);
  const text = String(value ?? '').trim();
  const clock = /^(\d+):(\d{1,2})$/.exec(text);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const minutes = numberOf(text);
  return minutes != null && minutes > 0 ? Math.round(minutes * 60) : null;
}

const isMarked = (value: unknown) => ['x', 'co', 'có', '1', 'true', 'yes'].includes(plain(value));
const aggregateFrom = (value: unknown): TimeAggregate =>
  plain(value).includes('nhanh') ? 'fastest' : plain(value).includes('cuoi') ? 'last' : 'average';

/** Deductions written as "Tên | điểm" per line or separated by ";". */
export const deductionsFromCell = (value: unknown): Deduction[] => deductionsFromText(String(value ?? '').replace(/;/g, '\n'));

function finish(draft: Omit<TemplateDraft, 'warnings'>, warnings: string[]): TemplateDraft {
  const total = draft.criteria.reduce((sum, c) => sum + c.maxScore, 0);
  if (draft.criteria.length === 0) warnings.push('Không đọc được tiêu chí nào.');
  else if (total !== 100) warnings.push(`Tổng điểm tối đa là ${total}, không phải 100.`);
  const timed = draft.criteria.filter((c) => c.kind === 'time');
  if (timed.length > 1) warnings.push('Có nhiều tiêu chí thời gian; chỉ nên có một.');
  if (timed.length && !draft.config.time) warnings.push('Có tiêu chí thời gian nhưng chưa có khung thời gian.');
  if (!draft.title) warnings.push('Chưa có tên đề.');
  return { ...draft, warnings };
}

/* ── Excel ─────────────────────────────────────────────────────────────── */

type Rows = unknown[][];

function sheetLike(sheets: Record<string, Rows>, ...names: string[]): Rows {
  const key = Object.keys(sheets).find((k) => names.some((n) => plain(k).includes(n)));
  return key ? sheets[key] : [];
}

/** Index of each wanted header in the first row that has any of them. */
function headerIndex(rows: Rows, wanted: Record<string, string[]>): { start: number; columns: Record<string, number> } {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const cells = (rows[r] ?? []).map(plain);
    const columns: Record<string, number> = {};
    for (const [field, names] of Object.entries(wanted)) {
      const index = cells.findIndex((cell) => names.some((n) => cell === n || cell.startsWith(n)));
      if (index >= 0) columns[field] = index;
    }
    if (Object.keys(columns).length >= 2) return { start: r + 1, columns };
  }
  return { start: 0, columns: {} };
}

/** Reads our Excel template (sheets "Chung", "Bước", "Tiêu chí", "Bảo hộ & lỗi loại"). */
export function draftFromSheets(sheets: Record<string, Rows>): TemplateDraft {
  const warnings: string[] = [];
  const general = new Map<string, unknown>();
  for (const row of sheetLike(sheets, 'chung')) if (row?.[0] != null) general.set(plain(row[0]), row[1]);
  const value = (...keys: string[]) => keys.map((k) => general.get(k)).find((v) => v != null && String(v).trim() !== '');

  const stepRows = sheetLike(sheets, 'buoc');
  const stepHead = headerIndex(stepRows, { name: ['ten buoc'], cycle: ['chu ky'], photo: ['anh'] });
  const steps: FieldStep[] = [];
  for (const row of stepRows.slice(stepHead.start)) {
    const name = String(row?.[stepHead.columns.name ?? 0] ?? '').trim();
    if (!name) continue;
    steps.push({ key: `s${steps.length + 1}`, name, cycle: isMarked(row?.[stepHead.columns.cycle ?? 1]), photo: String(row?.[stepHead.columns.photo ?? 2] ?? '').trim() });
  }

  const stepKeyFor = (ref: unknown): string | null => {
    const text = String(ref ?? '').trim();
    if (!text) return null;
    const n = numberOf(text);
    const step = n != null ? steps[n - 1] : steps.find((s) => plain(s.name) === plain(text));
    if (!step) warnings.push(`Không tìm thấy bước "${text}" trong sheet Bước.`);
    return step?.key ?? null;
  };

  const criterionRows = sheetLike(sheets, 'tieu chi');
  const head = headerIndex(criterionRows, {
    step: ['buoc'], name: ['tieu chi', 'ten tieu chi', 'noi dung'], max: ['diem toi da'], detail: ['tieu chi danh gia', 'chi tiet'],
    deductions: ['loi tru'], kind: ['loai'],
  });
  // "Tiêu chí đánh giá chi tiết" also starts with "tiêu chí": the name column is the first one, the detail the other.
  if (head.columns.name === head.columns.detail) delete head.columns.detail;
  const criteria: DraftCriterion[] = [];
  for (const row of criterionRows.slice(head.start)) {
    const name = String(row?.[head.columns.name ?? 1] ?? '').trim();
    if (!name) continue;
    const max = numberOf(row?.[head.columns.max ?? 2]);
    if (max == null || max <= 0) {
      warnings.push(`Tiêu chí "${name}" không có điểm tối đa, bỏ qua.`);
      continue;
    }
    const kind = plain(row?.[head.columns.kind ?? 5]).includes('thoi gian') ? 'time' : 'score';
    criteria.push({
      name, maxScore: max, kind,
      stepKey: stepKeyFor(row?.[head.columns.step ?? 0]),
      description: String(row?.[head.columns.detail ?? 3] ?? '').trim(),
      deductions: kind === 'time' ? [] : deductionsFromCell(row?.[head.columns.deductions ?? 4]),
    });
  }

  const limits = [value('moc khung 1'), value('moc khung 2'), value('moc khung 3')].map(secondsFrom);
  const points = [value('diem khung 1'), value('diem khung 2'), value('diem khung 3')].map(numberOf);
  let time: TimeRule | null = null;
  if (limits.every((l) => l != null) && points.every((p) => p != null)) {
    time = { limits: limits as TimeRule['limits'], points: points as TimeRule['points'], aggregate: aggregateFrom(value('tinh nhieu chu ky')) };
  } else if (limits.some((l) => l != null)) warnings.push('Khung thời gian thiếu mốc hoặc điểm, chưa nhập.');

  const lists = sheetLike(sheets, 'bao ho', 'loi loai');
  const ppe: string[] = [];
  const faults: string[] = [];
  lists.slice(1).forEach((row) => {
    if (String(row?.[0] ?? '').trim()) ppe.push(String(row[0]).trim());
    if (String(row?.[1] ?? '').trim()) faults.push(String(row[1]).trim());
  });

  const pass = numberOf(value('diem dat'));
  return finish({
    title: String(value('ten de') ?? '').trim(),
    passScore: pass ?? 70,
    config: { ppe: ppe.length ? ppe : DEFAULT_PPE, disqualifyReasons: faults.length ? faults : DEFAULT_DISQUALIFY_REASONS, steps, time },
    criteria,
  }, warnings);
}

/* ── Word ──────────────────────────────────────────────────────────────── */

/** Minutes written in a line; numbers followed by "phút" win over others ("Dưới 3,5 phút (18 move/giờ)" → 3.5). */
function minutesIn(line: string): number[] {
  const read = (pattern: RegExp) => [...line.matchAll(pattern)].map((m) => Number(m[1].replace(',', '.'))).filter((n) => n > 0 && n < 120);
  const withUnit = read(/(\d+(?:[.,]\d+)?)\s*(?:phút|phut)/gi);
  return withUnit.length ? withUnit : read(/(\d+(?:[.,]\d+)?)/g);
}

/** Bands from "Dưới 3,5 phút / Từ 4,5 – 5 phút / Trên 5 phút" and their points. */
function bandsFrom(lines: string[], points: number[], warnings: string[]): TimeRule | null {
  if (points.length < 3 || lines.length < 2) return null;
  const first = minutesIn(lines[0]);
  const second = minutesIn(lines[1]);
  if (!first.length || !second.length) return null;
  const a = Math.round(first[first.length - 1] * 60);
  const b = Math.round(second[second.length - 1] * 60);
  if (!(a > 0 && b > a)) return null;
  const c = b + (b - a);
  const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  warnings.push(
    `Khung thời gian suy từ phiếu: dưới ${clock(a)} được ${points[0]}, dưới ${clock(b)} được ${points[1]}, dưới ${clock(c)} được ${points[2]}, từ ${clock(c)} trở lên 0 điểm. Kiểm tra lại mốc thứ ba và khoảng giữa các mốc.`,
  );
  return { limits: [a, b, c], points: [points[0], points[1], points[2]], aggregate: 'average' };
}

const CYCLE = /nang|ha container|di chuyen container|xep|do hang|boc/;
const CONDUCT = /tac phong|thai do/;

/** Steps proposed from the criteria: lift/move/lower rows form one timed cycle, conduct gets none, the rest one each. */
function proposeSteps(criteria: DraftCriterion[]): FieldStep[] {
  const steps: FieldStep[] = [];
  let cycle: FieldStep | null = null;
  for (const c of criteria) {
    if (c.kind === 'time') continue;
    const name = plain(c.name);
    if (CONDUCT.test(name)) continue;
    if (CYCLE.test(name)) {
      if (!cycle) {
        cycle = { key: `s${steps.length + 1}`, name: 'Chu kỳ nâng – di chuyển – hạ', cycle: true, photo: 'Hàng tại vị trí đặt' };
        steps.push(cycle);
      }
      c.stepKey = cycle.key;
      continue;
    }
    const step = { key: `s${steps.length + 1}`, name: c.name, cycle: false, photo: '' };
    steps.push(step);
    c.stepKey = step.key;
  }
  const timed = criteria.find((c) => c.kind === 'time');
  if (timed) timed.stepKey = cycle?.key ?? null;
  return steps;
}

/** Reads the centre's score sheet table and, if present, the list of disqualifying faults. */
export function draftFromWord(blocks: WordTextBlock[]): TemplateDraft {
  const warnings: string[] = [];
  const rows = new Map<number, string[]>();
  for (const b of blocks) {
    if (b.tableRow == null || b.tableCell == null) continue;
    const cells = rows.get(b.tableRow) ?? [];
    cells[b.tableCell] = cells[b.tableCell] ? `${cells[b.tableCell]}\n${b.text}` : b.text;
    rows.set(b.tableRow, cells);
  }
  const ordered = [...rows.entries()].sort((x, y) => x[0] - y[0]).map(([, cells]) => cells.map((c) => c ?? ''));

  let headerAt = -1;
  let col = { name: -1, detail: -1, max: -1 };
  ordered.some((cells, i) => {
    const p = cells.map(plain);
    const name = p.findIndex((c) => c.startsWith('noi dung'));
    const max = p.findIndex((c) => c.includes('diem toi da'));
    if (name < 0 || max < 0) return false;
    const detail = p.findIndex((c, j) => j !== name && (c.includes('tieu chi') || c.includes('ghi chu')));
    headerAt = i;
    col = { name, detail, max };
    return true;
  });

  const criteria: DraftCriterion[] = [];
  let time: TimeRule | null = null;
  if (headerAt >= 0) {
    for (const cells of ordered.slice(headerAt + 1)) {
      const name = (cells[col.name] ?? '').replace(/\s*\n\s*/g, ' ').replace(/^\d+[.)]\s*/, '').trim();
      if (!name || /^tong/.test(plain(name)) || /^tong/.test(plain(cells[0]))) continue;
      const scores = (cells[col.max] ?? '').split(/\s+/).map(numberOf).filter((n): n is number => n != null && n > 0);
      if (!scores.length) continue;
      const lines = (col.detail >= 0 ? cells[col.detail] ?? '' : '').split('\n').map((l) => l.replace(/^[-+•]\s*/, '').trim()).filter(Boolean);
      const isTime = plain(name).startsWith('thoi gian') && scores.length > 1;
      criteria.push({
        name, kind: isTime ? 'time' : 'score', maxScore: Math.max(...scores), stepKey: null, deductions: [],
        description: lines.join('; '),
      });
      if (isTime && !time) time = bandsFrom(lines, scores, warnings);
    }
  } else warnings.push('Không thấy bảng có cột "Nội dung" và "Điểm tối đa".');

  const text = blocks.filter((b) => b.tableRow == null).map((b) => b.text.trim());
  const classLine = text.find((t) => /^lớp\s*:/i.test(t) || /^lop\s*:/.test(plain(t)));
  const titleLine = text.findIndex((t) => plain(t).startsWith('phan cham diem') || plain(t).startsWith('de kiem tra'));
  const title = classLine ? classLine.replace(/^[^:]*:\s*/, '').trim() : titleLine >= 0 ? (text[titleLine + 1] ?? '').trim() : '';
  const passMatch = blocks.map((b) => b.text).join(' ').match(/đạt\s*:?\s*[≥>=]+\s*(\d+)/i);

  const faults: string[] = [];
  let inFaults = false;
  for (const b of blocks) {
    const t = b.text.trim();
    const p = plain(t);
    if (b.tableRow != null) continue;
    if (/loi vi pham|loai truc tiep/.test(p)) { inFaults = true; continue; }
    if (inFaults && /^(noi nhan|truong ban|hai phong, ngay|giao vien cham)/.test(p)) inFaults = false;
    // Every paragraph of the section is a fault, except group titles ("a. Vi phạm…", or lettered by Word) and the
    // sentence that introduces the list (it ends with a colon). Numbers may be typed or set by a Word list style.
    if (inFaults && t) {
      const groupTitle = /^[a-z][.)]\s/.test(p) || b.listFormat === 'lowerLetter' || b.listFormat === 'upperLetter';
      if (!groupTitle && !t.endsWith(':')) faults.push(t.replace(/^\d+[.)]\s+/, '').replace(/[.;]$/, ''));
    }
    // Score sheet notes: "- Đánh rơi, đổ mã hàng: không đạt."
    const note = /^[-+•]?\s*(.+?)\s*:\s*(không đạt|loại)/i.exec(t);
    if (!inFaults && note) faults.push(note[1]);
  }

  const steps = proposeSteps(criteria);
  if (criteria.length) warnings.push('Bước thao tác và ảnh nhắc chụp là đề xuất, sửa lại trong màn soạn đề nếu cần.');
  if (criteria.some((c) => c.kind === 'score')) warnings.push('Phiếu không có lỗi trừ nhanh; thêm cho từng tiêu chí trong màn soạn đề.');
  if (!faults.length) warnings.push('Không thấy danh sách lỗi loại trực tiếp; dùng danh sách mặc định.');
  return finish({
    title,
    passScore: passMatch ? Number(passMatch[1]) : 70,
    config: { ppe: DEFAULT_PPE, disqualifyReasons: faults.length ? [...new Set(faults)] : DEFAULT_DISQUALIFY_REASONS, steps, time },
    criteria,
  }, warnings);
}
