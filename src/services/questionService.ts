import { supabase } from '../lib/supabaseClient';
import type { Question } from '../types';
import type { QuestionBankItem, BlueprintRule } from '../types';
import { getExam } from './examService';

const BUCKET_QUESTIONS = 'exam-uploads';

/** Kiểm tra đề có bị khóa không. Ném lỗi nếu bị khóa. */
async function assertExamNotLocked(examId: string): Promise<void> {
  const { data, error } = await supabase
    .from('exams')
    .select('locked_at')
    .eq('id', examId)
    .single();
  if (error) return; // không chặn nếu không đọc được (permissive)
  if (data?.locked_at) {
    throw new Error('Đề thi đã bị khóa. Mở khóa trước khi chỉnh sửa câu hỏi.');
  }
}

export async function listQuestionsByExam(examId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', examId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Question[];
}

export async function getQuestion(id: string): Promise<Question | null> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as Question;
}

import type { QuestionType } from '../types';

export interface CreateQuestionInput {
  exam_id: string;
  question_type?: QuestionType;
  stem: string;
  options: { id: string; text: string }[];
  answer_key: string;
  points?: number;
  topic?: string;
  difficulty?: string;
  image_url?: string | null;
  media_url?: string | null;
  rubric?: unknown;
}

export async function createQuestion(input: CreateQuestionInput): Promise<Question> {
  await assertExamNotLocked(input.exam_id);
  const row = {
    exam_id: input.exam_id,
    question_type: input.question_type ?? 'single_choice',
    stem: input.stem,
    options: input.options,
    answer_key: input.answer_key,
    points: input.points ?? 2,
    topic: input.topic ?? '',
    difficulty: input.difficulty ?? 'medium',
    image_url: input.image_url ?? null,
    media_url: input.media_url ?? null,
    rubric: input.rubric ?? null,
  };
  const { data, error } = await supabase.from('questions').insert(row).select().single();
  if (error) throw error;
  return data as Question;
}

export interface UpdateQuestionInput {
  question_type?: QuestionType;
  stem?: string;
  options?: { id: string; text: string }[];
  answer_key?: string;
  points?: number;
  topic?: string;
  difficulty?: string;
  image_url?: string | null;
  media_url?: string | null;
  rubric?: unknown;
}

export async function updateQuestion(id: string, input: UpdateQuestionInput): Promise<Question> {
  // Đọc exam_id của câu hỏi để kiểm tra khóa
  const { data: q } = await supabase.from('questions').select('exam_id').eq('id', id).single();
  if (q?.exam_id) await assertExamNotLocked(q.exam_id);

  const { data, error } = await supabase
    .from('questions')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Question;
}

/** Soft-delete một câu hỏi (đánh dấu is_deleted=true thay vì xóa cứng). */
export async function deleteQuestion(id: string): Promise<void> {
  const { data: q } = await supabase.from('questions').select('exam_id').eq('id', id).single();
  if (q?.exam_id) await assertExamNotLocked(q.exam_id);

  const { error } = await supabase
    .from('questions')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** Soft-delete hàng loạt câu hỏi theo danh sách id. */
export async function deleteQuestionsBulk(ids: string[]): Promise<void> {
  if (!ids.length) return;
  // Lấy exam_id của câu đầu để kiểm tra khóa (tất cả cùng đề)
  const { data: sample } = await supabase.from('questions').select('exam_id').eq('id', ids[0]).single();
  if (sample?.exam_id) await assertExamNotLocked(sample.exam_id);

  const { error } = await supabase
    .from('questions')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw error;
}

export interface BulkQuestionItem {
  stem: string;
  options: { id: string; text: string }[];
  answer_key: string;
  points?: number;
  topic?: string;
  difficulty?: string;
  image_url?: string | null;
}

/** Nhập hàng loạt câu hỏi single_choice vào một đề (dùng sau khi parse Excel hoặc ZIP). */
export async function createQuestionsBulk(
  examId: string,
  items: BulkQuestionItem[],
): Promise<{ created: number; errors: string[] }> {
  await assertExamNotLocked(examId);
  const errors: string[] = [];
  let created = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const row = {
      exam_id: examId,
      question_type: 'single_choice',
      stem: it.stem,
      options: it.options,
      answer_key: it.answer_key,
      points: it.points ?? 2,
      topic: it.topic ?? '',
      difficulty: it.difficulty ?? 'medium',
      image_url: it.image_url ?? null,
    };
    const { error } = await supabase.from('questions').insert(row);
    if (error) errors.push(`Dòng ${i + 1}: ${error.message}`);
    else created++;
  }
  return { created, errors };
}

