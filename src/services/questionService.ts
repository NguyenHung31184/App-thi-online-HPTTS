import { supabase } from '../lib/supabaseClient';
import type { Question } from '../types';
import type { QuestionBankItem, BlueprintRule } from '../types';
import { getExam } from './examService';

const BUCKET_QUESTIONS = 'exam-uploads';

export async function listQuestionsByExam(examId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', examId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Question[];
}

export async function getQuestion(id: string): Promise<Question | null> {
  const { data, error } = await supabase.from('questions').select('*').eq('id', id).single();
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
  const row = {
    exam_id: input.exam_id,
    question_type: input.question_type ?? 'single_choice',
    stem: input.stem,
    options: input.options,
    answer_key: input.answer_key,
    points: input.points ?? 1,
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
  const { data, error } = await supabase
    .from('questions')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Question;
}

export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) throw error;
}

/** Xóa hàng loạt câu hỏi trong đề thi theo danh sách id. */
export async function deleteQuestionsBulk(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from('questions').delete().in('id', ids);
  if (error) throw error;
}

/** Nhập hàng loạt câu hỏi single_choice vào một đề (dùng sau khi parse Excel). */
export async function createQuestionsBulk(
  examId: string,
  items: Array<{ stem: string; options: { id: string; text: string }[]; answer_key: string; points?: number; topic?: string; difficulty?: string }>
): Promise<{ created: number; errors: string[] }> {
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
      points: it.points ?? 1,
      topic: it.topic ?? '',
      difficulty: it.difficulty ?? 'medium',
    };
    const { error } = await supabase.from('questions').insert(row);
    if (error) errors.push(`Dòng ${i + 1}: ${error.message}`);
    else created++;
  }
  return { created, errors };
}

/** Sinh câu hỏi cho một đề thi từ ngân hàng câu hỏi (question_bank) theo module_id + blueprint.
 * - examId: đề thi cần sinh câu hỏi
 * - blueprint: ma trận đề (topic, difficulty, count). Nếu không truyền sẽ dùng blueprint của exam.
 * - moduleId: mô-đun (ưu tiên truyền vào; nếu không, lấy từ exam.module_id)
 *
 * Chiến lược đơn giản:
 * - Với mỗi rule trong blueprint:
 *   - Lọc câu hỏi ngân hàng theo module_id, topic, difficulty
 *   - Lấy ngẫu nhiên đủ "count" câu (không trùng giữa các rule)
 * - Copy sang bảng questions (exam_id = examId), giữ nguyên stem/options/answer_key/points/topic/difficulty/image_url/media_url/rubric
 */
export async function generateQuestionsFromBankForExam(params: {
  examId: string;
  blueprint: BlueprintRule[];
}): Promise<{ created: number; errors: string[] }> {
  const { examId, blueprint } = params;
  const errors: string[] = [];
  let created = 0;

  const exam = await getExam(examId);
  const moduleId = exam?.module_id ?? null;
  if (!moduleId) {
    return { created: 0, errors: ['Đề thi chưa gắn mô-đun, không thể sinh câu hỏi từ ngân hàng.'] };
  }

  // Lấy toàn bộ câu hỏi ngân hàng theo module
  const { data: bank, error: bankError } = await supabase
    .from('question_bank')
    .select('*')
    .eq('module_id', moduleId);
  if (bankError) {
    return { created: 0, errors: ['Lỗi đọc ngân hàng câu hỏi: ' + bankError.message] };
  }
  const bankItems = (bank ?? []) as QuestionBankItem[];
  if (bankItems.length === 0) {
    return { created: 0, errors: ['Ngân hàng câu hỏi cho mô-đun này đang trống.'] };
  }

  // Tập id câu hỏi đã dùng để tránh trùng lặp giữa các rule
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

  // Hàm chọn ngẫu nhiên n phần tử từ mảng (không lặp)
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
      // Câu có chủ đề trống (—) coi như khớp mọi chủ đề trong ma trận; nếu có chủ đề thì phải khớp exact.
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
        points: q.points ?? 1,
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
