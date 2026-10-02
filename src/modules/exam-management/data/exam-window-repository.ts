import { supabase } from '../../../platform/supabase/client';
import type { ExamWindow } from '../../../types';
import type { windowRowFromInput } from '../domain/exam-inputs';

export async function selectExamWindows(filters?: { exam_id?: string; class_id?: string }): Promise<ExamWindow[]> {
  let query = supabase.from('exam_windows').select('*').order('start_at', { ascending: false });
  if (filters?.exam_id) query = query.or(`exam_id.eq.${filters.exam_id},exam_ids.ov.{"${filters.exam_id}"}`);
  if (filters?.class_id) query = query.eq('class_id', filters.class_id);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ExamWindow[];
}

export async function selectExamWindow(id: string): Promise<ExamWindow | null> {
  const { data, error } = await supabase.from('exam_windows').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as ExamWindow;
}

export async function insertExamWindow(row: ReturnType<typeof windowRowFromInput>): Promise<ExamWindow> {
  const { data, error } = await supabase.from('exam_windows').insert(row).select().single();
  if (error) throw error;
  return data as ExamWindow;
}

export async function updateExamWindowRow(id: string, update: Record<string, unknown>): Promise<ExamWindow> {
  const { data, error } = await supabase.from('exam_windows').update(update).eq('id', id).select().single();
  if (error) throw error;
  return data as ExamWindow;
}

/** Hard delete, as before the move (see docs/implementation/2026-10-02-phase-1b-exam-management-module.md). */
export async function deleteExamWindowRow(id: string): Promise<void> {
  const { error } = await supabase.from('exam_windows').delete().eq('id', id);
  if (error) throw error;
}

/** Hard-deletes the attempts of every trial window; returns how many were deleted. */
export async function deleteTrialWindowAttempts(): Promise<number> {
  const { data: trialWindows, error: windowsError } = await supabase.from('exam_windows').select('id').eq('is_trial', true);
  if (windowsError) throw windowsError;
  const windowIds = (trialWindows ?? []).map((window: { id: string }) => window.id);
  if (windowIds.length === 0) return 0;
  const { data: deleted, error } = await supabase.from('attempts').delete().in('window_id', windowIds).select('id');
  if (error) throw error;
  return (deleted ?? []).length;
}
