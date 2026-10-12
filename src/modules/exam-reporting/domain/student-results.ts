import type { Attempt } from '../../../types';

export interface AttemptWithExam extends Attempt {
  exams?: { title: string; duration_minutes: number; pass_threshold: number } | null;
}
