import { supabase } from '../../../platform/supabase/client';
import type { PracticalAttempt, PracticalAttemptPhoto, PracticalAttemptScore } from '../../../types';

/** The server checks the code, the time window and the class enrollment, and returns the open attempt if any. */
export async function callStartAttempt(sessionId: string, accessCode: string): Promise<PracticalAttempt> {
  const { data, error } = await supabase.rpc('start_practical_attempt', { p_session_id: sessionId, p_access_code: accessCode });
  if (error) throw error;
  return data as PracticalAttempt;
}

/** The server refuses a submission without evidence and locks the evidence afterwards. */
export async function callSubmitAttempt(attemptId: string): Promise<PracticalAttempt> {
  const { data, error } = await supabase.rpc('submit_practical_attempt', { p_attempt_id: attemptId });
  if (error) throw error;
  return data as PracticalAttempt;
}

export async function selectAttempt(id: string): Promise<PracticalAttempt | null> {
  const { data, error } = await supabase.from('practical_attempts').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as PracticalAttempt;
}

export async function selectAttemptsOfSession(sessionId: string): Promise<PracticalAttempt[]> {
  const { data, error } = await supabase.from('practical_attempts').select('*').eq('session_id', sessionId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PracticalAttempt[];
}

export async function markGraded(attemptId: string, totalScore: number, gradedBy: string): Promise<PracticalAttempt> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('practical_attempts')
    .update({ status: 'graded', total_score: totalScore, graded_at: now, graded_by: gradedBy, updated_at: now })
    .eq('id', attemptId)
    .select()
    .single();
  if (error) throw error;
  return data as PracticalAttempt;
}

export async function selectPhotos(attemptId: string): Promise<PracticalAttemptPhoto[]> {
  const { data, error } = await supabase.from('practical_attempt_photos').select('*').eq('attempt_id', attemptId).order('order_index');
  if (error) throw error;
  return (data ?? []) as PracticalAttemptPhoto[];
}

export async function insertPhoto(row: {
  attempt_id: string;
  criteria_id: string | null;
  label: string;
  file_url: string;
  order_index: number;
}): Promise<PracticalAttemptPhoto> {
  const { data, error } = await supabase.from('practical_attempt_photos').insert(row).select().single();
  if (error) throw error;
  return data as PracticalAttemptPhoto;
}

/** Removes the row only; the file stays in storage. */
export async function deletePhotoRow(photoId: string): Promise<void> {
  const { error } = await supabase.from('practical_attempt_photos').delete().eq('id', photoId);
  if (error) throw error;
}

export async function selectScores(attemptId: string): Promise<PracticalAttemptScore[]> {
  const { data, error } = await supabase.from('practical_attempt_scores').select('*').eq('attempt_id', attemptId);
  if (error) throw error;
  return (data ?? []) as PracticalAttemptScore[];
}

export async function upsertScore(attemptId: string, criteriaId: string, score: number, comment: string | null): Promise<PracticalAttemptScore> {
  const { data, error } = await supabase
    .from('practical_attempt_scores')
    .upsert(
      { attempt_id: attemptId, criteria_id: criteriaId, score, comment, graded_at: new Date().toISOString() },
      { onConflict: 'attempt_id,criteria_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data as PracticalAttemptScore;
}

/** The TTDT student linked to an exam account. */
export async function selectProfileStudentId(userId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('student_id').eq('id', userId).maybeSingle();
  return (data as { student_id?: string | null } | null)?.student_id ?? null;
}
