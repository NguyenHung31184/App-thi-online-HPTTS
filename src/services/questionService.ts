import { supabase } from '../lib/supabaseClient';
import type { Question } from '../types';

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
