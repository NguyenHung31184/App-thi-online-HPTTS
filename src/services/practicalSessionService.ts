import { supabase } from '../lib/supabaseClient';
import type { PracticalExamSession, PracticalExamTemplate } from '../types';
import { getClassIdsByStudentId } from './ttdtDataService';

export interface PracticalSessionWithTemplate extends PracticalExamSession {
  template?: PracticalExamTemplate | null;
  class_name?: string;
}

export async function listPracticalSessions(filters?: {
  template_id?: string;
  class_id?: string;
}): Promise<PracticalExamSession[]> {
  let q = supabase
    .from('practical_exam_sessions')
    .select('*')
    .order('start_at', { ascending: false });
  if (filters?.template_id) q = q.eq('template_id', filters.template_id);
  if (filters?.class_id) q = q.eq('class_id', filters.class_id);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PracticalExamSession[];
}

export async function getPracticalSession(
  id: string
): Promise<PracticalExamSession | null> {
  const { data, error } = await supabase
    .from('practical_exam_sessions')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as PracticalExamSession;
}

export async function getPracticalSessionWithTemplate(
  id: string
): Promise<PracticalSessionWithTemplate | null> {
  const { data, error } = await supabase
    .from('practical_exam_sessions')
    .select(`
      *,
      practical_exam_templates (*)
    `)
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  const row = data as PracticalExamSession & {
    practical_exam_templates: PracticalExamTemplate | null;
  };
  const template = row.practical_exam_templates ?? null;
  let class_name: string | undefined;
  if (row.class_id) {
    const { data: c } = await supabase
      .from('classes')
      .select('name')
      .eq('id', row.class_id)
      .single();
    class_name = (c as { name?: string } | null)?.name;
  }
  return {
    ...row,
    template,
    class_name,
  } as PracticalSessionWithTemplate;
}

export interface CreatePracticalSessionInput {
  template_id: string;
  class_id: string;
  start_at: number;
  end_at: number;
  access_code: string;
}

export async function createPracticalSession(
  input: CreatePracticalSessionInput
): Promise<PracticalExamSession> {
  const { data, error } = await supabase
    .from('practical_exam_sessions')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as PracticalExamSession;
}

export interface UpdatePracticalSessionInput {
  class_id?: string;
  start_at?: number;
  end_at?: number;
  access_code?: string;
}

export async function updatePracticalSession(
  id: string,
  input: UpdatePracticalSessionInput
): Promise<PracticalExamSession> {
  const { data, error } = await supabase
    .from('practical_exam_sessions')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PracticalExamSession;
}

export async function deletePracticalSession(id: string): Promise<void> {
  const { error } = await supabase.from('practical_exam_sessions').delete().eq('id', id);
  if (error) throw error;
}

const now = () => Date.now();

/** Các kỳ thi thực hành đang mở mà thí sinh được phép làm (theo lớp). */
export async function getAllowedPracticalSessions(
  studentId?: string | null
): Promise<PracticalSessionWithTemplate[]> {
  const nowTs = now();
  let classIds: string[] = [];
  if (studentId) {
    classIds = await getClassIdsByStudentId(studentId);
    if (classIds.length === 0) return [];
  }

  let q = supabase
    .from('practical_exam_sessions')
    .select(`
      *,
      practical_exam_templates (*)
    `)
    .lte('start_at', nowTs)
    .gte('end_at', nowTs)
    .order('start_at', { ascending: false });

  if (classIds.length > 0) q = q.in('class_id', classIds);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as (PracticalExamSession & {
    practical_exam_templates: PracticalExamTemplate | null;
  })[];
  const needClassNames = [...new Set(rows.map((r) => r.class_id))];
  let classNames: Record<string, string> = {};
  if (needClassNames.length > 0) {
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name')
      .in('id', needClassNames);
    if (classes)
      classNames = Object.fromEntries(
        (classes as { id: string; name: string }[]).map((c) => [c.id, c.name])
      );
  }

  return rows.map((r) => ({
    ...r,
    template: r.practical_exam_templates ?? null,
    class_name: classNames[r.class_id],
  })) as PracticalSessionWithTemplate[];
}
