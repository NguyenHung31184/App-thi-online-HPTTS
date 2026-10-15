import { supabase } from '../../../platform/supabase/client';
import type {
  BlockFields, ClassAssignment, LearningClass, LessonBlockRow, LessonRow, LessonVersion, ProgressMark,
} from '../domain/lesson-authoring';
import { GRADABLE_QUESTION_TYPES, isGradable, type BankQuestionOption, type QuizItemRow } from '../domain/quiz';

// The e-learning tables are created by the management app's migrations; this app only reads and writes them.

const LESSON_COLUMNS = 'id, module_id, title, description, order_index, is_published, created_at, updated_at';
const BLOCK_COLUMNS =
  'id, lesson_id, block_type, title, content_url, storage_provider, body_richtext, duration_seconds, quiz_pass_percent, quiz_max_attempts, order_index';
const VERSION_COLUMNS = 'id, lesson_id, version, module_id, title, description, blocks, published_at';
const ASSIGNMENT_COLUMNS =
  'id, class_id, lesson_id, lesson_version_id, order_index, required, enforce_sequence, opens_at, due_at, created_at';

const now = () => new Date().toISOString();

export async function selectLessons(moduleId: string): Promise<LessonRow[]> {
  const { data, error } = await supabase.from('elearning_lessons').select(LESSON_COLUMNS)
    .eq('module_id', moduleId).eq('is_deleted', false).order('order_index').order('created_at');
  if (error) throw error;
  return (data ?? []) as LessonRow[];
}

export async function selectLesson(lessonId: string): Promise<LessonRow | null> {
  const { data, error } = await supabase.from('elearning_lessons').select(LESSON_COLUMNS)
    .eq('id', lessonId).eq('is_deleted', false).maybeSingle();
  if (error) throw error;
  return (data as LessonRow | null) ?? null;
}

export async function insertLesson(input: Pick<LessonRow, 'module_id' | 'title' | 'description' | 'order_index'>): Promise<LessonRow> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase.from('elearning_lessons')
    .insert({ ...input, created_by: auth.user?.id ?? null }).select(LESSON_COLUMNS).single();
  if (error) throw error;
  return data as LessonRow;
}

export async function updateLessonRow(
  lessonId: string,
  changes: Partial<Pick<LessonRow, 'title' | 'description' | 'order_index'>> & { is_deleted?: boolean },
): Promise<void> {
  const { error } = await supabase.from('elearning_lessons').update({ ...changes, updated_at: now() }).eq('id', lessonId);
  if (error) throw error;
}

export async function selectBlocks(lessonId: string): Promise<LessonBlockRow[]> {
  const { data, error } = await supabase.from('elearning_lesson_blocks').select(BLOCK_COLUMNS)
    .eq('lesson_id', lessonId).eq('is_deleted', false).order('order_index').order('created_at');
  if (error) throw error;
  return (data ?? []) as LessonBlockRow[];
}

/** Number of live blocks per lesson. */
export async function selectBlockCounts(lessonIds: string[]): Promise<Record<string, number>> {
  if (lessonIds.length === 0) return {};
  const { data, error } = await supabase.from('elearning_lesson_blocks').select('lesson_id')
    .in('lesson_id', lessonIds).eq('is_deleted', false);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { lesson_id: string }[]) counts[row.lesson_id] = (counts[row.lesson_id] ?? 0) + 1;
  return counts;
}

export async function insertBlock(lessonId: string, fields: BlockFields, orderIndex: number): Promise<void> {
  const { error } = await supabase.from('elearning_lesson_blocks').insert({ ...fields, lesson_id: lessonId, order_index: orderIndex });
  if (error) throw error;
}

export async function updateBlockRow(
  blockId: string,
  changes: Partial<BlockFields> & { order_index?: number; is_deleted?: boolean },
): Promise<void> {
  const { error } = await supabase.from('elearning_lesson_blocks').update({ ...changes, updated_at: now() }).eq('id', blockId);
  if (error) throw error;
}

