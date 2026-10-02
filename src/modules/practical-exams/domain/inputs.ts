import type { PracticalCriterionKind, PracticalSessionMode } from '../../../types';

export interface CreatePracticalTemplateInput {
  title: string;
  description?: string;
  duration_minutes?: number | null;
  module_id?: string | null;
  pass_score?: number;
  config?: Record<string, unknown>;
  created_by?: string | null;
}

export interface UpdatePracticalTemplateInput {
  title?: string;
  description?: string;
  duration_minutes?: number | null;
  module_id?: string | null;
  pass_score?: number;
  config?: Record<string, unknown>;
}

export interface CreateCriteriaInput {
  template_id: string;
  order_index: number;
  name: string;
  description?: string;
  max_score: number;
  weight?: number;
  score_step?: number | null;
  step_key?: string | null;
  kind?: PracticalCriterionKind;
  deductions?: { label: string; points: number }[];
}

export interface UpdateCriteriaInput {
  order_index?: number;
  name?: string;
  description?: string;
  max_score?: number;
  weight?: number;
  score_step?: number | null;
  step_key?: string | null;
  kind?: PracticalCriterionKind;
  deductions?: { label: string; points: number }[];
}

export interface CreatePracticalSessionInput {
  template_id: string;
  class_id: string;
  start_at: number;
  end_at: number;
  access_code: string;
  /** 'student_upload' when not given. */
  mode?: PracticalSessionMode;
}

export interface UpdatePracticalSessionInput {
  class_id?: string;
  start_at?: number;
  end_at?: number;
  access_code?: string;
  mode?: PracticalSessionMode;
}

export interface PhotoOptions {
  criteria_id?: string | null;
  label?: string;
  order_index?: number;
}
