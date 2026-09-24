import type { ModuleItem, Occupation, QuestionType } from '../../../types';
import type { QuestionImportJob, QuestionLibrary, QuestionStatus } from '../domain/question-library';

export const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
export const fieldClass = `min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ${focusRing}`;

export const questionStatusLabels: Record<QuestionStatus, string> = {
  draft: 'Bản nháp',
  review: 'Chờ duyệt',
  published: 'Đã phát hành',
  retired: 'Ngừng sử dụng',
};

export const questionStatusTone: Record<QuestionStatus, string> = {
  draft: 'bg-slate-100 text-slate-800',
  review: 'bg-amber-50 text-amber-900',
  published: 'bg-emerald-50 text-emerald-900',
  retired: 'bg-rose-50 text-rose-900',
};

export const questionTypeLabels: Record<QuestionType, string> = {
  single_choice: 'Trắc nghiệm một đáp án đúng',
  multiple_choice: 'Trắc nghiệm nhiều đáp án đúng',
  drag_drop: 'Kéo thả (sắp thứ tự hoặc gắn nhãn lên ảnh)',
  true_false_multi: 'Đúng/Sai nhiều phát biểu',
  matching: 'Nối đôi',
  video_paragraph: 'Xem video và tự luận',
  main_idea: 'Phân tích ý chính',
};

export const difficultyLabels: Record<string, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
};

export const importJobLabels: Record<QuestionImportJob['status'], string> = {
  queued: 'Đang chờ xử lý',
  processing: 'Đang tách tài liệu',
  review_required: 'Cần rà soát',
  failed: 'Có lỗi',
  completed: 'Đã hoàn tất',
};

export function moduleLabel(module: ModuleItem): string {
  return module.code ? `${module.code} · ${module.name}` : module.name;
}

/** The library name already carries the module (since C2), so the scope line names only the course. */
export function libraryCourse(library: QuestionLibrary, occupations: Occupation[]): string {
  if (!library.occupationId) return 'Dùng chung nhiều nghề';
  return occupations.find((item) => item.id === library.occupationId)?.name ?? 'Nghề chưa xác định';
}

export function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}
