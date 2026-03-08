import { supabase } from '../lib/supabaseClient';
import type { AttemptQuestionScore } from '../types';

export async function getAttemptQuestionScores(attemptId: string): Promise<AttemptQuestionScore[]> {
  const { data, error } = await supabase
    .from('attempt_question_scores')
    .select('*')
    .eq('attempt_id', attemptId);
  if (error) throw error;
  return (data ?? []) as AttemptQuestionScore[];
}

export async function upsertAttemptQuestionScore(
  attemptId: string,
  questionId: string,
  score: number,
  maxPoints: number
): Promise<AttemptQuestionScore> {
  const { data, error } = await supabase
    .from('attempt_question_scores')
    .upsert(
      {
        attempt_id: attemptId,
        question_id: questionId,
        score,
        max_points: maxPoints,
        graded_at: new Date().toISOString(),
      },
      { onConflict: 'attempt_id,question_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as AttemptQuestionScore;
}

/** Cập nhật điểm tổng attempt sau khi chấm/sửa điểm tự luận */
export async function recomputeAttemptScore(
  attemptId: string
): Promise<{ ok: boolean; raw_score?: number; total_max?: number; score?: number; error?: string }> {
  const { data, error } = await supabase.rpc('recompute_attempt_score', { aid: attemptId });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; raw_score?: number; total_max?: number; score?: number; error?: string };
}
