/** Value for an <input type="datetime-local"> in the browser's time zone. */
export function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): number {
  return new Date(value).getTime();
}

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

export interface WindowFormCheck {
  isTrial: boolean;
  classId: string;
  useMultiExams: boolean;
  examId: string;
  selectedExamIds: string[];
  titlesWithoutModule: string[];
  startAt: number;
  endAt: number;
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
  if (form.endAt <= form.startAt) return 'Thời gian kết thúc phải sau thời gian bắt đầu.';
  return null;
}
