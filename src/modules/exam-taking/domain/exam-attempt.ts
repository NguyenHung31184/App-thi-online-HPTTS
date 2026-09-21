import type { Attempt, ExamWindow, QuestionForStudent } from '../../../types';

export type AvailableTheoryWindow = Omit<ExamWindow, 'access_code'> & {
  exam_title?: string;
  class_name?: string;
};

export interface AttemptWindowContext {
  end_at: number;
  is_trial: boolean;
  class_id: string | null;
}

export type { Attempt, QuestionForStudent };
