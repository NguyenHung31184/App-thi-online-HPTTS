import { supabase } from '../lib/supabaseClient';
import type {
  PracticalExamTemplate,
  PracticalExamCriteria,
} from '../types';

export async function listPracticalTemplates(): Promise<PracticalExamTemplate[]> {
  const { data, error } = await supabase
    .from('practical_exam_templates')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PracticalExamTemplate[];
}

export async function getPracticalTemplate(id: string): Promise<PracticalExamTemplate | null> {
  const { data, error } = await supabase
    .from('practical_exam_templates')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as PracticalExamTemplate;
}

export interface CreatePracticalTemplateInput {
  title: string;
  description?: string;
  duration_minutes?: number | null;
  created_by?: string | null;
}

export async function createPracticalTemplate(
  input: CreatePracticalTemplateInput
): Promise<PracticalExamTemplate> {
  const { data, error } = await supabase
    .from('practical_exam_templates')
    .insert({
      title: input.title,
      description: input.description ?? '',
      duration_minutes: input.duration_minutes ?? null,
      created_by: input.created_by ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PracticalExamTemplate;
}

export interface UpdatePracticalTemplateInput {
  title?: string;
  description?: string;
  duration_minutes?: number | null;
}

export async function updatePracticalTemplate(
  id: string,
  input: UpdatePracticalTemplateInput
): Promise<PracticalExamTemplate> {
  const { data, error } = await supabase
    .from('practical_exam_templates')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PracticalExamTemplate;
}

export async function deletePracticalTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('practical_exam_templates').delete().eq('id', id);
  if (error) throw error;
}

// --- Criteria ---

export async function listCriteriaByTemplate(
  templateId: string
): Promise<PracticalExamCriteria[]> {
  const { data, error } = await supabase
    .from('practical_exam_criteria')
    .select('*')
    .eq('template_id', templateId)
    .order('order_index');
  if (error) throw error;
  return (data ?? []) as PracticalExamCriteria[];
}

export interface CreateCriteriaInput {
  template_id: string;
  order_index: number;
  name: string;
  description?: string;
  max_score: number;
  weight?: number;
  score_step?: number | null;
}

export async function createPracticalCriteria(
  input: CreateCriteriaInput
): Promise<PracticalExamCriteria> {
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
    })
    .select()
    .single();
  if (error) throw error;
  return data as PracticalExamCriteria;
}

export interface UpdateCriteriaInput {
  order_index?: number;
  name?: string;
  description?: string;
  max_score?: number;
  weight?: number;
  score_step?: number | null;
}

export async function updatePracticalCriteria(
  id: string,
  input: UpdateCriteriaInput
): Promise<PracticalExamCriteria> {
  const { data, error } = await supabase
    .from('practical_exam_criteria')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as PracticalExamCriteria;
}

export async function deletePracticalCriteria(id: string): Promise<void> {
  const { error } = await supabase.from('practical_exam_criteria').delete().eq('id', id);
  if (error) throw error;
}
