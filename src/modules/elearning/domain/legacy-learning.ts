import type { ElearningLesson, ElearningLessonBlock, ElearningProgress } from '../../../types';

export interface ModuleWithLessons {
  module_id: string;
  module_name: string;
  module_code?: string;
  lessons: ElearningLesson[];
}

export interface UpsertProgressInput {
  userId: string;
  studentId?: string | null;
  lessonId: string;
  blockId: string;
  watchedSeconds?: number;
  completed?: boolean;
}

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

export function lessonCompletionStats(
  blocks: Pick<ElearningLessonBlock, 'id' | 'lesson_id'>[], progress: Pick<ElearningProgress, 'block_id' | 'status'>[],
) {
  const total: Record<string, number> = {};
  const done: Record<string, number> = {};
  const completed = new Set(progress.filter((row) => row.status === 'completed').map((row) => row.block_id));
  for (const block of blocks) {
    total[block.lesson_id] = (total[block.lesson_id] ?? 0) + 1;
    if (completed.has(block.id)) done[block.lesson_id] = (done[block.lesson_id] ?? 0) + 1;
  }
  return { total, done };
}

export function isLessonDone(lessonId: string, stats: ReturnType<typeof lessonCompletionStats>): boolean {
  const total = stats.total[lessonId] ?? 0;
  return total > 0 && (stats.done[lessonId] ?? 0) >= total;
}
