import { supabase } from '../../../platform/supabase/client';
import type { AttemptWithExam } from '../domain/student-results';

export async function selectStudentResults(userId: string): Promise<AttemptWithExam[]> {
  const { data, error } = await supabase.from('attempts')
    .select('*, exams (title, duration_minutes, pass_threshold)')
    .eq('user_id', userId).eq('status', 'completed').order('completed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AttemptWithExam[];
}

export async function currentResultUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

export async function selectLegacyTotalPoints(examId: string): Promise<number | null> {
  const { data, error } = await supabase.from('questions').select('points').eq('exam_id', examId);
  if (error) throw error;
  const total = (data ?? []).reduce((sum, row) => sum + (Number(row.points) || 0), 0);
  return total > 0 ? total : null;
}

export async function fetchStartExamPhotoSignedUrl(attemptId: string): Promise<string | null> {
  const { data, error } = await supabase.from('attempt_audit_logs').select('metadata')
    .eq('attempt_id', attemptId).eq('event', 'photo_taken').order('created_at', { ascending: true }).limit(1);
  if (error || !data?.length) return null;
  const metadata = data[0].metadata as Record<string, unknown> | null;
  const storagePath = typeof metadata?.path === 'string' ? metadata.path.trim() : '';
  if (!storagePath) return null;
  const { data: signed, error: signError } = await supabase.storage.from('exam-uploads').createSignedUrl(storagePath, 7200);
  return signError ? null : signed?.signedUrl ?? null;
}
