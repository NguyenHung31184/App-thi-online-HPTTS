/**
 * Đọc exam_sync_log và practical_sync_log; dùng cho màn Đồng bộ điểm.
 */
import { supabase } from '../lib/supabaseClient';

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
  return (data ?? []) as ExamSyncLogEntry[];
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
