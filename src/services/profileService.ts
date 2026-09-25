import { supabase } from '../lib/supabaseClient';

export interface Profile {
  id: string;
  role: string;
  /** Quyền App thi: admin | teacher | proctor, NULL = học viên. */
  exam_role: string | null;
  student_id: string | null;
  updated_at?: string;
}

/** Lấy profile của user hiện tại (phải đã đăng nhập). Hồ sơ do máy chủ tạo cùng tài khoản; thiếu hồ sơ thì trả null. */
export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, exam_role, student_id, updated_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
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
