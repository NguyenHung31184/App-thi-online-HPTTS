import { supabase } from '../../../platform/supabase/client';
import type { ExamSyncLogEntry, PracticalSyncLogEntry, SyncStatus } from '../domain/sync-log';

const LOG_LIMIT = 500;

export async function selectExamSyncLog(status?: SyncStatus): Promise<ExamSyncLogEntry[]> {
  let query = supabase.from('exam_sync_log').select('*').order('created_at', { ascending: false }).limit(LOG_LIMIT);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ExamSyncLogEntry[];
}

export async function selectPracticalSyncLog(status?: SyncStatus): Promise<PracticalSyncLogEntry[]> {
  let query = supabase.from('practical_sync_log').select('*').order('created_at', { ascending: false }).limit(LOG_LIMIT);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PracticalSyncLogEntry[];
}

/** Class names by id; an unreadable list leaves the ids. */
export async function selectClassNamesById(classIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (classIds.length === 0) return map;
  const { data, error } = await supabase.from('classes').select('id, name').in('id', classIds);
  if (error) return map;
  (data ?? []).forEach((c: { id: string; name: string | null }) => {
    if (c?.name) map.set(c.id, c.name.trim());
  });
  return map;
}

/** Whether the attempt and its exam exist, before asking for a retry. */
export async function selectTheoryAttemptRef(attemptId: string): Promise<{ attempt: boolean; exam: boolean }> {
  const { data: attempt } = await supabase.from('attempts').select('id, exam_id').eq('id', attemptId).maybeSingle();
  if (!attempt) return { attempt: false, exam: false };
  const { data: exam } = await supabase.from('exams').select('id').eq('id', (attempt as { exam_id: string }).exam_id).maybeSingle();
  return { attempt: true, exam: Boolean(exam) };
}

export async function practicalAttemptExists(attemptId: string): Promise<boolean> {
  const { data } = await supabase.from('practical_attempts').select('id').eq('id', attemptId).maybeSingle();
  return Boolean(data);
}

/** Grades waiting in the server queue (pending or being sent). */
export async function countWaitingSyncJobs(): Promise<number> {
  const { count, error } = await supabase.from('exam_sync_jobs').select('id', { count: 'exact', head: true }).in('status', ['pending', 'processing']);
  if (error) throw error;
  return count ?? 0;
}
