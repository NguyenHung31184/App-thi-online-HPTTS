/**
 * Đọc exam_sync_log và practical_sync_log; dùng cho màn Đồng bộ điểm.
 */
import { supabase } from '../lib/supabaseClient';

async function fetchClassNamesById(classIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (classIds.length === 0) return map;
  const { data, error } = await supabase
    .from('classes')
    .select('id, name')
    .in('id', classIds);
  if (error) return map;
  (data ?? []).forEach((c: { id: string; name: string | null }) => {
    if (c?.name) map.set(c.id, c.name.trim());
  });
  return map;
}

export type SyncStatus = 'success' | 'failed';

export interface ExamSyncLogEntry {
  id: string;
  attempt_id: string;
  enrollment_id: string | null;
  module_id: string | null;
  payload: unknown;
  status: SyncStatus;
  response: string | null;
  created_at: string;
  // snapshot columns (lưu tại thời điểm ghi log — tránh RLS join)
  exam_title?: string | null;
  window_id?: string | null;
  class_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  // derived (lookup sau khi đọc)
  class_name?: string;
}

export interface PracticalSyncLogEntry {
  id: string;
  practical_attempt_id: string;
  enrollment_id: string | null;
  module_id: string | null;
  payload: unknown;
  status: SyncStatus;
  response: string | null;
  created_at: string;
}

export interface SyncLogFilters {
  status?: SyncStatus;
}

export interface CleanupOptions {
  days?: number;
  status?: SyncStatus;
}

/** Danh sách log đồng bộ điểm lý thuyết (exam_sync_log), mới nhất trước. */
export async function listExamSyncLog(
  filters?: SyncLogFilters
): Promise<ExamSyncLogEntry[]> {
  let q = supabase
    .from('exam_sync_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (filters?.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) throw error;
  const logs = (data ?? []) as ExamSyncLogEntry[];

  if (logs.length === 0) return logs;

  // Lookup class_name từ class_id snapshot (classes table không bị RLS chặn admin)
  const classIds = [...new Set(logs.map((l) => l.class_id).filter((id): id is string => Boolean(id)))];
  const classNamesById = await fetchClassNamesById(classIds);

  return logs.map((l) => ({
    ...l,
    class_name: l.class_id ? (classNamesById.get(l.class_id) ?? l.class_id) : '',
  }));
}

/** Danh sách log đồng bộ điểm thực hành (practical_sync_log), mới nhất trước. */
export async function listPracticalSyncLog(
  filters?: SyncLogFilters
): Promise<PracticalSyncLogEntry[]> {
  let q = supabase
    .from('practical_sync_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (filters?.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PracticalSyncLogEntry[];
}

/** Xóa bớt log cũ (mặc định: lỗi > 30 ngày). */
export async function cleanupOldSyncLogs(options?: CleanupOptions): Promise<void> {
  const days = options?.days ?? 30;
  const status = options?.status ?? 'failed';
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    await supabase
      .from('exam_sync_log')
      .delete()
      .lt('created_at', cutoff)
      .eq('status', status);
  } catch (err) {
    console.warn('[cleanupOldSyncLogs] exam_sync_log:', err);
  }

  try {
    await supabase
      .from('practical_sync_log')
      .delete()
      .lt('created_at', cutoff)
      .eq('status', status);
  } catch (err) {
    console.warn('[cleanupOldSyncLogs] practical_sync_log:', err);
  }
}
