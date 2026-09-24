import type { QuestionLibrary } from '../domain/question-library';
import { findDominantCourse } from '../data/question-repository';

/**
 * question_bank.occupation_id is required; a shared library has no course of its own, so a new
 * question takes the course most of its questions already carry. Draw and grading ignore it.
 */
export async function resolveLibraryCourse(library: QuestionLibrary): Promise<string> {
  const course = library.occupationId || await findDominantCourse(library.id);
  if (!course) throw new Error('Ngân hàng chưa gắn nghề và chưa có câu hỏi nào để suy ra nghề. Tạo lại ngân hàng kèm nghề.');
  return course;
}
