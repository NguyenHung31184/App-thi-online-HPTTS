import type { Attempt, Exam } from '../../../types';
import {
  selectAttempt, selectBankQuestions, selectExam, selectLegacyExamQuestions, selectProfile, selectStudentByExamEmail, selectStudentById,
} from '../data/attempt-result-repository';
import { signStartPhoto } from '../data/evidence-storage';
import { normalizePrintable, orderByIds, studentFactsOf, toReviewItems, type QuestionReviewItem, type StudentFacts } from '../domain/attempt-review';

export interface AttemptResult {
  attempt: Attempt;
  exam: Exam | null;
  profileName: string | null;
  profileEmail: string | null;
  student: StudentFacts;
  /** Null when the attempt has no saved answers. */
  reviewItems: QuestionReviewItem[] | null;
  startPhotoUrl: string | null;
}

export class AttemptNotFoundError extends Error {
  constructor() {
    super('Không tìm thấy bài làm.');
  }
}

/** One attempt for staff: student, answers against the key, and the photo taken at the start. */
export async function getAttemptResult(attemptId: string): Promise<AttemptResult> {
  const attempt = await selectAttempt(attemptId);
  if (!attempt) throw new AttemptNotFoundError();
  const exam = await selectExam(attempt.exam_id);

  const profile = attempt.user_id ? await selectProfile(attempt.user_id) : null;
  const profileName = normalizePrintable(profile?.name);
  const profileEmail = normalizePrintable(profile?.email);
  const profileStudentId = (profile?.student_id as string | null | undefined) ?? null;

  // The TTDT student: by exam account email first, then by the profile's student id.
  let studentRow = profileEmail ? await selectStudentByExamEmail(profileEmail) : null;
  if (!studentRow && profileStudentId) studentRow = await selectStudentById(profileStudentId);

  // New attempts list their questions (question_bank ids); old ones read the exam's legacy questions.
  const questions = attempt.question_ids?.length
    ? orderByIds(attempt.question_ids, await selectBankQuestions(attempt.question_ids))
    : await selectLegacyExamQuestions(attempt.exam_id);
  const reviewItems = questions && attempt.answers ? toReviewItems(questions, attempt.answers as Record<string, string>) : null;

  return {
    attempt,
    exam,
    profileName,
    profileEmail,
    student: studentFactsOf(studentRow),
    reviewItems,
    startPhotoUrl: await signStartPhoto(attemptId),
  };
}
