import type { ModuleItem, Occupation, QuestionType } from '../../../types';
import type { QuestionImportJob, QuestionLibrary, QuestionStatus } from '../domain/question-library';

export const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

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

export const questionTypeLabels: Partial<Record<QuestionType, string>> = {
  single_choice: 'Một đáp án',
  multiple_choice: 'Nhiều đáp án',
  drag_drop: 'Kéo thả',
  video_paragraph: 'Video và đoạn văn',
  main_idea: 'Ý chính',
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

/** Pass `modules` only when the library's occupation modules are loaded; without them a module-bound library reads as "Một mô-đun". */
export function libraryScope(library: QuestionLibrary, occupations: Occupation[], modules?: ModuleItem[]): string {
  const occupation = occupations.find((item) => item.id === library.occupationId)?.name ?? 'Nghề chưa xác định';
  const matched = library.moduleId ? modules?.find((item) => item.id === library.moduleId) : undefined;
  const module = !library.moduleId ? 'Tất cả mô-đun' : matched ? moduleLabel(matched) : 'Một mô-đun';
  return `${occupation} · ${module}`;
}

export function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}
