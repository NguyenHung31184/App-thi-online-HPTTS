import { describe, expect, it } from 'vitest';
import { isLessonDone, lessonCompletionStats } from './legacy-learning';

describe('legacy lesson sequencing', () => {
  it('requires all actual blocks, excludes stale progress and does not complete an empty lesson', () => {
    const blocks = [{ id: 'a', lesson_id: 'first' }, { id: 'b', lesson_id: 'first' }, { id: 'c', lesson_id: 'next' }];
    const partial = lessonCompletionStats(blocks, [
      { block_id: 'a', status: 'completed' }, { block_id: 'old-deleted-block', status: 'completed' },
      { block_id: 'b', status: 'in_progress' },
    ]);
    expect(isLessonDone('first', partial)).toBe(false);
    expect(isLessonDone('next', partial)).toBe(false);
    expect(isLessonDone('empty', partial)).toBe(false);
    expect(isLessonDone('first', lessonCompletionStats(blocks, [
      { block_id: 'a', status: 'completed' }, { block_id: 'b', status: 'completed' },
      { block_id: 'b', status: 'completed' },
    ]))).toBe(true);
  });
});
