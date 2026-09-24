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
// Ids travel in the query string of an `in`/`ov` filter; 200 uuids stay well under URL limits.
const ID_CHUNK = 200;

function chunks<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += ID_CHUNK) result.push(items.slice(index, index + ID_CHUNK));
  return result;
}

/** Returns the number of rows changed. Rows outside the library are left alone. */
export async function setQuestionsStatus(libraryId: string, ids: string[], status: QuestionStatus): Promise<number> {
  let changed = 0;
  for (const part of chunks(ids)) {
    const { data, error } = await supabase
      .from('question_bank')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('library_id', libraryId)
      .eq('is_deleted', false)
      .in('id', part)
      .select('id');
    if (error) throw new Error(error.message);
    changed += (data ?? []).length;
  }
  return changed;
}

/** Soft delete; returns the number of rows deleted. Rows outside the library are left alone. */
export async function softDeleteQuestions(libraryId: string, ids: string[]): Promise<number> {
  let deleted = 0;
  const now = new Date().toISOString();
  for (const part of chunks(ids)) {
    const { data, error } = await supabase
      .from('question_bank')
      .update({ is_deleted: true, deleted_at: now })
      .eq('library_id', libraryId)
      .eq('is_deleted', false)
      .in('id', part)
      .select('id');
    if (error) throw new Error(error.message);
    deleted += (data ?? []).length;
  }
  return deleted;
}

/** The ids among `ids` that some attempt has drawn (attempts.question_ids). */
export async function findQuestionsUsedInAttempts(ids: string[]): Promise<Set<string>> {
  const used = new Set<string>();
  for (const part of chunks(ids)) {
    const wanted = new Set(part);
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('attempts')
        .select('id, question_ids')
        .overlaps('question_ids', part)
        .order('id')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const page = (data ?? []) as Row[];
      for (const row of page) {
        for (const id of Array.isArray(row.question_ids) ? row.question_ids : []) {
          if (wanted.has(String(id))) used.add(String(id));
        }
      }
      if (page.length < PAGE_SIZE) break;
    }
  }
  return used;
}

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
