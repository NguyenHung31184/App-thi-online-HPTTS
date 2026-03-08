import { supabase } from '../lib/supabaseClient';
import type {
  PracticalAttempt,
  PracticalAttemptPhoto,
  PracticalAttemptScore,
  PracticalExamCriteria,
} from '../types';

const BUCKET_PHOTOS = 'exam-uploads';

export async function createPracticalAttempt(
  sessionId: string,
  userId: string
): Promise<PracticalAttempt> {
  const { data, error } = await supabase
    .from('practical_attempts')
    .insert({
      session_id: sessionId,
      user_id: userId,
      status: 'pending_upload',
    })
    .select()
    .single();
  if (error) throw error;
  return data as PracticalAttempt;
}

export async function getPracticalAttempt(
  id: string
): Promise<PracticalAttempt | null> {
  const { data, error } = await supabase
    .from('practical_attempts')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as PracticalAttempt;
}

export async function listPracticalAttemptsBySession(
  sessionId: string
): Promise<PracticalAttempt[]> {
  const { data, error } = await supabase
    .from('practical_attempts')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PracticalAttempt[];
}

export async function submitPracticalAttempt(attemptId: string): Promise<PracticalAttempt> {
  const { data, error } = await supabase
    .from('practical_attempts')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .select()
    .single();
  if (error) throw error;
  return data as PracticalAttempt;
}

// --- Photos ---

export async function listPracticalPhotos(
  attemptId: string
): Promise<PracticalAttemptPhoto[]> {
  const { data, error } = await supabase
    .from('practical_attempt_photos')
    .select('*')
    .eq('attempt_id', attemptId)
    .order('order_index');
  if (error) throw error;
  return (data ?? []) as PracticalAttemptPhoto[];
}

export async function uploadPracticalPhoto(
  attemptId: string,
  file: File,
  options?: { criteria_id?: string | null; label?: string; order_index?: number }
): Promise<PracticalAttemptPhoto> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `practical/${attemptId}/${Date.now()}.${ext}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET_PHOTOS)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from(BUCKET_PHOTOS).getPublicUrl(uploadData.path);
  const file_url = urlData.publicUrl;

  const { data, error } = await supabase
    .from('practical_attempt_photos')
    .insert({
      attempt_id: attemptId,
      criteria_id: options?.criteria_id ?? null,
      label: options?.label ?? '',
      file_url,
      order_index: options?.order_index ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PracticalAttemptPhoto;
}

export async function deletePracticalPhoto(photoId: string): Promise<void> {
  const { error } = await supabase.from('practical_attempt_photos').delete().eq('id', photoId);
  if (error) throw error;
}

// --- Scores (GV chấm) ---

export async function listPracticalScores(
  attemptId: string
): Promise<PracticalAttemptScore[]> {
  const { data, error } = await supabase
    .from('practical_attempt_scores')
    .select('*')
    .eq('attempt_id', attemptId);
  if (error) throw error;
  return (data ?? []) as PracticalAttemptScore[];
}

export async function upsertPracticalScore(
  attemptId: string,
  criteriaId: string,
  score: number,
  comment?: string | null
): Promise<PracticalAttemptScore> {
  const { data, error } = await supabase
    .from('practical_attempt_scores')
    .upsert(
      {
        attempt_id: attemptId,
        criteria_id: criteriaId,
        score,
        comment: comment ?? null,
        graded_at: new Date().toISOString(),
      },
      { onConflict: 'attempt_id,criteria_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data as PracticalAttemptScore;
}

/** Tính tổng điểm (score * weight) và cập nhật attempt thành graded. */
export async function completePracticalGrading(
  attemptId: string,
  criteria: PracticalExamCriteria[],
  scoresByCriteria: Record<string, number>,
  gradedBy: string
): Promise<PracticalAttempt> {
  let totalScore = 0;
  for (const c of criteria) {
    const s = scoresByCriteria[c.id] ?? 0;
    totalScore += s * (c.weight ?? 1);
  }

  const { data, error } = await supabase
    .from('practical_attempts')
    .update({
      status: 'graded',
      total_score: totalScore,
      graded_at: new Date().toISOString(),
      graded_by: gradedBy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .select()
    .single();
  if (error) throw error;
  return data as PracticalAttempt;
}
