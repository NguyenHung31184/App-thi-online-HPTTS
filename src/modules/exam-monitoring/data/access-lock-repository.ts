import { supabase } from '../../../platform/supabase/client';
import type { AccessFailure } from '../domain/access-locks';

type Row = Record<string, unknown>;
const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

/** Students entering wrong access codes at windows open now (RPC checks the exam role). */
export async function fetchAccessFailures(): Promise<AccessFailure[]> {
  const { data, error } = await supabase.rpc('get_exam_access_failures');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((row) => ({
    windowId: String(row.window_id),
    className: text(row.class_name),
    examTitle: text(row.exam_title),
    userId: String(row.user_id),
    studentCode: text(row.student_code),
    studentName: text(row.student_name),
    failureCount: Number(row.failure_count ?? 0) || 0,
    lastFailedAt: String(row.last_failed_at),
    lockedUntil: text(row.locked_until),
  }));
}

/** Clears the wrong-code counter of one student at one window; the server records who unlocked. */
export async function unlockAccess(windowId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('unlock_exam_access', { p_window_id: windowId, p_user_id: userId });
  if (error) throw new Error(error.message);
  return data === true;
}
