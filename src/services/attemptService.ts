import { supabase } from '../lib/supabaseClient';
import type { Attempt, QuestionForStudent } from '../types';
import {
  getTheoryAttemptWindowContext,
  getTheoryAttemptQuestions,
  disqualifyTheoryAttempt,
  recordTheoryAttemptAuditEvent,
  saveTheoryAttemptAnswers,
  startTheoryAttempt,
  submitTheoryAttempt,
  type AttemptWindowContext,
} from '../modules/exam-taking/public';

export async function startExamAttempt(
  windowId: string,
  accessCode: string,
): Promise<Attempt> {
  return startTheoryAttempt(windowId, accessCode);
}

export async function getAttempt(id: string): Promise<Attempt | null> {
  const { data, error } = await supabase.from('attempts').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Attempt;
}

export type { AttemptWindowContext };

export async function getAttemptWindowContext(attemptId: string): Promise<AttemptWindowContext | null> {
  return getTheoryAttemptWindowContext(attemptId);
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

/** Đếm số lần học viên đã thi trong một cửa sổ thi — dùng để kiểm tra giới hạn max_attempts. */
export async function countUserAttemptsForWindow(userId: string, windowId: string): Promise<number> {
  const { count, error } = await supabase
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('window_id', windowId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Đếm tổng số attempt (mọi học viên) đã tạo trong một cửa sổ thi — dùng ở Admin để
 * cảnh báo/khoá việc đổi is_trial trên cửa sổ đã có người thi. Vì attempts không lưu
 * cờ trial riêng (chỉ suy ra từ exam_windows.is_trial hiện hành), nếu đổi is_trial
 * true → false trên cửa sổ đã có attempt, các attempt "thi thử" cũ sẽ bị tính vào
 * giới hạn max_attempts của "thi thật", có thể khoá học viên ngay từ lần đầu.
 */
export async function countAttemptsForWindow(windowId: string): Promise<number> {
  const { count, error } = await supabase
    .from('attempts')
    .select('id', { count: 'exact', head: true })
    .eq('window_id', windowId);
  if (error) throw error;
  return count ?? 0;
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
  return saveTheoryAttemptAnswers(attemptId, answers);
}

/** Chấm bài server-side (RPC), trả về kết quả. */
export async function submitAttempt(
  attemptId: string
): Promise<{ ok: boolean; raw_score?: number; total_max?: number; score?: number; error?: string }> {
  return submitTheoryAttempt(attemptId);
}

/** Đánh dấu bài thi bị hủy do vi phạm: score=0, disqualified=true, không tính điểm. */
export async function disqualifyAttempt(
  attemptId: string
): Promise<{ ok: boolean; error?: string }> {
  return disqualifyTheoryAttempt(attemptId);
}

/** Ghi audit log (focus_lost, visibility_hidden, ...) */
export async function logAuditEvent(
  attemptId: string,
  event: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return recordTheoryAttemptAuditEvent(attemptId, event, metadata);
}

/** Lấy câu hỏi cho thí sinh (không có answer_key).
 * Attempt mới (có question_ids): đọc từ question_bank qua RPC get_questions_for_attempt.
 * Attempt cũ (question_ids IS NULL): fallback sang questions table qua get_questions_for_student. */
export async function getQuestionsForAttempt(
  attemptId: string,
  examId: string,
): Promise<QuestionForStudent[]> {
  return getTheoryAttemptQuestions(attemptId, examId);
}
