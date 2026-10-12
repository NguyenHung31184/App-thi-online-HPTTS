import { getExam } from '../../exam-management/public';
import type { Exam } from '../../../types';
import type { Attempt, AttemptWindowContext, QuestionForStudent } from '../domain/exam-attempt';
import { getAttempt, getTheoryAttemptQuestions, getTheoryAttemptWindowContext } from './manage-theory-attempt';

interface SessionReader {
  getAttempt: (id: string) => Promise<Attempt | null>;
  getExam: (id: string) => Promise<Exam | null>;
  getQuestions: (attemptId: string, examId: string) => Promise<QuestionForStudent[]>;
  getWindowContext: (attemptId: string) => Promise<AttemptWindowContext | null>;
}

const reader: SessionReader = {
  getAttempt, getExam,
  getQuestions: getTheoryAttemptQuestions,
  getWindowContext: getTheoryAttemptWindowContext,
};

export async function loadTheorySession(attemptId: string, userId: string, source: SessionReader = reader) {
  const attempt = await source.getAttempt(attemptId);
  if (!attempt) throw new Error('Không tìm thấy bài làm hoặc đề thi.');
  if (attempt.user_id !== userId) throw new Error('Bạn không có quyền làm bài này.');
  if (attempt.status === 'completed') return { kind: 'completed' as const, attempt };
  const exam = await source.getExam(attempt.exam_id);
  if (!exam) throw new Error('Không tìm thấy bài làm hoặc đề thi.');
  const [questions, windowContext] = await Promise.all([
    source.getQuestions(attempt.id, attempt.exam_id), source.getWindowContext(attempt.id),
  ]);
  // The RPC uses the server deadline, including the exam duration; local time is only a fallback.
  const deadline = windowContext?.end_at ?? attempt.started_at + exam.duration_minutes * 60_000;
  return { kind: 'ready' as const, attempt, exam, questions, deadline,
    answers: (attempt.answers as Record<string, string>) ?? {} };
}
