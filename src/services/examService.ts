import { supabase } from '../lib/supabaseClient';
import type { Exam, BlueprintRule } from '../types';

export async function listExams(): Promise<Exam[]> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Exam[];
}

export async function getExam(id: string): Promise<Exam | null> {
  const { data, error } = await supabase.from('exams').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Exam;
}

export interface CreateExamInput {
  title: string;
  description?: string;
  duration_minutes?: number;
  pass_threshold?: number;
  total_questions?: number;
  blueprint?: BlueprintRule[];
  module_id?: string | null;
  created_by?: string;
}

export async function createExam(input: CreateExamInput): Promise<Exam> {
  const row = {
    title: input.title,
    description: input.description ?? '',
    duration_minutes: input.duration_minutes ?? 60,
    pass_threshold: input.pass_threshold ?? 0.7,
    total_questions: input.total_questions ?? 0,
    blueprint: input.blueprint ?? [],
    module_id: input.module_id ?? null,
    created_by: input.created_by ?? null,
  };
  const { data, error } = await supabase.from('exams').insert(row).select().single();
  if (error) throw error;
  return data as Exam;
}

export interface UpdateExamInput {
  title?: string;
  description?: string;
  duration_minutes?: number;
  pass_threshold?: number;
  total_questions?: number;
  blueprint?: BlueprintRule[];
  questions_snapshot_url?: string | null;
  module_id?: string | null;
}

export async function updateExam(id: string, input: UpdateExamInput): Promise<Exam> {
  const { data, error } = await supabase
    .from('exams')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Exam;
}

export async function deleteExam(id: string): Promise<void> {
  const { error } = await supabase.from('exams').delete().eq('id', id);
  if (error) throw error;
}

/** Kiểm định đề: kiểm tra đủ câu theo blueprint, tạo snapshot lưu Storage, cập nhật questions_snapshot_url */
export async function validateExamAndCreateSnapshot(
  examId: string
): Promise<{ valid: true; questions_snapshot_url: string } | { valid: false; message: string }> {
  const exam = await getExam(examId);
  if (!exam) return { valid: false, message: 'Không tìm thấy đề thi.' };

  const { data: questions, error: qError } = await supabase
    .from('questions')
    .select('id, topic, difficulty')
    .eq('exam_id', examId)
    .order('created_at', { ascending: true });
  if (qError) return { valid: false, message: 'Lỗi tải câu hỏi: ' + qError.message };
  const questionList = (questions ?? []) as { id: string; topic: string; difficulty: string }[];

  const blueprint = Array.isArray(exam.blueprint) ? exam.blueprint : ([] as BlueprintRule[]);
  if (blueprint.length === 0 && questionList.length === 0) {
    return { valid: false, message: 'Chưa có ma trận blueprint hoặc chưa có câu hỏi.' };
  }

  const byKey: Record<string, number> = {};
  for (const q of questionList) {
    const key = `${q.topic || ''}|${q.difficulty || ''}`;
    byKey[key] = (byKey[key] ?? 0) + 1;
  }
  for (const rule of blueprint) {
    const key = `${rule.topic}|${rule.difficulty}`;
    const have = byKey[key] ?? 0;
    if (have < rule.count) {
      return {
        valid: false,
        message: `Thiếu câu: chủ đề "${rule.topic}", độ khó "${rule.difficulty}" cần ${rule.count}, hiện có ${have}.`,
      };
    }
  }

  const totalRequired = blueprint.reduce((s, r) => s + r.count, 0);
  if (questionList.length < totalRequired) {
    return { valid: false, message: `Tổng câu theo ma trận: ${totalRequired}, hiện có ${questionList.length} câu.` };
  }

  const snapshot = {
    validated_at: new Date().toISOString(),
    question_ids: questionList.map((q) => q.id),
  };
  const path = `exam-snapshots/${examId}.json`;
  const { error: uploadError } = await supabase.storage
    .from('exam-uploads')
    .upload(path, JSON.stringify(snapshot), { cacheControl: '3600', upsert: true });
  if (uploadError) {
    return { valid: false, message: 'Lưu snapshot thất bại: ' + uploadError.message };
  }
  const { data: urlData } = supabase.storage.from('exam-uploads').getPublicUrl(path);
  const questions_snapshot_url = urlData.publicUrl;

  await updateExam(examId, {
    questions_snapshot_url,
    total_questions: questionList.length,
  });
  return { valid: true, questions_snapshot_url };
}
