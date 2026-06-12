import { supabase } from '../lib/supabaseClient';
import type { ElearningLesson, ElearningLessonBlock, ElearningProgress } from '../types';
import { getClassIdsByStudentId } from './ttdtDataService';

export interface ModuleWithLessons {
  module_id: string;
  module_name: string;
  module_code?: string;
  lessons: ElearningLesson[];
}

/** Mô-đun theo danh sách lớp: classes → courses → course_modules → modules. */
async function getModuleIdsByClassIds(classIds: string[]): Promise<string[]> {
  if (classIds.length === 0) return [];

  const { data: classes, error: clsErr } = await supabase
    .from('classes')
    .select('course_id')
    .in('id', classIds);
  if (clsErr) throw clsErr;
  const courseIds = [...new Set((classes ?? []).map((c: { course_id: string }) => c.course_id).filter(Boolean))];
  if (courseIds.length === 0) return [];

  const { data: cms, error: cmErr } = await supabase
    .from('course_modules')
    .select('module_id')
    .in('course_id', courseIds);
  if (cmErr) throw cmErr;
  return [...new Set((cms ?? []).map((r: { module_id: string }) => r.module_id).filter(Boolean))];
}

/** Bài học đã xuất bản theo lớp bất kỳ — dùng cho chế độ xem trước của admin/GV. */
export async function getModulesWithLessonsByClassIds(classIds: string[]): Promise<ModuleWithLessons[]> {
  const moduleIds = await getModuleIdsByClassIds(classIds);
  return getModulesWithLessonsByModuleIds(moduleIds);
}

/** Bài học đã xuất bản, gom theo mô-đun của học viên (RLS chỉ trả bài is_published). */
export async function getMyModulesWithLessons(studentId: string): Promise<ModuleWithLessons[]> {
  const classIds = await getClassIdsByStudentId(studentId);
  const moduleIds = await getModuleIdsByClassIds(classIds);
  return getModulesWithLessonsByModuleIds(moduleIds);
}

async function getModulesWithLessonsByModuleIds(moduleIds: string[]): Promise<ModuleWithLessons[]> {
  if (moduleIds.length === 0) return [];

  const [{ data: modules, error: modErr }, { data: lessons, error: lesErr }] = await Promise.all([
    supabase.from('modules').select('id, name, code').in('id', moduleIds),
    supabase
      .from('elearning_lessons')
      .select('id, module_id, title, description, order_index, is_published')
      .in('module_id', moduleIds)
      .eq('is_deleted', false)
      .eq('is_published', true)
      .order('order_index')
      .order('created_at'),
  ]);
  if (modErr) throw modErr;
  if (lesErr) throw lesErr;

  const lessonRows = (lessons ?? []) as ElearningLesson[];
  return ((modules ?? []) as { id: string; name: string; code?: string }[])
    .map((m) => ({
      module_id: m.id,
      module_name: m.name,
      module_code: m.code,
      lessons: lessonRows.filter((l) => l.module_id === m.id),
    }))
    .filter((m) => m.lessons.length > 0)
    .sort((a, b) => a.module_name.localeCompare(b.module_name));
}

export async function getLesson(lessonId: string): Promise<ElearningLesson | null> {
  const { data, error } = await supabase
    .from('elearning_lessons')
    .select('id, module_id, title, description, order_index, is_published')
    .eq('id', lessonId)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as ElearningLesson;
}

export async function getLessonBlocks(lessonId: string): Promise<ElearningLessonBlock[]> {
  const { data, error } = await supabase
    .from('elearning_lesson_blocks')
    .select('id, lesson_id, block_type, title, content_url, storage_provider, body_richtext, duration_seconds, quiz_pass_percent, order_index')
    .eq('lesson_id', lessonId)
    .eq('is_deleted', false)
    .order('order_index')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as ElearningLessonBlock[];
}

/** Meta khối (id + lesson_id) cho nhiều bài — tính % hoàn thành ở trang danh sách. */
export async function getBlocksMeta(lessonIds: string[]): Promise<Pick<ElearningLessonBlock, 'id' | 'lesson_id'>[]> {
  if (lessonIds.length === 0) return [];
  const { data, error } = await supabase
    .from('elearning_lesson_blocks')
    .select('id, lesson_id')
    .in('lesson_id', lessonIds)
    .eq('is_deleted', false);
  if (error) throw error;
  return (data ?? []) as Pick<ElearningLessonBlock, 'id' | 'lesson_id'>[];
}

/** Tiến độ của chính học viên (RLS: user_id = auth.uid()). */
export async function getMyProgress(lessonIds?: string[]): Promise<ElearningProgress[]> {
  let q = supabase
    .from('elearning_progress')
    .select('id, user_id, student_id, lesson_id, block_id, status, watched_seconds, quiz_score, quiz_attempts, completed_at');
  if (lessonIds && lessonIds.length > 0) q = q.in('lesson_id', lessonIds);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ElearningProgress[];
}

export interface UpsertProgressInput {
  userId: string;
  studentId?: string | null;
  lessonId: string;
  blockId: string;
  watchedSeconds?: number;
  completed?: boolean;
}

/** Ghi tiến độ 1 khối nội dung — upsert theo (user_id, block_id). */
export async function upsertBlockProgress(input: UpsertProgressInput): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: input.userId,
    student_id: input.studentId ?? null,
    lesson_id: input.lessonId,
    block_id: input.blockId,
    updated_at: new Date().toISOString(),
  };
  if (input.watchedSeconds !== undefined) row.watched_seconds = Math.floor(input.watchedSeconds);
  if (input.completed) {
    row.status = 'completed';
    row.completed_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from('elearning_progress')
    .upsert(row, { onConflict: 'user_id,block_id' });
  if (error) throw error;
}

/**
 * Ghi vét tiến độ lúc đóng tab / chuyển trang (pagehide) — supabase-js không hỗ trợ
 * keepalive nên gọi thẳng REST PostgREST với fetch keepalive (best-effort, không await).
 * Upsert theo (user_id, block_id); chỉ gửi watched_seconds — không đụng status/quiz.
 */
export function flushProgressKeepalive(accessToken: string, input: UpsertProgressInput): void {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!url || !anonKey || !accessToken) return;
  try {
    void fetch(`${url}/rest/v1/elearning_progress?on_conflict=user_id,block_id`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([
        {
          user_id: input.userId,
          student_id: input.studentId ?? null,
          lesson_id: input.lessonId,
          block_id: input.blockId,
          watched_seconds: Math.floor(input.watchedSeconds ?? 0),
          updated_at: new Date().toISOString(),
        },
      ]),
    });
  } catch {
    /* best-effort — trang đang đóng */
  }
}

/** Bài học hoàn thành khi mọi khối của nó đã completed. */
export function isLessonCompleted(lessonId: string, blocks: ElearningLessonBlock[], progress: ElearningProgress[]): boolean {
  const lessonBlocks = blocks.filter((b) => b.lesson_id === lessonId);
  if (lessonBlocks.length === 0) return false;
  const done = new Set(progress.filter((p) => p.status === 'completed').map((p) => p.block_id));
  return lessonBlocks.every((b) => done.has(b.id));
}

/** % hoàn thành của một bài học (theo số khối completed). */
export function lessonPercent(lessonId: string, blockCount: number, progress: ElearningProgress[]): number {
  if (blockCount === 0) return 0;
  const done = progress.filter((p) => p.lesson_id === lessonId && p.status === 'completed').length;
  return Math.round((done / blockCount) * 100);
}