/** Sinh câu hỏi cho đề từ ngân hàng câu hỏi (question_bank) theo module_id + blueprint. */
export async function generateQuestionsFromBankForExam(params: {
  examId: string;
  blueprint: BlueprintRule[];
}): Promise<{ created: number; errors: string[] }> {
  const { examId, blueprint } = params;
  await assertExamNotLocked(examId);
  const errors: string[] = [];
  let created = 0;

  const exam = await getExam(examId);
  const moduleId = exam?.module_id ?? null;
  if (!moduleId) {
    return { created: 0, errors: ['Đề thi chưa gắn mô-đun, không thể sinh câu hỏi từ ngân hàng.'] };
  }

  const { data: bank, error: bankError } = await supabase
    .from('question_bank')
    .select('*')
    .eq('module_id', moduleId)
    .eq('is_deleted', false);
  if (bankError) {
    return { created: 0, errors: ['Lỗi đọc ngân hàng câu hỏi: ' + bankError.message] };
  }
  const bankItems = (bank ?? []) as QuestionBankItem[];
  if (bankItems.length === 0) {
    return { created: 0, errors: ['Ngân hàng câu hỏi cho mô-đun này đang trống.'] };
  }

  const usedIds = new Set<string>();
  type NewQuestionRow = {
    exam_id: string;
    question_type: Question['question_type'];
    stem: string;
    options: { id: string; text: string }[];
    answer_key: string;
    points: number;
    topic: string;
    difficulty: string;
    image_url: string | null;
    media_url: string | null;
    rubric: unknown | null;
  };
  const rowsToInsert: NewQuestionRow[] = [];

  const pickRandom = <T,>(arr: T[], n: number): T[] => {
    if (n >= arr.length) return [...arr];
    const indices = arr.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, n).map((idx) => arr[idx]);
  };

  for (const rule of blueprint) {
    const topic = rule.topic ?? '';
    const difficulty = rule.difficulty ?? '';

    let candidates = bankItems.filter((q) => !usedIds.has(q.id));
    if (topic !== '*') {
      const ruleTopicNorm = topic.trim();
      candidates = candidates.filter((q) => {
        const qTopic = (q.topic ?? '').trim();
        return qTopic === '' || qTopic === ruleTopicNorm;
      });
    }
    if (difficulty !== '*') {
      candidates = candidates.filter((q) => (q.difficulty || '').toLowerCase() === difficulty.toLowerCase());
    }

    if (candidates.length < rule.count) {
      errors.push(
        `Không đủ câu trong ngân hàng cho rule: topic="${topic}", difficulty="${difficulty}", cần ${rule.count}, hiện có ${candidates.length}.`
      );
      continue;
    }

    const picked = pickRandom(candidates, rule.count);
    for (const q of picked) {
      usedIds.add(q.id);
      rowsToInsert.push({
        exam_id: examId,
        question_type: q.question_type,
        stem: q.stem,
        options: (Array.isArray(q.options) ? (q.options as { id: string; text: string }[]) : []) as {
          id: string;
          text: string;
        }[],
        answer_key: q.answer_key,
        points: q.points ?? 2,
        topic: q.topic ?? '',
        difficulty: q.difficulty ?? 'medium',
        image_url: q.image_url ?? null,
        media_url: q.media_url ?? null,
        rubric: q.rubric ?? null,
      });
    }
  }

  if (rowsToInsert.length === 0) {
    return { created: 0, errors: errors.length ? errors : ['Không sinh được câu hỏi nào từ ngân hàng.'] };
  }

  const { error: insertError } = await supabase.from('questions').insert(rowsToInsert);
  if (insertError) {
    errors.push('Lỗi ghi câu hỏi vào đề thi: ' + insertError.message);
    return { created: 0, errors };
  }

  created = rowsToInsert.length;
  return { created, errors };
}

/** Upload ảnh câu hỏi lên Storage, trả về URL public */
export async function uploadQuestionImage(file: File, examId: string, questionId?: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = questionId
    ? `questions/${examId}/${questionId}-${Date.now()}.${ext}`
    : `questions/${examId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET_QUESTIONS).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET_QUESTIONS).getPublicUrl(data.path);
  return urlData.publicUrl;
}
