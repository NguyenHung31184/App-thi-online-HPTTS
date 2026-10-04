import type { PracticalExamSession, PracticalExamTemplate } from '../../../types';

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
