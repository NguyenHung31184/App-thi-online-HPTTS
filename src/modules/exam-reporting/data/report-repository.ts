import { supabase } from '../../../platform/supabase/client';
import type { ReportFilters } from '../domain/report-rows';

export interface CompletedAttemptRecord {
  id: string;
  user_id: string | null;
  exam_id: string | null;
  window_id: string | null;
  score: number | null;
  raw_score: number | null;
  disqualified: boolean | null;
  completed_at: number | null;
  synced_to_ttdt_at: string | null;
  exams?: { title?: string | null; pass_threshold?: number | null } | null;
  exam_windows?: { class_id?: string | null } | null;
}

export interface AuditLogRecord {
  id: string;
  attempt_id: string;
  event: string;
  metadata?: Record<string, unknown> | null;
  created_at: string | null;
  attempts?: {
    user_id?: string | null;
    exam_id?: string | null;
    window_id?: string | null;
    exams?: { title?: string | null } | null;
    exam_windows?: { class_id?: string | null } | null;
  } | null;
}

/** Completed attempts of an exam: its own attempts plus those of windows that list it among several exams. */
async function completedAttemptIdsOfExam(examId: string): Promise<string[]> {
  const { data: windowRows } = await supabase.from('exam_windows').select('id').or(`exam_id.eq.${examId},exam_ids.ov.{"${examId}"}`);
  const windowIds = (windowRows ?? []).map((r: { id: string }) => r.id);
  const ids = new Set<string>();
  const { data: byExam } = await supabase.from('attempts').select('id').eq('status', 'completed').eq('exam_id', examId);
  (byExam ?? []).forEach((r: { id: string }) => ids.add(r.id));
  if (windowIds.length > 0) {
    const { data: byWindow } = await supabase.from('attempts').select('id').eq('status', 'completed').in('window_id', windowIds);
    (byWindow ?? []).forEach((r: { id: string }) => ids.add(r.id));
  }
  return [...ids];
}

/** Profiles are not joined in the query: a join through another schema's FK or RLS can return no rows. */
export async function selectCompletedAttempts(filters: ReportFilters): Promise<CompletedAttemptRecord[]> {
  let query = supabase
    .from('attempts')
    .select('id, user_id, exam_id, window_id, score, raw_score, disqualified, completed_at, synced_to_ttdt_at, exams (title, pass_threshold), exam_windows (class_id)')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (filters.exam_id) {
    const ids = await completedAttemptIdsOfExam(filters.exam_id);
    query = ids.length > 0 ? query.in('id', ids) : query.eq('exam_id', filters.exam_id);
  }
  if (filters.window_id) query = query.eq('window_id', filters.window_id);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CompletedAttemptRecord[];
}

export async function selectAuditLogs(filters: ReportFilters): Promise<AuditLogRecord[]> {
  let query = supabase
    .from('attempt_audit_logs')
    .select('id, attempt_id, event, metadata, created_at, attempts (user_id, exam_id, window_id, exams (title), exam_windows (class_id))')
    .order('created_at', { ascending: false });
  if (filters.exam_id) query = query.eq('attempts.exam_id', filters.exam_id);
  if (filters.window_id) query = query.eq('attempts.window_id', filters.window_id);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AuditLogRecord[];
}

export async function reviewIncident(logId: string, decision: 'confirmed' | 'rejected'): Promise<void> {
  const { error } = await supabase.rpc('review_ai_proctoring_incident', { p_log_id: logId, p_decision: decision });
  if (error) throw error;
}
