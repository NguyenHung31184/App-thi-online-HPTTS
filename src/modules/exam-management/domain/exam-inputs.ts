import type { BlueprintRule, ExamWindow } from '../../../types';

/** What the exam form sends; omitted fields take the defaults of `examRowFromInput`. */
export interface CreateExamInput {
  title: string;
  description?: string;
  duration_minutes?: number;
  pass_threshold?: number;
  total_questions?: number;
  blueprint?: BlueprintRule[];
  module_id?: string | null;
  created_by?: string;
}

export interface UpdateExamInput {
  title?: string;
  description?: string;
  duration_minutes?: number;
  pass_threshold?: number;
  total_questions?: number;
  blueprint?: BlueprintRule[];
  questions_snapshot_url?: string | null;
  module_id?: string | null;
}

/** Proctoring mode stored on a window; the exam-taking module defines its meaning. */
export type WindowProctoringMode = NonNullable<ExamWindow['proctoring_mode']>;

export interface CreateExamWindowInput {
  /** Exam of the window (required when exam_ids is empty). */
  exam_id?: string;
  /** Several exams: each student draws one at random. The first one is the window's displayed exam_id. */
  exam_ids?: string[];
  class_id: string;
  start_at: number;
  end_at: number;
  access_code: string;
  is_trial?: boolean;
  /** Attempts per student (default 2 = first attempt + one retake). Not applied to trial windows. */
  max_attempts?: number;
  proctoring_mode?: WindowProctoringMode;
  ai_risk_threshold?: number;
}

export interface UpdateExamWindowInput {
  class_id?: string;
  start_at?: number;
  end_at?: number;
  access_code?: string;
  /** Change the single exam; used when exam_ids is empty. */
  exam_id?: string;
  /** Exams drawn one in N. Undefined keeps them; [] goes back to a single exam (exam_id). */
  exam_ids?: string[] | null;
  is_trial?: boolean;
  max_attempts?: number;
  proctoring_mode?: WindowProctoringMode;
  ai_risk_threshold?: number;
}

export interface ExamWindowWithExam extends ExamWindow {
  exam_title?: string;
  class_name?: string;
}

/** The `exams` row inserted for a new exam. */
export function examRowFromInput(input: CreateExamInput) {
  return {
    title: input.title,
    description: input.description ?? '',
    duration_minutes: input.duration_minutes ?? 60,
    pass_threshold: input.pass_threshold ?? 0.7,
    total_questions: input.total_questions ?? 0,
    blueprint: input.blueprint ?? [],
    module_id: input.module_id ?? null,
    created_by: input.created_by ?? null,
  };
}

/** The `exam_windows` row inserted for a new window; throws when no exam is chosen. */
export function windowRowFromInput(input: CreateExamWindowInput) {
  const examIds = input.exam_ids?.filter(Boolean) ?? [];
  const examId = examIds.length > 0 ? examIds[0] : input.exam_id;
  if (!examId) throw new Error('Cần chọn ít nhất một đề thi (exam_id hoặc exam_ids).');
  return {
    exam_id: examId,
    exam_ids: examIds.length > 0 ? examIds : null,
    class_id: input.class_id,
    start_at: input.start_at,
    end_at: input.end_at,
    access_code: input.access_code,
    is_trial: input.is_trial ?? false,
    max_attempts: input.max_attempts ?? 2,
    proctoring_mode: input.proctoring_mode ?? 'strict',
    ai_risk_threshold: input.ai_risk_threshold ?? 6,
  };
}

/**
 * The displayed exam_id after an update of exam_ids: the first listed exam, else the given exam_id, else the current one.
 * Undefined when exam_ids is not part of the update.
 */
export function windowExamIdAfterUpdate(input: UpdateExamWindowInput, currentExamId: string | null | undefined): string | null | undefined {
  if (input.exam_ids === undefined) return undefined;
  const ids = input.exam_ids?.filter(Boolean) ?? [];
  return ids.length > 0 ? ids[0] : (input.exam_id ?? currentExamId);
}

/** How many attempts drew each question (from attempts.question_ids). */
export function countDraws(questionIdLists: (string[] | null)[]): Record<string, number> {
  const frequency: Record<string, number> = {};
  for (const ids of questionIdLists) {
    for (const id of ids ?? []) frequency[id] = (frequency[id] ?? 0) + 1;
  }
  return frequency;
}
