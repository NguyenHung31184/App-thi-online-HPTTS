import { supabase } from '../../../platform/supabase/client';
import type { ElearningLesson, ElearningLessonBlock, ElearningProgress } from '../../../types';
import type { UpsertProgressInput } from '../domain/legacy-learning';



/** Mô-đun theo danh sách lớp: classes → courses → course_modules → modules. */
export async function getModuleIdsByClassIds(classIds: string[]): Promise<string[]> {
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

export async function getPublishedModuleLessonRows(moduleIds: string[]) {
  if (moduleIds.length === 0) return { modules: [], lessons: [] };

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

  return { modules: (modules ?? []) as { id: string; name: string; code?: string }[], lessons: (lessons ?? []) as ElearningLesson[] };
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

