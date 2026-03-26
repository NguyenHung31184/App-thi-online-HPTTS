import { supabase } from '../lib/supabaseClient';
import type { Attempt, QuestionForStudent, StudentSession } from '../types';

export async function createAttempt(
  userId: string | null,
  windowId: string,
  examId: string,
  studentSession?: StudentSession | null
): Promise<Attempt> {
  const started_at = Date.now();
  const { data, error } = await supabase
    .from('attempts')
    .insert({
      user_id: userId,
      window_id: windowId,
      exam_id: examId,
      status: 'in_progress',
      answers: {},
      started_at,
      student_name: studentSession?.student_name ?? null,
      student_dob: studentSession?.student_dob ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Attempt;
}

export async function getAttempt(id: string): Promise<Attempt | null> {
  const { data, error } = await supabase.from('attempts').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Attempt;
}

/** Danh sách bài làm đã nộp (completed) theo đề thi — dùng cho màn chấm tự luận */
export async function listCompletedAttemptsByExam(examId: string): Promise<Attempt[]> {
  const { data, error } = await supabase
    .from('attempts')
    .select('*')
    .eq('exam_id', examId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Attempt[];
}

export async function updateAttemptAnswers(
  attemptId: string,
  answers: Record<string, string>
): Promise<void> {
  const { error } = await supabase
    .from('attempts')
    .update({ answers, updated_at: new Date().toISOString() })
    .eq('id', attemptId);
  if (error) throw error;
}

/** Chấm bài server-side (RPC), trả về kết quả. */
export async function submitAttempt(
  attemptId: string
): Promise<{ ok: boolean; raw_score?: number; total_max?: number; score?: number; error?: string }> {
  const { data, error } = await supabase.rpc('grade_attempt', { aid: attemptId });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; raw_score?: number; total_max?: number; score?: number; error?: string };
  return result;
}

/** Ghi audit log (focus_lost, visibility_hidden, ...) */
export async function logAuditEvent(
  attemptId: string,
  event: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await supabase.from('attempt_audit_logs').insert({
    attempt_id: attemptId,
    event,
    metadata: metadata ?? null,
  });
}

/** Lấy câu hỏi cho thí sinh (không có answer_key). Dùng RPC get_questions_for_student để tuân RLS. */
export async function getQuestionsForAttempt(examId: string): Promise<QuestionForStudent[]> {
  let ids: string[] | null = null;
  const { data: exam, error: examErr } = await supabase
    .from('exams')
    .select('questions_snapshot_url')
    .eq('id', examId)
    .single();
  if (!examErr && exam?.questions_snapshot_url) {
    try {
      const res = await fetch(exam.questions_snapshot_url as string);
      if (res.ok) {
        const snapshot = (await res.json()) as { question_ids?: string[] };
        ids = snapshot.question_ids ?? [];
      }
    } catch (_) {}
  }

  const { data: questions, error } = await supabase.rpc('get_questions_for_student', {
    eid: examId,
    qids: ids && ids.length > 0 ? ids : null,
  });
  if (error) throw error;
  return (questions ?? []) as QuestionForStudent[];
}
