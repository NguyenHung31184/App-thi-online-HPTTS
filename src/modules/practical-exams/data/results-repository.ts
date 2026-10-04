import { supabase } from '../../../platform/supabase/client';

export interface ResultAttemptRow {
  id: string;
  session_id: string;
  student_id: string | null;
  user_id: string | null;
  status: string;
  total_score: number | string | null;
  is_disqualified: boolean | null;
  disqualify_reason: string | null;
  synced_to_ttdt_at: string | null;
  graded_at: string | null;
  graded_by: string | null;
  ppe_check: unknown;
  cycle_seconds: number[] | null;
  created_at: string;
}

export interface ResultScoreRow {
  attempt_id: string;
  criteria_id: string;
  score: number | string;
  deductions: unknown;
}

export interface ResultPhotoRow {
  id: string;
  label: string | null;
  kind: string | null;
  file_url: string;
}

const ATTEMPT_COLUMNS =
  'id, session_id, student_id, user_id, status, total_score, is_disqualified, disqualify_reason, synced_to_ttdt_at, graded_at, graded_by, ppe_check, cycle_seconds, created_at';
const SIGNED_SECONDS = 3600;

/** Students enrolled in the class, sorted by given name as on the class lists. */
export async function selectEnrolledStudents(classId: string): Promise<{ id: string; name: string; birthDate: string | null }[]> {
  const { data, error } = await supabase.from('enrollments').select('student_id, students(id, name, dob)').eq('class_id', classId).eq('is_deleted', false);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[])
    .map((e) => {
      const s = (Array.isArray(e.students) ? e.students[0] : e.students) as Record<string, unknown> | null;
      return { id: String(s?.id ?? e.student_id), name: String(s?.name ?? 'Không rõ tên'), birthDate: (s?.dob as string | null) ?? null };
    })
    .sort((a, b) => a.name.split(' ').pop()!.localeCompare(b.name.split(' ').pop()!, 'vi') || a.name.localeCompare(b.name, 'vi'));
}

/** Attempts of the session, oldest first. */
export async function selectResultAttempts(sessionId: string): Promise<ResultAttemptRow[]> {
  const { data, error } = await supabase.from('practical_attempts').select(ATTEMPT_COLUMNS).eq('session_id', sessionId).order('created_at');
  if (error) throw error;
  return (data ?? []) as ResultAttemptRow[];
}

export async function selectResultAttempt(attemptId: string): Promise<ResultAttemptRow | null> {
  const { data, error } = await supabase.from('practical_attempts').select(ATTEMPT_COLUMNS).eq('id', attemptId).maybeSingle();
  if (error) throw error;
  return data as ResultAttemptRow | null;
}

export async function selectResultScores(attemptIds: string[]): Promise<ResultScoreRow[]> {
  if (attemptIds.length === 0) return [];
  const { data, error } = await supabase.from('practical_attempt_scores').select('attempt_id, criteria_id, score, deductions').in('attempt_id', attemptIds);
  if (error) throw error;
  return (data ?? []) as ResultScoreRow[];
}

/** Photos of the attempt with a URL that opens: field photos are stored as a path and signed here. */
export async function selectResultPhotos(attemptId: string): Promise<(ResultPhotoRow & { url: string | null })[]> {
  const { data, error } = await supabase.from('practical_attempt_photos').select('id, label, kind, file_url').eq('attempt_id', attemptId).order('order_index');
  if (error) throw error;
  const rows = (data ?? []) as ResultPhotoRow[];
  const paths = rows.map((r) => r.file_url).filter((u) => !/^https?:/i.test(u));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls, error: signError } = await supabase.storage.from('exam-uploads').createSignedUrls(paths, SIGNED_SECONDS);
    if (signError) throw signError;
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  return rows.map((r) => ({ ...r, url: /^https?:/i.test(r.file_url) ? r.file_url : signed.get(r.file_url) ?? null }));
}

export async function selectStudentName(studentId: string): Promise<{ name: string; birthDate: string | null } | null> {
  const { data } = await supabase.from('students').select('name, dob').eq('id', studentId).maybeSingle();
  const row = data as { name?: string; dob?: string | null } | null;
  return row?.name ? { name: row.name, birthDate: row.dob ?? null } : null;
}

export async function selectProfileName(userId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('name, email').eq('id', userId).maybeSingle();
  const row = data as { name?: string | null; email?: string | null } | null;
  return row?.name || row?.email || null;
}
