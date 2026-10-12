import { supabase } from '../../../platform/supabase/client';
import { validateProgressInput, type AssignedLesson, type RecordLearningInput, type LearningReceipt } from '../domain/assigned-learning';
import type { AssignedProgress, LearningEnrollment } from '../domain/assigned-learning';

export async function getLearningEnrollments(): Promise<LearningEnrollment[]> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error('Cần đăng nhập để tải bài học được giao.');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('student_id').eq('id',auth.user.id).single();
  if (profileError) throw profileError;
  if (!profile?.student_id) return [];
  const result: LearningEnrollment[] = [];
  for (let from=0; ; from+=500) {
    const { data, error } = await supabase.from('enrollments').select('id, class_id, classes(name)')
      .eq('student_id',profile.student_id).eq('is_deleted',false).order('id').range(from,from+499);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      const cls = (Array.isArray(row.classes) ? row.classes[0] : row.classes) as { name?: string } | null;
      result.push({ id:String(row.id),classId:String(row.class_id),className:cls?.name ?? String(row.class_id) });
    }
    if (rows.length<500) return result;
  }
}

export async function getAssignedProgress(enrollmentId: string): Promise<AssignedProgress[]> {
  const result: AssignedProgress[] = [];
  for (let from=0; ; from+=500) {
    const { data,error } = await supabase.from('elearning_enrollment_progress')
      .select('id,assignment_id,block_id,status,resume_seconds,source,completed_at,updated_at')
      .eq('enrollment_id',enrollmentId).order('id').range(from,from+499);
    if (error) throw error;
    result.push(...(data ?? []) as AssignedProgress[]);
    if ((data?.length ?? 0)<500) return result;
  }
}

export function watchLearningToken(onToken: (token: string) => void): () => void {
  let active = true;
  void supabase.auth.getSession().then(({data}) => { if (active) onToken(data.session?.access_token ?? ''); });
  const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,session) => onToken(session?.access_token ?? ''));
  return () => {active=false;subscription.unsubscribe();};
}

export function flushAssignedProgress(token: string, input: RecordLearningInput): void {
  if (!token) return;
  validateProgressInput(input);
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  void fetch(`${url}/rest/v1/rpc/elearning_record_progress`, {
    method:'POST',keepalive:true,
    headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${token}`},
    body:JSON.stringify({p_enrollment_id:input.enrollmentId,p_assignment_id:input.assignmentId,p_block_id:input.blockId,
      p_resume_seconds:input.resumeSeconds ?? 0,p_from_seconds:input.fromSeconds ?? null,p_to_seconds:input.toSeconds ?? null,p_confirm_read:false}),
  }).catch(() => {});
}

export async function getAssignedLessons(enrollmentId: string): Promise<AssignedLesson[]> {
  const { data, error } = await supabase.rpc('elearning_get_assigned_lessons', { p_enrollment_id: enrollmentId });
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error('Danh sách bài được giao không hợp lệ.');
  return data as AssignedLesson[];
}

export async function recordLearningProgress(input: RecordLearningInput): Promise<LearningReceipt> {
  validateProgressInput(input);
  const { data, error } = await supabase.rpc('elearning_record_progress', {
    p_enrollment_id: input.enrollmentId, p_assignment_id: input.assignmentId, p_block_id: input.blockId,
    p_resume_seconds: input.resumeSeconds ?? 0, p_from_seconds: input.fromSeconds ?? null,
    p_to_seconds: input.toSeconds ?? null, p_confirm_read: input.confirmRead ?? false,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('Chưa nhận được xác nhận lưu tiến độ.');
  return data as LearningReceipt;
}
