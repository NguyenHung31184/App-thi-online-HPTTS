import { supabase } from '../../../platform/supabase/client';
import type { PracticalExamCriteria, PracticalExamTemplate } from '../../../types';
import type { CreateCriteriaInput, CreatePracticalTemplateInput, UpdateCriteriaInput, UpdatePracticalTemplateInput } from '../domain/inputs';

export async function selectTemplates(): Promise<PracticalExamTemplate[]> {
  const { data, error } = await supabase.from('practical_exam_templates').select('*').eq('is_deleted', false).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PracticalExamTemplate[];
}

export async function selectTemplate(id: string): Promise<PracticalExamTemplate | null> {
  const { data, error } = await supabase.from('practical_exam_templates').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as PracticalExamTemplate;
}

export async function insertTemplate(input: CreatePracticalTemplateInput): Promise<PracticalExamTemplate> {
  const { data, error } = await supabase
    .from('practical_exam_templates')
    .insert({
      title: input.title,
      description: input.description ?? '',
      duration_minutes: input.duration_minutes ?? null,
      module_id: input.module_id ?? null,
      pass_score: input.pass_score ?? 70,
      config: input.config ?? {},
      created_by: input.created_by ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PracticalExamTemplate;
}

export async function updateTemplateRow(id: string, input: UpdatePracticalTemplateInput): Promise<PracticalExamTemplate> {
  const { data, error } = await supabase
    .from('practical_exam_templates')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PracticalExamTemplate;
}

/** Soft delete: the template leaves the lists; sessions and attempts that used it keep their rows. */
export async function deleteTemplateRow(id: string): Promise<void> {
  const { error } = await supabase.from('practical_exam_templates').update({ is_deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function selectCriteria(templateId: string): Promise<PracticalExamCriteria[]> {
  const { data, error } = await supabase.from('practical_exam_criteria').select('*').eq('template_id', templateId).eq('is_deleted', false).order('order_index');
  if (error) throw error;
  return (data ?? []) as PracticalExamCriteria[];
}

export async function insertCriteria(input: CreateCriteriaInput): Promise<PracticalExamCriteria> {
  const { data, error } = await supabase
    .from('practical_exam_criteria')
    .insert({
      template_id: input.template_id,
      order_index: input.order_index,
      name: input.name,
      description: input.description ?? '',
      max_score: input.max_score,
      weight: input.weight ?? 1,
      score_step: input.score_step ?? 1,
      step_key: input.step_key ?? null,
      kind: input.kind ?? 'score',
      deductions: input.deductions ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  return data as PracticalExamCriteria;
}

export async function updateCriteriaRow(id: string, input: UpdateCriteriaInput): Promise<PracticalExamCriteria> {
  const { data, error } = await supabase.from('practical_exam_criteria').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as PracticalExamCriteria;
}

/** Soft delete: scores already given against the criterion keep their row. */
export async function deleteCriteriaRow(id: string): Promise<void> {
  const { error } = await supabase.from('practical_exam_criteria').update({ is_deleted: true }).eq('id', id);
  if (error) throw error;
}
