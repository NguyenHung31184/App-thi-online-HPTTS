import { supabase } from '../../../lib/supabaseClient';
import type { QuestionPayload, StoredQuestion } from '../domain/question-draft';
import type { QuestionStatus } from '../domain/question-library';

const QUESTION_BUCKET = 'exam-uploads';
const QUESTION_COLUMNS = 'id, library_id, occupation_id, module_id, question_type, stem, options, answer_key, points, topic, difficulty, status, image_url, media_url, rubric';

type Row = Record<string, unknown>;

export interface EditableQuestion extends StoredQuestion {
  id: string;
  libraryId: string | null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function questionFromRow(row: Row): EditableQuestion {
  const status = row.status;
  return {
    id: String(row.id),
    libraryId: nullableString(row.library_id),
    questionType: String(row.question_type ?? ''),
    stem: typeof row.stem === 'string' ? row.stem : '',
    options: row.options,
    answerKey: typeof row.answer_key === 'string' ? row.answer_key : '',
    points: typeof row.points === 'number' ? row.points : null,
    topic: nullableString(row.topic),
    difficulty: nullableString(row.difficulty),
    status: status === 'draft' || status === 'review' || status === 'retired' ? status as QuestionStatus : 'published',
    imageUrl: nullableString(row.image_url),
    mediaUrl: nullableString(row.media_url),
    rubric: row.rubric,
  };
}

export async function getQuestion(id: string): Promise<EditableQuestion | null> {
  const { data, error } = await supabase
    .from('question_bank')
    .select(QUESTION_COLUMNS)
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? questionFromRow(data as Row) : null;
}

export type NewQuestionRow = QuestionPayload & {
  image_url: string | null;
  library_id: string;
  module_id: string | null;
  occupation_id: string;
  source?: string;
  created_by?: string | null;
};

export async function insertQuestion(input: NewQuestionRow): Promise<string> {
  const { data, error } = await supabase.from('question_bank').insert(input).select('id').single();
  if (error) throw new Error(error.message);
  return String((data as Row).id);
}

/** One request, so either every row is stored or none is. Returns the number of rows stored. */
export async function insertQuestions(rows: NewQuestionRow[]): Promise<number> {
  const { data, error } = await supabase.from('question_bank').insert(rows).select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

const PAGE_SIZE = 1000;

/** Stem and options of every live question in the library, paged past the API's 1000-row cap. */
export async function listLibraryQuestionContent(libraryId: string): Promise<{ stem: string; options: unknown }[]> {
  const result: { stem: string; options: unknown }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('question_bank')
      .select('stem, options')
      .eq('library_id', libraryId)
      .eq('is_deleted', false)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Row[];
    for (const row of page) result.push({ stem: typeof row.stem === 'string' ? row.stem : '', options: row.options });
    if (page.length < PAGE_SIZE) return result;
  }
}

export async function updateQuestion(id: string, input: QuestionPayload & { image_url: string | null }): Promise<void> {
  const { error } = await supabase
    .from('question_bank')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_deleted', false);
  if (error) throw new Error(error.message);
}

/** `nameHint` starts the stored file name, e.g. the question id or "import-3". */
export async function uploadQuestionImage(file: File, libraryId: string, nameHint: string): Promise<string> {
  const extension = file.name.split('.').pop() || 'jpg';
  const path = `question-bank/${libraryId}/${nameHint}-${Date.now()}.${extension}`;
  const { data, error } = await supabase.storage.from(QUESTION_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from(QUESTION_BUCKET).getPublicUrl(data.path).data.publicUrl;
}

/** The course most of the library's published questions carry; used when the library itself has none. */
export async function findDominantCourse(libraryId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('question_bank')
    .select('occupation_id')
    .eq('library_id', libraryId)
    .eq('is_deleted', false)
    .eq('status', 'published');
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Row[]) {
    const course = nullableString(row.occupation_id);
    if (course) counts.set(course, (counts.get(course) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [course, count] of counts) {
    if (!best || count > (counts.get(best) ?? 0)) best = course;
  }
  return best;
}
