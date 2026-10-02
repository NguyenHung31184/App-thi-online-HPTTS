import type { ExamWindow } from '../../../types';
import { listAvailableTheoryWindows } from '../../exam-taking/public';
import {
  deleteExamWindowRow, deleteTrialWindowAttempts, insertExamWindow, selectExamWindow, selectExamWindows, updateExamWindowRow,
} from '../data/exam-window-repository';
import {
  windowExamIdAfterUpdate, windowRowFromInput, type CreateExamWindowInput, type ExamWindowWithExam, type UpdateExamWindowInput,
} from '../domain/exam-inputs';

export function listExamWindows(filters?: { exam_id?: string; class_id?: string }): Promise<ExamWindow[]> {
  return selectExamWindows(filters);
}

export function getExamWindow(id: string): Promise<ExamWindow | null> {
  return selectExamWindow(id);
}

export function createExamWindow(input: CreateExamWindowInput): Promise<ExamWindow> {
  return insertExamWindow(windowRowFromInput(input));
}

export async function updateExamWindow(id: string, input: UpdateExamWindowInput): Promise<ExamWindow> {
  const update: Record<string, unknown> = { ...input };
  if (input.exam_ids !== undefined) {
    // The current exam is read only when the update names neither a listed exam nor a single one.
    const needsCurrent = (input.exam_ids?.filter(Boolean).length ?? 0) === 0 && !input.exam_id;
    const current = needsCurrent ? (await selectExamWindow(id))?.exam_id : null;
    update.exam_id = windowExamIdAfterUpdate(input, current);
  }
  return updateExamWindowRow(id, update);
}

export function deleteExamWindow(id: string): Promise<void> {
  return deleteExamWindowRow(id);
}

/** Deletes the results of every trial window ("Xóa báo cáo thi thử"); returns how many attempts were deleted. */
export function deleteAllTrialAttempts(): Promise<number> {
  return deleteTrialWindowAttempts();
}

/** Open windows the current student may enter. */
export function getAllowedWindows(): Promise<ExamWindowWithExam[]> {
  return listAvailableTheoryWindows() as Promise<ExamWindowWithExam[]>;
}
