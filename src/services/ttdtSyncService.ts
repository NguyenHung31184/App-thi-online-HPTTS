/**
 * Gọi API TTDT nhận điểm (receive-exam-results) và ghi exam_sync_log / practical_sync_log.
 */
import { supabase } from '../lib/supabaseClient';
import type { Attempt } from '../types';

const RECEIVE_GRADES_URL = import.meta.env.VITE_TTDT_RECEIVE_GRADES_URL ?? '';
const TTDT_API_KEY = import.meta.env.VITE_TTDT_API_KEY ?? '';
/** Anon key thật từ Supabase (Settings > API > anon public) — gateway cần JWT hợp lệ. */
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/** Chỉ ghi sync log / update khi có anon key đúng định dạng JWT — tránh POST không header apikey gây 400. */
function canLogToSupabase(): boolean {
  return SUPABASE_ANON_KEY.length > 50 && SUPABASE_ANON_KEY.startsWith('eyJ');
}

export function isTtdtSyncConfigured(): boolean {
  return Boolean(RECEIVE_GRADES_URL && TTDT_API_KEY && !RECEIVE_GRADES_URL.includes('your-'));
}

export interface SyncResult {
  success: boolean;
  message?: string;
}

/** Payload gửi TTDT (receive-exam-results). */
export interface ReceiveGradesPayload {
  attempt_id: string;
  source: 'theory' | 'practical';
  enrollment_id?: string | null;
  student_id?: string | null;
  class_id?: string | null;
  module_id?: string | null;
  final_exam_score: number;
  raw_score?: number;
  passed: boolean;
  disqualified?: boolean;
}

/** Đồng bộ điểm 1 attempt sang TTDT và ghi exam_sync_log. */
export async function syncAttemptToTtdt(
  attempt: Attempt,
  exam: { module_id?: string | null; title: string; pass_threshold?: number },
  options?: { enrollmentId?: string | null; studentId?: string | null; classId?: string | null }
): Promise<SyncResult> {
  if (!isTtdtSyncConfigured()) {
    return { success: false, message: 'Chưa cấu hình VITE_TTDT_RECEIVE_GRADES_URL hoặc VITE_TTDT_API_KEY.' };
  }

  const threshold = exam.pass_threshold ?? 0.7;
  const payload: ReceiveGradesPayload = {
    attempt_id: attempt.id,
    source: 'theory',
    enrollment_id: options?.enrollmentId ?? null,
    student_id: options?.studentId ?? null,
    class_id: options?.classId ?? null,
    module_id: exam.module_id ?? null,
    final_exam_score: attempt.score ?? 0,
    raw_score: attempt.raw_score ?? 0,
    passed: (attempt.score ?? 0) >= threshold,
    disqualified: attempt.disqualified ?? false,
  };

  try {
    const res = await fetch(RECEIVE_GRADES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SUPABASE_ANON_KEY && { Authorization: `Bearer ${SUPABASE_ANON_KEY}` }),
        'x-api-key': TTDT_API_KEY,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    const status = res.status;
    const success = status >= 200 && status < 300;

    if (canLogToSupabase()) {
      try {
        await supabase.from('exam_sync_log').insert({
          attempt_id: attempt.id,
          enrollment_id: options?.enrollmentId ?? null,
          module_id: exam.module_id ?? null,
          payload,
          status: success ? 'success' : 'failed',
          response: text.slice(0, 2000),
        });
      } catch (_) {
        // Không ném lại — tránh 400 (No API key) làm F12 báo lỗi; đồng bộ TTDT đã thành công thì vẫn cập nhật bên dưới.
      }
      if (success) {
        try {
          await supabase
            .from('attempts')
            .update({ synced_to_ttdt_at: new Date().toISOString() })
            .eq('id', attempt.id);
        } catch (_) {}
      }
    }

    return { success, message: success ? undefined : `HTTP ${status}: ${text.slice(0, 200)}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi gọi API TTDT';
    if (canLogToSupabase()) {
      try {
        await supabase.from('exam_sync_log').insert({
          attempt_id: attempt.id,
          enrollment_id: options?.enrollmentId ?? null,
          module_id: exam.module_id ?? null,
          payload,
          status: 'failed',
          response: message.slice(0, 2000),
        });
      } catch (_) {}
    }
    return { success: false, message };
  }
}

/** Đồng bộ điểm thi thực hành (practical_attempt) sang TTDT, ghi practical_sync_log. */
export async function syncPracticalAttemptToTtdt(
  practicalAttemptId: string,
  totalScore: number,
  options?: { studentId?: string | null; classId?: string | null; moduleId?: string | null }
): Promise<SyncResult> {
  if (!isTtdtSyncConfigured()) {
    return { success: false, message: 'Chưa cấu hình VITE_TTDT_RECEIVE_GRADES_URL hoặc VITE_TTDT_API_KEY.' };
  }

  const payload: ReceiveGradesPayload = {
    attempt_id: practicalAttemptId,
    source: 'practical',
    student_id: options?.studentId ?? null,
    class_id: options?.classId ?? null,
    module_id: options?.moduleId ?? null,
    enrollment_id: null,
    final_exam_score: totalScore,
    raw_score: totalScore,
    passed: totalScore > 0,
    disqualified: false,
  };

  try {
    const res = await fetch(RECEIVE_GRADES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SUPABASE_ANON_KEY && { Authorization: `Bearer ${SUPABASE_ANON_KEY}` }),
        'x-api-key': TTDT_API_KEY,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    const status = res.status;
    const success = status >= 200 && status < 300;

    if (canLogToSupabase()) {
      try {
        await supabase.from('practical_sync_log').insert({
          practical_attempt_id: practicalAttemptId,
          enrollment_id: null,
          module_id: options?.moduleId ?? null,
          payload,
          status: success ? 'success' : 'failed',
          response: text.slice(0, 2000),
        });
      } catch (_) {}
      if (success) {
        try {
          await supabase
            .from('practical_attempts')
            .update({ synced_to_ttdt_at: new Date().toISOString() })
            .eq('id', practicalAttemptId);
        } catch (_) {}
      }
    }

    return { success, message: success ? undefined : `HTTP ${status}: ${text.slice(0, 200)}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi gọi API TTDT';
    if (canLogToSupabase()) {
      try {
        await supabase.from('practical_sync_log').insert({
          practical_attempt_id: practicalAttemptId,
          module_id: options?.moduleId ?? null,
          payload,
          status: 'failed',
          response: message.slice(0, 2000),
        });
      } catch (_) {}
    }
    return { success: false, message };
  }
}
