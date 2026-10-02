import { supabase } from '../../../platform/supabase/client';

/** The question ids each attempt of an exam drew; empty when the read fails, as the bank check page always did. */
export async function selectDrawnQuestionIds(examId: string): Promise<(string[] | null)[]> {
  const { data, error } = await supabase.from('attempts').select('question_ids').eq('exam_id', examId).not('question_ids', 'is', null);
  if (error) return [];
  return ((data ?? []) as { question_ids: string[] | null }[]).map((row) => row.question_ids);
}

/** Attempts already made in a window (any student). */
export async function countAttemptsOfWindow(windowId: string): Promise<number> {
  const { count, error } = await supabase.from('attempts').select('id', { count: 'exact', head: true }).eq('window_id', windowId);
  if (error) throw error;
  return count ?? 0;
}
