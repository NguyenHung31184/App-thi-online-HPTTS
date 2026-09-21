import { supabase } from '../../../platform/supabase/client';
import type { Attempt, AttemptWindowContext, AvailableTheoryWindow, QuestionForStudent } from '../domain/exam-attempt';

export async function fetchAvailableTheoryWindows(): Promise<AvailableTheoryWindow[]> {
  const { data, error } = await supabase.rpc('get_available_exam_windows');
  if (error) throw error;
  return (data ?? []) as AvailableTheoryWindow[];
}

export async function startTheoryAttempt(windowId: string, accessCode: string): Promise<Attempt> {
  const { data, error } = await supabase.rpc('start_exam_attempt', {
    p_window_id: windowId,
    p_access_code: accessCode,
  });
  if (error) throw error;
  if (!data) throw new Error('Mã truy cập không đúng.');
  return data as Attempt;
}

export async function fetchAttemptWindowContext(attemptId: string): Promise<AttemptWindowContext | null> {
  const { data, error } = await supabase.rpc('get_attempt_window_context', { p_attempt_id: attemptId });
  if (error) throw error;
  return (data?.[0] ?? null) as AttemptWindowContext | null;
}

export async function saveAttemptAnswers(attemptId: string, answers: Record<string, string>): Promise<void> {
  const { error } = await supabase.rpc('save_attempt_answers', {
    p_attempt_id: attemptId,
    p_answers: answers,
  });
  if (error) throw error;
}

export async function fetchAttemptQuestions(attemptId: string, examId: string): Promise<QuestionForStudent[]> {
  const { data: attempt, error: attemptError } = await supabase
    .from('attempts')
    .select('question_ids')
    .eq('id', attemptId)
    .single();
  if (attemptError) throw attemptError;

  if (attempt.question_ids?.length) {
    const { data, error } = await supabase.rpc('get_questions_for_attempt', { aid: attemptId });
    if (error) throw error;
    return (data ?? []) as QuestionForStudent[];
  }

  let questionIds: string[] | null = null;
  const { data: exam } = await supabase
    .from('exams')
    .select('questions_snapshot_url')
    .eq('id', examId)
    .single();
  if (exam?.questions_snapshot_url) {
    try {
      const response = await fetch(exam.questions_snapshot_url as string);
      if (response.ok) {
        const snapshot = await response.json() as { question_ids?: string[] };
        questionIds = snapshot.question_ids ?? [];
      }
    } catch {
      questionIds = null;
    }
  }
  const { data, error } = await supabase.rpc('get_questions_for_student', {
    eid: examId,
    qids: questionIds && questionIds.length > 0 ? questionIds : null,
  });
  if (error) throw error;
  return (data ?? []) as QuestionForStudent[];
}

export async function gradeTheoryAttempt(attemptId: string) {
  const { data, error } = await supabase.rpc('grade_attempt', { aid: attemptId });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; raw_score?: number; total_max?: number; score?: number; error?: string };
}

export async function disqualifyTheoryAttempt(attemptId: string) {
  const { data, error } = await supabase.rpc('disqualify_attempt', { aid: attemptId });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; error?: string };
}

export async function writeAttemptAuditEvent(attemptId: string, event: string, metadata?: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('attempt_audit_logs').insert({
    attempt_id: attemptId,
    event,
    metadata: metadata ?? null,
  });
  if (error) throw error;
}