export async function selectVersions(lessonId: string): Promise<LessonVersion[]> {
  const { data, error } = await supabase.from('elearning_lesson_versions').select(VERSION_COLUMNS)
    .eq('lesson_id', lessonId).order('version', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LessonVersion[];
}

/** Newest published version number per lesson. */
export async function selectLatestVersionNumbers(lessonIds: string[]): Promise<Record<string, number>> {
  if (lessonIds.length === 0) return {};
  const { data, error } = await supabase.from('elearning_lesson_versions').select('lesson_id, version').in('lesson_id', lessonIds);
  if (error) throw error;
  const latest: Record<string, number> = {};
  for (const row of (data ?? []) as { lesson_id: string; version: number }[]) {
    latest[row.lesson_id] = Math.max(latest[row.lesson_id] ?? 0, row.version);
  }
  return latest;
}

export async function publishLesson(lessonId: string): Promise<string> {
  const { data, error } = await supabase.rpc('elearning_publish_lesson', { p_lesson_id: lessonId });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Không nhận được phiên bản sau khi xuất bản.');
  return data;
}

/** Assignments still in force (not withdrawn) for the given lessons. */
export async function selectActiveAssignments(lessonIds: string[]): Promise<ClassAssignment[]> {
  if (lessonIds.length === 0) return [];
  const { data, error } = await supabase.from('elearning_class_assignments').select(ASSIGNMENT_COLUMNS)
    .in('lesson_id', lessonIds).eq('is_archived', false).order('created_at');
  if (error) throw error;
  return (data ?? []) as ClassAssignment[];
}

export interface AssignLessonInput {
  classId: string;
  versionId: string;
  orderIndex: number;
  required: boolean;
  enforceSequence: boolean;
  opensAt: string | null;
  dueAt: string | null;
}

/** Assigns a published version to a class; an earlier assignment of the same lesson to that class is withdrawn. */
export async function assignLesson(input: AssignLessonInput): Promise<string> {
  const { data, error } = await supabase.rpc('elearning_assign_lesson', {
    p_class_id: input.classId, p_version_id: input.versionId, p_order_index: input.orderIndex,
    p_required: input.required, p_enforce_sequence: input.enforceSequence,
    p_opens_at: input.opensAt, p_due_at: input.dueAt,
  });
  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Không nhận được bản giao bài sau khi lưu.');
  return data;
}

export async function withdrawAssignment(assignmentId: string): Promise<void> {
  const { error } = await supabase.rpc('elearning_archive_assignment', { p_assignment_id: assignmentId });
  if (error) throw error;
}

/** Classes whose course contains the module: the only classes the module's lessons can be assigned to. */
export async function selectClassesForModule(moduleId: string): Promise<LearningClass[]> {
  const { data: links, error: linkError } = await supabase.from('course_modules').select('course_id')
    .eq('module_id', moduleId).eq('is_deleted', false);
  if (linkError) throw linkError;
  const courseIds = [...new Set(((links ?? []) as { course_id: string }[]).map((link) => link.course_id))];
  if (courseIds.length === 0) return [];
  const { data, error } = await supabase.from('classes').select('id, name, code')
    .in('course_id', courseIds).eq('is_deleted', false).order('name');
  if (error) throw error;
  return ((data ?? []) as { id: string; name: string | null; code: string | null }[])
    .map((row) => ({ id: String(row.id), name: row.name ?? String(row.id), code: row.code ?? null }));
}

/** Number of enrolled learners per class. */
export async function selectClassSizes(classIds: string[]): Promise<Record<string, number>> {
  if (classIds.length === 0) return {};
  const { data, error } = await supabase.from('enrollments').select('class_id').in('class_id', classIds).eq('is_deleted', false);
  if (error) throw error;
  const sizes: Record<string, number> = {};
  for (const row of (data ?? []) as { class_id: string }[]) sizes[row.class_id] = (sizes[row.class_id] ?? 0) + 1;
  return sizes;
}

/** Progress marks of the given assignments, read in pages of 1000. */
export async function selectAssignmentMarks(assignmentIds: string[]): Promise<(ProgressMark & { assignment_id: string })[]> {
  if (assignmentIds.length === 0) return [];
  const marks: (ProgressMark & { assignment_id: string })[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('elearning_enrollment_progress')
      .select('assignment_id, enrollment_id, block_id, status').in('assignment_id', assignmentIds).order('id').range(from, from + 999);
    if (error) throw error;
    marks.push(...((data ?? []) as (ProgressMark & { assignment_id: string })[]));
    if ((data?.length ?? 0) < 1000) return marks;
  }
}

/** Câu đã chọn vào các khối quiz, kèm nội dung câu để người soạn nhận ra. */
export async function selectQuizItems(blockIds: string[]): Promise<QuizItemRow[]> {
  if (blockIds.length === 0) return [];
  const { data, error } = await supabase.from('elearning_quiz_items')
    .select('id, block_id, question_bank_id, order_index, question_bank(stem, question_type, is_deleted)')
    .in('block_id', blockIds).eq('is_deleted', false).order('order_index').order('created_at');
  if (error) throw error;
  type Row = { id: string; block_id: string; question_bank_id: string; order_index: number;
    question_bank: { stem: string | null; question_type: string; is_deleted: boolean | null } | { stem: string | null; question_type: string; is_deleted: boolean | null }[] | null };
  return ((data ?? []) as unknown as Row[]).map((row) => {
    const question = Array.isArray(row.question_bank) ? row.question_bank[0] ?? null : row.question_bank;
    return {
      id: row.id, block_id: row.block_id, question_id: row.question_bank_id, order_index: row.order_index,
      stem: question?.stem ?? '', question_type: question?.question_type ?? '',
      unusable: !question || Boolean(question.is_deleted) || !isGradable(question.question_type),
    };
  });
}

/** Câu đã duyệt của mô-đun, thuộc ba dạng chấm tự động; lọc theo chữ trong đề nếu có. */
export async function searchBankQuestions(moduleId: string, text: string): Promise<BankQuestionOption[]> {
  let query = supabase.from('question_bank').select('id, stem, question_type, topic, difficulty')
    .eq('module_id', moduleId).eq('is_deleted', false).eq('status', 'published')
    .in('question_type', [...GRADABLE_QUESTION_TYPES]).order('created_at', { ascending: false }).limit(30);
  const needle = text.trim();
  if (needle) query = query.ilike('stem', `%${needle.replace(/[%_]/g, (match) => `\\${match}`)}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BankQuestionOption[];
}

export async function insertQuizItem(blockId: string, questionId: string, orderIndex: number): Promise<void> {
  const { error } = await supabase.from('elearning_quiz_items').insert({ block_id: blockId, question_bank_id: questionId, order_index: orderIndex });
  if (error) throw error;
}

export async function removeQuizItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('elearning_quiz_items').update({ is_deleted: true }).eq('id', itemId);
  if (error) throw error;
}
