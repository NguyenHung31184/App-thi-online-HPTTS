import { supabase } from '../lib/supabaseClient';
import type { Exam, BlueprintRule } from '../types';
import { checkExamBlueprint } from '../modules/question-bank/public';

export async function listExams(): Promise<Exam[]> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Exam[];
}

export async function getExam(id: string): Promise<Exam | null> {
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();
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
    .update({
      ...input,
      module_id: input.module_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Exam;
}

export async function deleteExam(id: string): Promise<void> {
  const { error } = await supabase
    .from('exams')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Kiểm tra ngân hàng câu hỏi của mô-đun đủ câu cho ma trận, theo đúng cách start_exam_attempt bốc đề.
 * Bảng `questions` cũ không phải nguồn bốc đề nên không dùng ở đây. */
async function validateBlueprint(
  examId: string
): Promise<{ valid: true; count: number } | { valid: false; message: string }> {
  const exam = await getExam(examId);
  if (!exam) return { valid: false, message: 'Không tìm thấy đề thi.' };
  const moduleId = exam.module_id ?? '';
  if (!moduleId.trim()) return { valid: false, message: 'Đề chưa gắn mô-đun nên chưa bốc được câu hỏi.' };

  try {
    const coverage = await checkExamBlueprint(moduleId, exam.blueprint);
    if (!coverage.ok) return { valid: false, message: coverage.message };
    return { valid: true, count: coverage.questionsPerAttempt };
  } catch (e) {
    return { valid: false, message: 'Lỗi tải ngân hàng câu hỏi: ' + (e instanceof Error ? e.message : String(e)) };
  }
}

/** Khóa đề thi: xác thực blueprint rồi set locked_at = now().
 * Khi đề bị khóa, câu hỏi không thể thêm/sửa/xóa. */
export async function lockExam(
  examId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const validation = await validateBlueprint(examId);
  if (!validation.valid) return { ok: false, message: validation.message };

  const { error } = await supabase
    .from('exams')
    .update({
      locked_at: new Date().toISOString(),
      total_questions: validation.count,
      questions_snapshot_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', examId);
  if (error) return { ok: false, message: 'Lỗi khóa đề: ' + error.message };
  return { ok: true };
}

/** Mở khóa đề thi để cho phép chỉnh sửa câu hỏi trở lại. */
export async function unlockExam(examId: string): Promise<void> {
  const { error } = await supabase
    .from('exams')
    .update({ locked_at: null, updated_at: new Date().toISOString() })
    .eq('id', examId);
  if (error) throw error;
}

/** @deprecated Dùng lockExam() thay thế.
 * Giữ lại để backward compat với code cũ — sẽ bỏ trong phiên bản tới. */
export async function validateExamAndCreateSnapshot(
  examId: string
): Promise<{ valid: true; questions_snapshot_url: string } | { valid: false; message: string }> {
  const result = await lockExam(examId);
  if (!result.ok) return { valid: false, message: result.message };
  return { valid: true, questions_snapshot_url: '' };
}
