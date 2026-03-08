import { supabase } from '../lib/supabaseClient';

export interface Profile {
  id: string;
  role: string;
  student_id: string | null;
  updated_at?: string;
}

/** Lấy profile của user hiện tại (phải đã đăng nhập). Nếu chưa có profile thì tạo (role student). */
export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, student_id, updated_at')
    .eq('id', user.id)
    .single();
  if (error?.code === 'PGRST116') {
    const { error: insertErr } = await supabase.from('profiles').insert({ id: user.id, role: 'student' });
    if (!insertErr) {
      const { data: created } = await supabase.from('profiles').select('id, role, student_id, updated_at').eq('id', user.id).single();
      return created as Profile;
    }
  }
  if (error) throw error;
  return data as Profile;
}

/** Cập nhật student_id (TTDT) cho user hiện tại — gọi sau khi verify CCCD. */
export async function updateMyStudentId(studentId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Chưa đăng nhập');
  const { error } = await supabase
    .from('profiles')
    .update({ student_id: studentId, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) throw error;
}
