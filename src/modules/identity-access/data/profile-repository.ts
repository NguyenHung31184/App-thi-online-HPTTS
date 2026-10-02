import { supabase } from '../../../platform/supabase/client';

export interface Profile {
  id: string;
  role: string;
  /** Exam app role: admin | teacher | proctor; NULL means student. */
  exam_role: string | null;
  student_id: string | null;
  updated_at?: string;
}

/** The current user's profile; the server creates it with the account, so a missing one returns null. */
export async function selectMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('id, role, exam_role, student_id, updated_at').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

/** Links the current user to a TTDT student after the CCCD check. */
export async function updateMyStudentId(studentId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Chưa đăng nhập');
  const { error } = await supabase.from('profiles').update({ student_id: studentId, updated_at: new Date().toISOString() }).eq('id', user.id);
  if (error) throw error;
}
