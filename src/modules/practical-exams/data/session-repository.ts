import { supabase } from '../../../platform/supabase/client';
import type { PracticalExamSession, PracticalExamTemplate } from '../../../types';
import type { CreatePracticalSessionInput, UpdatePracticalSessionInput } from '../domain/inputs';

export type SessionWithTemplateRow = PracticalExamSession & { practical_exam_templates: PracticalExamTemplate | null };

export async function selectSessions(filters?: { template_id?: string; class_id?: string }): Promise<PracticalExamSession[]> {
  let query = supabase.from('practical_exam_sessions').select('*').eq('is_deleted', false).order('start_at', { ascending: false });
  if (filters?.template_id) query = query.eq('template_id', filters.template_id);
  if (filters?.class_id) query = query.eq('class_id', filters.class_id);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PracticalExamSession[];
}

export async function selectSession(id: string): Promise<PracticalExamSession | null> {
  const { data, error } = await supabase.from('practical_exam_sessions').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as PracticalExamSession;
}

export async function selectSessionWithTemplate(id: string): Promise<SessionWithTemplateRow | null> {
  const { data, error } = await supabase.from('practical_exam_sessions').select('*, practical_exam_templates (*)').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as SessionWithTemplateRow;
}

/** Sessions open now in "student uploads evidence" mode, optionally only for some classes. */
export async function selectOpenUploadSessions(now: number, classIds: string[]): Promise<SessionWithTemplateRow[]> {
  let query = supabase
    .from('practical_exam_sessions')
    .select('*, practical_exam_templates (*)')
    .eq('mode', 'student_upload')
    .eq('is_deleted', false)
    .lte('start_at', now)
    .gte('end_at', now)
    .order('start_at', { ascending: false });
  if (classIds.length > 0) query = query.in('class_id', classIds);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SessionWithTemplateRow[];
}

export async function selectClassName(classId: string): Promise<string | undefined> {
  const { data } = await supabase.from('classes').select('name').eq('id', classId).single();
  return (data as { name?: string } | null)?.name;
}

export async function selectClassNames(classIds: string[]): Promise<Record<string, string>> {
  if (classIds.length === 0) return {};
  const { data } = await supabase.from('classes').select('id, name').in('id', classIds);
  return Object.fromEntries(((data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
}

export async function insertSession(input: CreatePracticalSessionInput): Promise<PracticalExamSession> {
  const row: Partial<PracticalExamSession> = {
    template_id: input.template_id,
    class_id: input.class_id,
    start_at: input.start_at,
    end_at: input.end_at,
    access_code: input.access_code,
    mode: input.mode ?? 'student_upload',
  };
  const { data, error } = await supabase.from('practical_exam_sessions').insert(row).select().single();
  if (error) throw error;
  return data as PracticalExamSession;
}

export async function updateSessionRow(id: string, input: UpdatePracticalSessionInput): Promise<PracticalExamSession> {
  const patch: Partial<PracticalExamSession> = { ...input };
  const { data, error } = await supabase.from('practical_exam_sessions').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as PracticalExamSession;
}

/** Soft delete: attempts and grades of the session keep their rows. */
export async function deleteSessionRow(id: string): Promise<void> {
  const { error } = await supabase.from('practical_exam_sessions').update({ is_deleted: true }).eq('id', id);
  if (error) throw error;
}
