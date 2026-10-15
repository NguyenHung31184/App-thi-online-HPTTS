/**
 * Quiz cuối bài: câu lấy từ ngân hàng câu hỏi, chấm ở máy chủ (`elearning_submit_quiz`). Trình duyệt chỉ nhận câu hỏi
 * không kèm đáp án, gom câu trả lời và hiện kết quả máy chủ trả về.
 */

/** Ba dạng câu máy chủ chấm được; dạng khác không chọn được vào quiz. */
export const GRADABLE_QUESTION_TYPES = ['single_choice', 'multiple_choice', 'true_false_multi'] as const;
export type GradableQuestionType = (typeof GRADABLE_QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<GradableQuestionType, string> = {
  single_choice: 'Một đáp án',
  multiple_choice: 'Nhiều đáp án',
  true_false_multi: 'Đúng/Sai từng ý',
};

export const DEFAULT_PASS_PERCENT = 80;
export const DEFAULT_MAX_ATTEMPTS = 3;

export interface QuizOption {
  id: string;
  text: string;
}

/** Một câu trong bản chụp của phiên bản: không có đáp án. */
export interface QuizQuestion {
  id: string;
  question_type: GradableQuestionType;
  stem: string;
  options: QuizOption[];
  image_url: string | null;
  points: number;
}

/** Câu trả lời đang chọn: một mã phương án, danh sách mã, hoặc danh sách T/F theo thứ tự ý. */
export type QuizResponse = string | string[] | Array<'T' | 'F' | ''>;
export type QuizAnswers = Record<string, QuizResponse>;

export interface QuizAttempt {
  attempt_no: number;
  score_percent: number;
  passed: boolean;
  correct_count: number;
  total_count: number;
  submitted_at: string;
}

export interface QuizResult {
  attempt_no: number;
  max_attempts: number;
  pass_percent: number;
  score_percent: number;
  passed: boolean;
  correct_count: number;
  total_count: number;
}

export const isGradable = (type: string): type is GradableQuestionType => (GRADABLE_QUESTION_TYPES as readonly string[]).includes(type);

/** Đọc mảng phương án của ngân hàng câu hỏi; phần tử hỏng bị bỏ qua. */
export function readOptions(raw: unknown): QuizOption[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const row = item as { id?: unknown; text?: unknown } | null;
    return row && typeof row.id === 'string' ? [{ id: row.id, text: typeof row.text === 'string' ? row.text : '' }] : [];
  });
}

export function emptyResponse(question: QuizQuestion): QuizResponse {
  if (question.question_type === 'single_choice') return '';
  if (question.question_type === 'multiple_choice') return [];
  return question.options.map(() => '' as const);
}

/** Câu đã trả lời đủ: chọn một phương án, chọn ít nhất một phương án, hoặc đánh Đúng/Sai cho mọi ý. */
export function isAnswered(question: QuizQuestion, response: QuizResponse | undefined): boolean {
  if (response === undefined) return false;
  if (question.question_type === 'single_choice') return typeof response === 'string' && response !== '';
  if (!Array.isArray(response)) return false;
  if (question.question_type === 'multiple_choice') return response.length > 0;
  return response.length === question.options.length && response.every((value) => value === 'T' || value === 'F');
}

export const unansweredCount = (questions: QuizQuestion[], answers: QuizAnswers): number =>
  questions.filter((question) => !isAnswered(question, answers[question.id])).length;

/** Gói gửi lên máy chủ: chỉ câu thuộc quiz, phương án nhiều lựa chọn sắp theo mã để dễ đối chiếu khi xem lại. */
export function answersPayload(questions: QuizQuestion[], answers: QuizAnswers): Record<string, QuizResponse> {
  const payload: Record<string, QuizResponse> = {};
  for (const question of questions) {
    const response = answers[question.id];
    if (response === undefined) continue;
    payload[question.id] = question.question_type === 'multiple_choice' && Array.isArray(response) ? [...response].sort() : response;
  }
  return payload;
}

export function toggleChoice(current: QuizResponse | undefined, optionId: string): string[] {
  const list = Array.isArray(current) ? (current as string[]) : [];
  return list.includes(optionId) ? list.filter((id) => id !== optionId) : [...list, optionId];
}

