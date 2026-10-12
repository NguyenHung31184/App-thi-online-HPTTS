import { supabase } from '../../../platform/supabase/client';
import type { Attempt, Exam } from '../../../types';
import type { ReviewQuestionRecord } from '../domain/attempt-review';

// Staff read any attempt here; RLS decides who may.

export async function selectAttempt(id: string): Promise<Attempt | null> {
  const { data, error } = await supabase.from('attempts').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as Attempt;
}

export async function selectExam(id: string): Promise<Exam | null> {
  const { data, error } = await supabase.from('exams').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as Exam;
}

export async function selectProfile(userId: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase.from('profiles').select('name, email, student_id').eq('id', userId).single();
  return (data ?? null) as Record<string, unknown> | null;
}

/** The whole TTDT student row: the date of birth and CCCD columns differ between imports. */
export async function selectStudentByExamEmail(email: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase.from('students').select('*').eq('exam_account_email', email).maybeSingle();
  return (data ?? null) as Record<string, unknown> | null;
}

export async function selectStudentById(studentId: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase.from('students').select('*').eq('id', studentId).maybeSingle();
  return (data ?? null) as Record<string, unknown> | null;
}

export async function selectAttemptReviewQuestions(attemptId: string): Promise<ReviewQuestionRecord[]> {
  const { data, error } = await supabase.rpc('get_attempt_review_questions', { p_attempt_id: attemptId });
  if (error) throw error;
  return (data ?? []) as ReviewQuestionRecord[];
}
