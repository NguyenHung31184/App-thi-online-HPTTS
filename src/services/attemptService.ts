import { supabase } from '../lib/supabaseClient';
import type { Attempt, QuestionForStudent } from '../types';

export async function createAttempt(
  _userId: string,
  windowId: string,
  examId: string
): Promise<Attempt> {
  const { data, error } = await supabase.rpc('create_attempt_with_questions', {
    p_window_id: windowId,
    p_exam_id: examId,
  });
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

const EXAM_UPLOADS_BUCKET = 'exam-uploads';
const START_PHOTO_SIGNED_SECONDS = 7200;

/**
 * Ảnh khuôn mặt lúc vào thi (audit photo_taken → metadata.path).
 * Admin/teacher: đọc audit + Storage. Thí sinh: cần policy migration 20260411140000.
 */
export async function fetchStartExamPhotoSignedUrl(attemptId: string): Promise<string | null> {
  const { data: rows, error } = await supabase
    .from('attempt_audit_logs')
    .select('metadata')
    .eq('attempt_id', attemptId)
    .eq('event', 'photo_taken')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error || !rows?.length) return null;
  const meta = rows[0].metadata as Record<string, unknown> | null;
  const path = typeof meta?.path === 'string' ? meta.path.trim() : '';
  if (!path) return null;
  const { data: signed, error: signErr } = await supabase.storage
    .from(EXAM_UPLOADS_BUCKET)
    .createSignedUrl(path, START_PHOTO_SIGNED_SECONDS);
  if (signErr || !signed?.signedUrl) return null;
  return signed.signedUrl;
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

/** Lấy câu hỏi cho thí sinh (không có answer_key).
 * Attempt mới (có question_ids): đọc từ question_bank qua RPC get_questions_for_attempt.
 * Attempt cũ (question_ids IS NULL): fallback sang questions table qua get_questions_for_student. */
export async function getQuestionsForAttempt(
  attemptId: string,
  examId: string,
): Promise<QuestionForStudent[]> {
  // Kiểm tra attempt có question_ids không (bài làm theo hệ mới)
  const { data: attemptRow } = await supabase
    .from('attempts')
    .select('question_ids')
    .eq('id', attemptId)
    .single();

  if (attemptRow?.question_ids?.length) {
    const { data, error } = await supabase.rpc('get_questions_for_attempt', { aid: attemptId });
    if (error) throw error;
    return (data ?? []) as QuestionForStudent[];
  }

  // Legacy: attempt cũ không có question_ids — đọc từ questions table
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
    } catch { /* fallback sang full list nếu snapshot lỗi */ }
  }

  const { data: questions, error } = await supabase.rpc('get_questions_for_student', {
    eid: examId,
    qids: ids && ids.length > 0 ? ids : null,
  });
  if (error) throw error;
  return (questions ?? []) as QuestionForStudent[];
}
