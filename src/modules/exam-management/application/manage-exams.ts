import type { Exam } from '../../../types';
import { checkExamBlueprint } from '../../question-bank/public';
import { clearExamLock, insertExam, selectExam, selectExams, setExamLocked, softDeleteExam, updateExamRow } from '../data/exam-repository';
import { examRowFromInput, type CreateExamInput, type UpdateExamInput } from '../domain/exam-inputs';

export function listExams(): Promise<Exam[]> {
  return selectExams();
}

export function getExam(id: string): Promise<Exam | null> {
  return selectExam(id);
}

export function createExam(input: CreateExamInput): Promise<Exam> {
  return insertExam(examRowFromInput(input));
}

export function updateExam(id: string, input: UpdateExamInput): Promise<Exam> {
  return updateExamRow(id, input);
}

export function deleteExam(id: string): Promise<void> {
  return softDeleteExam(id);
}

/** The module's question bank must fill the blueprint the way start_exam_attempt draws; the legacy `questions` table is not a draw source. */
async function blueprintCoverage(examId: string): Promise<{ valid: true; count: number } | { valid: false; message: string }> {
  const exam = await selectExam(examId);
  if (!exam) return { valid: false, message: 'Không tìm thấy đề thi.' };
  const moduleId = exam.module_id ?? '';
  if (!moduleId.trim()) return { valid: false, message: 'Đề chưa gắn mô-đun nên chưa bốc được câu hỏi.' };
  try {
    const coverage = await checkExamBlueprint(moduleId, exam.blueprint);
    if (!coverage.ok) return { valid: false, message: coverage.message };
    return { valid: true, count: coverage.questionsPerAttempt };
  } catch (e) {
    return { valid: false, message: 'Lỗi tải ngân hàng câu hỏi: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/** Locks the exam after the blueprint check; a locked exam's questions cannot be added, edited or deleted. */
export async function lockExam(examId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const coverage = await blueprintCoverage(examId);
  if (!coverage.valid) return { ok: false, message: coverage.message };
  const error = await setExamLocked(examId, coverage.count);
  return error ? { ok: false, message: 'Lỗi khóa đề: ' + error } : { ok: true };
}

export function unlockExam(examId: string): Promise<void> {
  return clearExamLock(examId);
}
