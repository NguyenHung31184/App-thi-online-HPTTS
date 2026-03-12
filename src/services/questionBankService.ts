import { supabase } from '../lib/supabaseClient';
import type { QuestionBankItem } from '../types';
import type { QuestionType } from '../types';

const BUCKET_QUESTIONS = 'exam-uploads';

export async function listQuestionsByOccupation(occupationId: string, moduleId?: string | null): Promise<QuestionBankItem[]> {
  let query = supabase
    .from('question_bank')
    .select('*')
    .eq('occupation_id', occupationId)
    .order('created_at', { ascending: true });
  if (moduleId) {
    query = query.eq('module_id', moduleId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as QuestionBankItem[];
}

/** Lấy danh sách câu hỏi thuộc nghề nhưng chưa gắn mô-đun (lang thang) — dùng để tìm và xóa. */
export async function listQuestionsWithoutModule(occupationId: string): Promise<QuestionBankItem[]> {
  const { data, error } = await supabase
    .from('question_bank')
    .select('*')
    .eq('occupation_id', occupationId)
    .is('module_id', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as QuestionBankItem[];
}

export async function getQuestionBankItem(id: string): Promise<QuestionBankItem | null> {
  const { data, error } = await supabase
    .from('question_bank')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as QuestionBankItem;
}

export interface CreateQuestionBankInput {
  occupation_id: string;
  module_id?: string | null;
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

export async function createQuestionBankItem(input: CreateQuestionBankInput): Promise<QuestionBankItem> {
  const row = {
    occupation_id: input.occupation_id,
    module_id: input.module_id ?? null,
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
  const { data, error } = await supabase.from('question_bank').insert(row).select().single();
  if (error) throw error;
  return data as QuestionBankItem;
}

export interface UpdateQuestionBankInput {
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
  module_id?: string | null;
}

export async function updateQuestionBankItem(id: string, input: UpdateQuestionBankInput): Promise<QuestionBankItem> {
  const { data, error } = await supabase
    .from('question_bank')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as QuestionBankItem;
}

export async function deleteQuestionBankItem(id: string): Promise<void> {
  const { error } = await supabase.from('question_bank').delete().eq('id', id);
  if (error) throw error;
}

/** Xóa hàng loạt câu hỏi ngân hàng theo danh sách id (dùng cho UI chọn nhiều). */
export async function deleteQuestionBankItemsBulk(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from('question_bank').delete().in('id', ids);
  if (error) throw error;
}

/** Nhập hàng loạt câu hỏi trắc nghiệm 1 đáp án vào ngân hàng theo nghề/mô-đun */
export async function createQuestionBankBulk(
  occupationId: string,
  moduleId: string | null,
  items: Array<{ stem: string; options: { id: string; text: string }[]; answer_key: string; points?: number; topic?: string; difficulty?: string }>
): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const row = {
      occupation_id: occupationId,
      module_id: moduleId,
      question_type: 'single_choice',
      stem: it.stem,
      options: it.options,
      answer_key: it.answer_key,
      points: it.points ?? 2,
      topic: it.topic ?? '',
      difficulty: it.difficulty ?? 'medium',
    };
    const { error } = await supabase.from('question_bank').insert(row);
    if (error) errors.push(`Dòng ${i + 1}: ${error.message}`);
    else created++;
  }
  return { created, errors };
}

/** Upload ảnh câu hỏi ngân hàng (path dùng occupation_id) */
export async function uploadQuestionBankImage(file: File, occupationId: string, questionId?: string): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = questionId
    ? `question-bank/${occupationId}/${questionId}-${Date.now()}.${ext}`
    : `question-bank/${occupationId}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET_QUESTIONS).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from(BUCKET_QUESTIONS).getPublicUrl(data.path);
  return urlData.publicUrl;
}
