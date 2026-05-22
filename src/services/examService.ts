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
  const { error } = await supabase.from('exams').delete().eq('id', id);
  if (error) throw error;
}

/** Xác thực blueprint đề thi so với danh sách câu hỏi hiện tại.
 * Trả về lỗi nếu thiếu câu theo blueprint; null nếu hợp lệ. */
async function validateBlueprint(
  examId: string
): Promise<{ valid: true; questionIds: string[]; count: number } | { valid: false; message: string }> {
  const exam = await getExam(examId);
  if (!exam) return { valid: false, message: 'Không tìm thấy đề thi.' };

  const { data: questions, error: qError } = await supabase
    .from('questions')
    .select('id, topic, difficulty')
    .eq('exam_id', examId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });
  if (qError) return { valid: false, message: 'Lỗi tải câu hỏi: ' + qError.message };

  const questionList = (questions ?? []) as { id: string; topic: string; difficulty: string }[];
  const blueprint = Array.isArray(exam.blueprint) ? (exam.blueprint as BlueprintRule[]) : [];

  if (blueprint.length === 0 && questionList.length === 0) {
    return { valid: false, message: 'Chưa có ma trận blueprint hoặc chưa có câu hỏi.' };
  }

  if (blueprint.length > 0) {
    const byTopicDifficulty: Record<string, number> = {};
    const byDifficulty: Record<string, number> = {};
    const total = questionList.length;
    for (const q of questionList) {
      const topic = q.topic || '';
      const difficulty = q.difficulty || '';
      byTopicDifficulty[`${topic}|${difficulty}`] = (byTopicDifficulty[`${topic}|${difficulty}`] ?? 0) + 1;
      byDifficulty[difficulty] = (byDifficulty[difficulty] ?? 0) + 1;
    }

    for (const rule of blueprint) {
      const topic = rule.topic ?? '';
      const difficulty = rule.difficulty ?? '';
      const have =
        topic === '*' && difficulty === '*'
          ? total
          : topic === '*'
            ? (byDifficulty[difficulty] ?? 0)
            : difficulty === '*'
              ? questionList.filter((q) => (q.topic || '') === topic).length
              : (byTopicDifficulty[`${topic}|${difficulty}`] ?? 0);

      if (have < rule.count) {
        const topicLabel = topic === '*' ? 'tất cả chủ đề' : `chủ đề "${topic}"`;
        const diffLabel = difficulty === '*' ? 'mọi độ khó' : `độ khó "${difficulty}"`;
        return {
          valid: false,
          message: `Thiếu câu: ${topicLabel}, ${diffLabel} cần ${rule.count}, hiện có ${have}.`,
        };
      }
    }

    const totalRequired = blueprint.reduce((s, r) => s + r.count, 0);
    if (questionList.length < totalRequired) {
      return {
        valid: false,
        message: `Ma trận yêu cầu ${totalRequired} câu, hiện chỉ có ${questionList.length} câu.`,
      };
    }
  }

  return { valid: true, questionIds: questionList.map((q) => q.id), count: questionList.length };
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
