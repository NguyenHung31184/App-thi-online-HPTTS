/**
 * Types cho App Thi Online — đồng bộ với schema Supabase (bảng exam_*).
 * MVP: single_choice; sau mở rộng multiple_choice, drag_drop, video_paragraph, main_idea.
 */

export type UserRole = 'student' | 'teacher' | 'admin' | 'proctor';

export interface User {
  id: string;
  email?: string;
  role: UserRole;
  name?: string;
  student_id?: string; // map với TTDT students.id khi đã verify CCCD
  student_code?: string;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  pass_threshold: number; // 0–1
  total_questions: number;
  blueprint?: BlueprintRule[] | string;
  questions_snapshot_url?: string | null;
  module_id?: string | null; // FK TTDT modules
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface BlueprintRule {
  topic: string;
  difficulty: string;
  count: number;
}

export type QuestionType = 'single_choice' | 'multiple_choice' | 'drag_drop' | 'video_paragraph' | 'main_idea';

export interface Question {
  id: string;
  exam_id: string;
  question_type: QuestionType;
  stem: string;
  options: { id: string; text: string }[] | unknown; // jsonb
  answer_key: string; // id option đúng, hoặc JSON string (array/object) cho loại khác
  points: number;
  topic: string;
  difficulty: string;
  image_url?: string | null;
  media_url?: string | null;
  rubric?: unknown | null;
  created_at?: string;
  updated_at?: string;
}

/** Câu hỏi trả cho thí sinh (không có answer_key) */
export interface QuestionForStudent extends Omit<Question, 'answer_key'> {
  answer_key?: never;
}

export interface ExamWindow {
  id: string;
  exam_id: string;
  class_id: string;
  start_at: number; // timestamp
  end_at: number;
  access_code: string;
  created_at?: string;
}

export type AttemptStatus = 'in_progress' | 'completed';

export interface Attempt {
  id: string;
  user_id: string;
  exam_id: string;
  window_id: string;
  status: AttemptStatus;
  answers: Record<string, string>; // questionId -> optionId hoặc JSON string
  score?: number | null;
  raw_score?: number | null;
  penalty_applied?: number | null;
  disqualified?: boolean | null;
  started_at: number;
  completed_at?: number | null;
  review_requested?: boolean | null;
  synced_to_ttdt_at?: string | null;
  created_at?: string;
  updated_at?: string;
  questions?: QuestionForStudent[];
}

export type AuditEvent = 'focus_lost' | 'visibility_hidden' | 'copy_paste_blocked' | 'photo_taken';

export interface AttemptAuditLog {
  id: string;
  attempt_id: string;
  event: AuditEvent;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

/** Kết quả OCR CCCD (proxy Chatbot / server 103) */
export interface OcrCccdResult {
  id_card_number?: string;
  full_name?: string;
  name?: string;
  dob?: string;
  date_of_birth?: string;
  id_card_issue_date?: string;
  issue_date?: string;
  id_card_issue_place?: string;
  issue_place?: string;
  permanent_address?: string;
  address?: string;
  gender?: string;
  sex?: string;
}

/** Response verify-cccd-for-exam (TTDT) */
export interface VerifyCccdResponse {
  valid: boolean;
  message?: string;
  student_id?: string;
  student_name?: string;
  student_code?: string;
  allowed_windows?: { id: string; exam_id: string; title: string; start_at: number; end_at: number }[];
}
