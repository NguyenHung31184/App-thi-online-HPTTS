import type { PracticalAttempt, PracticalExamSession, PracticalExamTemplate } from '../../../types';

export interface PracticalSessionWithTemplate extends PracticalExamSession {
  template?: PracticalExamTemplate | null;
  class_name?: string;
}

export function sessionTimeError(startAt: number, endAt: number): string | null {
  return endAt <= startAt ? 'Thời gian kết thúc phải sau thời gian bắt đầu.' : null;
}

/** Empty input means no time limit. */
export function durationFromInput(value: string): number | null {
  return value === '' ? null : Number(value);
}

/** Why the student cannot work on this attempt any more, or null when they can. */
export function studentAttemptBlocker(attempt: Pick<PracticalAttempt, 'user_id' | 'status'> | null, userId: string): string | null {
  if (!attempt) return 'Không tìm thấy bài làm.';
  if (attempt.user_id !== userId) return 'Bạn không có quyền làm bài này.';
  if (attempt.status === 'submitted' || attempt.status === 'graded') return 'Bài làm đã nộp.';
  return null;
}

/** "Template title — 02/10/2026", or the first 8 characters of the id while the title is unknown. */
export function sessionOptionLabel(session: Pick<PracticalExamSession, 'id' | 'start_at'>, title: string | undefined): string {
  return `${title ?? session.id.slice(0, 8)} — ${new Date(session.start_at).toLocaleDateString('vi-VN')}`;
}
