/**
 * Parse file Excel (.xlsx, .xls) hoặc CSV để lấy danh sách câu hỏi trắc nghiệm 1 đáp án.
 * Mẫu cột: [Nội dung, Đáp án A, Đáp án B, Đáp án C, Đáp án D, Đáp án đúng, Chủ đề, Độ khó, Điểm]
 * Có thể ánh xạ cột khác (column indices 0-based).
 */
import * as XLSX from 'xlsx';

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
          const points = pointsRaw ? Math.max(1, parseInt(pointsRaw, 10) || 1) : 1;
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
