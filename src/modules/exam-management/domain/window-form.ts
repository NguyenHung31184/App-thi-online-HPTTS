/** "Title — Description", so exams with the same title can be told apart; cut at 75 characters. */
export function examOptionLabel(exam: { title: string; description?: string | null }): string {
  const description = (exam.description ?? '').trim();
  const full = description ? `${exam.title} — ${description}` : exam.title;
  return full.length > 75 ? full.slice(0, 72) + '...' : full;
}

const ACCESS_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Four letters and digits, without the easily confused I, O, 0 and 1. */
export function randomAccessCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += ACCESS_CODE_CHARS[Math.floor(random() * ACCESS_CODE_CHARS.length)];
  return code;
}

export interface ExamChoice {
  id: string;
  title: string;
  description?: string | null;
  module_id?: string | null;
  duration_minutes?: number | null;
}

/** Titles of the chosen exams without a module: their scores cannot sync to TTDT. */
export function examsWithoutModule(chosenIds: string[], exams: ExamChoice[]): string[] {
  return chosenIds
    .filter((id) => {
      const exam = exams.find((e) => e.id === id);
      return !exam?.module_id || String(exam.module_id).trim() === '';
    })
    .map((id) => exams.find((e) => e.id === id)?.title ?? id)
    .filter(Boolean);
}

/** Matches exam_private.preparation_allowance_ms: the exam clock starts at the latest 5 minutes after the student opens the paper. */
export const PREPARATION_MINUTES = 5;

/** Longest working time among the chosen exams, in minutes; 0 when none is known. */
export function longestDurationMinutes(chosenIds: string[], exams: ExamChoice[]): number {
  return Math.max(0, ...chosenIds.map((id) => Number(exams.find((e) => e.id === id)?.duration_minutes) || 0));
}

export interface WindowFormCheck {
  isTrial: boolean;
  classId: string;
  useMultiExams: boolean;
  examId: string;
  selectedExamIds: string[];
  titlesWithoutModule: string[];
  startAt: number;
  endAt: number;
  accessCode: string;
  /** Longest exam duration in the window; 0 or missing skips the length check. */
  durationMinutes?: number;
}

/** The first problem that blocks saving a window, in the order the form always checked; null when it can be saved. */
export function windowFormError(form: WindowFormCheck): string | null {
  if (!form.isTrial && (!form.classId || form.classId.trim() === '')) {
    return 'Vui lòng chọn Lớp (TTDT) cho kỳ thi để có thể đồng bộ điểm. (Hoặc tick "Kỳ thi thử" nếu không cần đồng bộ.)';
  }
  if (!form.useMultiExams && !form.examId) return 'Vui lòng chọn Đề thi.';
  if (form.useMultiExams && form.selectedExamIds.length === 0) return 'Vui lòng thêm ít nhất một đề thi (chế độ nhiều đề).';
  if (!form.isTrial && form.titlesWithoutModule.length > 0) {
    return `Không thể lưu: ${form.titlesWithoutModule.length} đề chưa gắn mô-đun (${form.titlesWithoutModule.join(', ')}). Vui lòng vào Đề thi → Sửa từng đề → chọn Mô-đun rồi lưu, sau đó quay lại tạo/sửa kỳ thi.`;
  }
  if (!Number.isFinite(form.startAt) || !Number.isFinite(form.endAt)) return 'Vui lòng nhập thời gian Bắt đầu và Kết thúc.';
  if (form.endAt <= form.startAt) return 'Thời gian kết thúc phải sau thời gian bắt đầu.';
  const duration = form.durationMinutes ?? 0;
  const neededMs = (duration + PREPARATION_MINUTES) * 60_000;
  if (duration > 0 && form.endAt - form.startAt < neededMs) {
    const length = Math.floor((form.endAt - form.startAt) / 60_000);
    const earliestEnd = new Date(form.startAt + neededMs).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `Khung giờ ${length} phút ngắn hơn thời gian làm bài ${duration} phút cộng ${PREPARATION_MINUTES} phút chuẩn bị: học viên sẽ bị nộp bài trước khi hết giờ. Đặt giờ Kết thúc từ ${earliestEnd} trở đi.`;
  }
  if (form.accessCode.trim() === '') return 'Vui lòng nhập Mã truy cập, hoặc bấm nút bên cạnh ô để tạo mã.';
  return null;
}