export function setStatement(question: QuizQuestion, current: QuizResponse | undefined, index: number, value: 'T' | 'F'): Array<'T' | 'F' | ''> {
  const list = Array.isArray(current) && current.length === question.options.length ? [...(current as Array<'T' | 'F' | ''>)] : question.options.map(() => '' as const);
  list[index] = value;
  return list;
}

export interface QuizState {
  passed: boolean;
  attemptsUsed: number;
  attemptsLeft: number;
  bestPercent: number | null;
  /** Còn được nộp: chưa đạt và còn lượt. */
  canSubmit: boolean;
}

export function quizState(attempts: QuizAttempt[], maxAttempts: number): QuizState {
  const passed = attempts.some((attempt) => attempt.passed);
  const attemptsUsed = attempts.length;
  const attemptsLeft = Math.max(0, maxAttempts - attemptsUsed);
  const bestPercent = attempts.length > 0 ? Math.max(...attempts.map((attempt) => Number(attempt.score_percent))) : null;
  return { passed, attemptsUsed, attemptsLeft, bestPercent, canSubmit: !passed && attemptsLeft > 0 };
}

export const formatPercent = (value: number): string => `${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;

export interface QuizSettingsForm {
  passPercent: string;
  maxAttempts: string;
}

/** Lỗi của điểm đạt và số lượt khi soạn khối quiz, hoặc null. */
export function quizSettingsError(form: QuizSettingsForm): string | null {
  const pass = Number(form.passPercent);
  if (!form.passPercent.trim() || !Number.isFinite(pass) || pass < 1 || pass > 100) return 'Điểm đạt là số phần trăm từ 1 tới 100.';
  const attempts = Number(form.maxAttempts);
  if (!form.maxAttempts.trim() || !Number.isInteger(attempts) || attempts < 1 || attempts > 10) return 'Số lượt làm là số nguyên từ 1 tới 10.';
  return null;
}

const QUIZ_SERVER_MESSAGES: [RegExp, string][] = [
  [/Quiz already passed/i, 'Bạn đã đạt bài kiểm tra này, không cần làm lại.'],
  [/No quiz attempts left/i, 'Bạn đã dùng hết số lượt làm bài kiểm tra này. Liên hệ giảng viên.'],
  [/locked or not assigned/i, 'Bài chưa mở, đã hết hạn hoặc không thuộc lớp của bạn.'],
  [/not a quiz of the assigned version/i, 'Bài kiểm tra này đã được thay bằng phiên bản khác. Tải lại trang.'],
  [/Could not find the function|schema cache/i, 'Máy chủ chưa có chức năng chấm bài kiểm tra. Báo quản trị hệ thống.'],
  [/Failed to fetch|NetworkError/i, 'Mất kết nối, bài chưa được nộp. Kiểm tra mạng rồi nộp lại; câu trả lời vẫn còn trên màn hình.'],
];

export function quizErrorMessage(error: unknown): string {
  const raw = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : '';
  for (const [pattern, message] of QUIZ_SERVER_MESSAGES) if (pattern.test(raw)) return message;
  return raw || 'Chưa nộp được bài. Thử lại sau ít phút.';
}

/** Một câu đã chọn vào khối quiz của bản nháp. */
export interface QuizItemRow {
  id: string;
  block_id: string;
  question_id: string;
  order_index: number;
  stem: string;
  question_type: string;
  /** Câu đã bị xóa khỏi ngân hàng hoặc không thuộc dạng chấm tự động: phải bỏ ra trước khi xuất bản. */
  unusable: boolean;
}

/** Câu tìm được trong ngân hàng để thêm vào quiz. */
export interface BankQuestionOption {
  id: string;
  stem: string;
  question_type: GradableQuestionType;
  topic: string | null;
  difficulty: string | null;
}

/** Mã câu đã chọn theo từng khối quiz, theo thứ tự trong khối. */
export function quizQuestionMap(items: QuizItemRow[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const item of [...items].sort((a, b) => a.order_index - b.order_index)) (map[item.block_id] ??= []).push(item.question_id);
  return map;
}

/** Câu đầu tiên không dùng được trong một khối, để báo người soạn. */
export const firstUnusable = (items: QuizItemRow[], blockId: string): QuizItemRow | null =>
  items.find((item) => item.block_id === blockId && item.unusable) ?? null;
