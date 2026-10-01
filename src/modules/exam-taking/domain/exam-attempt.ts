import type { Attempt, ExamWindow, QuestionForStudent } from '../../../types';
import type { ProctoringMode } from './proctoring-policy';

export type AvailableTheoryWindow = Omit<ExamWindow, 'access_code'> & {
  exam_title?: string;
  class_name?: string;
};

export interface AttemptWindowContext {
  end_at: number;
  is_trial: boolean;
  class_id: string | null;
}

export interface AiProctoringState {
  mode: ProctoringMode;
  risk_threshold: number;
  risk_score: number;
  incident_count: number;
  should_auto_submit: boolean;
}

export interface RecordAiProctoringIncidentResult extends AiProctoringState {
  accepted: boolean;
}

export type { Attempt, QuestionForStudent };
