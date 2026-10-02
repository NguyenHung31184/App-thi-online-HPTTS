import { supabase } from '../../../platform/supabase/client';
import type { Exam } from '../../../types';
import type { UpdateExamInput, examRowFromInput } from '../domain/exam-inputs';

export async function selectExams(): Promise<Exam[]> {
  const { data, error } = await supabase.from('exams').select('*').eq('is_deleted', false).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Exam[];
}

export async function selectExam(id: string): Promise<Exam | null> {
  const { data, error } = await supabase.from('exams').select('*').eq('id', id).eq('is_deleted', false).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Exam;
}

export async function insertExam(row: ReturnType<typeof examRowFromInput>): Promise<Exam> {
  const { data, error } = await supabase.from('exams').insert(row).select().single();
  if (error) throw error;
  return data as Exam;
}

export async function updateExamRow(id: string, input: UpdateExamInput): Promise<Exam> {
  const { data, error } = await supabase
    .from('exams')
    .update({ ...input, module_id: input.module_id ?? null, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Exam;
}

export async function softDeleteExam(id: string): Promise<void> {
  const { error } = await supabase.from('exams').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

/** Locks the exam with the number of questions one attempt draws; returns the error message if the update fails. */
export async function setExamLocked(id: string, questionsPerAttempt: number): Promise<string | null> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('exams')
    .update({ locked_at: now, total_questions: questionsPerAttempt, questions_snapshot_url: null, updated_at: now })
    .eq('id', id);
  return error ? error.message : null;
}

export async function clearExamLock(id: string): Promise<void> {
  const { error } = await supabase.from('exams').update({ locked_at: null, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}
