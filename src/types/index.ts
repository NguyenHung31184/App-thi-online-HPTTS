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
  student_name?: string;
}

/** Phiên đăng nhập của học viên dựa trên CCCD (không cần Supabase auth). */
export interface StudentSession {
  id_card_number?: string;
  /** Ngày sinh (chuỗi hiển thị từ OCR / nhập tay), lưu session để in phiếu kết quả. */
  student_dob?: string;
  student_id?: string;
  student_code?: string;
  student_name?: string;
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
  /** Khi có giá trị, thí sinh vào thi quay ngẫu nhiên 1 trong các đề. */
  exam_ids?: string[] | null;
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
  /** Thông tin học viên được “đóng dấu” lúc vào thi (từ verify CCCD). */
  student_id?: string | null;
  student_name?: string | null;
  student_dob?: string | null;
  id_card_number?: string | null;
  score?: number | null;
  raw_score?: number | null;
  total_max?: number | null;
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

export type AuditEvent = 'focus_lost' | 'visibility_hidden' | 'copy_paste_blocked' | 'photo_taken' | 'fullscreen_exited';

export interface AttemptAuditLog {
  id: string;
  attempt_id: string;
  event: AuditEvent;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

/** Điểm từng câu chấm tay (tự luận: video_paragraph, main_idea) */
export interface AttemptQuestionScore {
  id: string;
  attempt_id: string;
  question_id: string;
  score: number;
  max_points: number;
  graded_by?: string | null;
  graded_at?: string | null;
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

/** TTDT: Lớp học (đọc từ bảng classes nếu cùng DB) */
export interface ClassItem {
  id: string;
  name: string;
  code?: string;
}

/** TTDT: Học phần / Mô-đun (đọc từ bảng modules nếu cùng DB) */
export interface ModuleItem {
  id: string;
  name: string;
  code?: string;
}

/** Nghề đào tạo (theo nghề, không theo khóa học). Ngân hàng câu hỏi gắn theo nghề. */
export interface Occupation {
  id: string;
  name: string;
  code?: string;
  created_at?: string;
}

/** Câu hỏi trong ngân hàng theo nghề (question_bank). Cấu trúc giống Question nhưng không có exam_id. */
export interface QuestionBankItem {
  id: string;
  occupation_id: string;
  module_id?: string | null;
  question_type: QuestionType;
  stem: string;
  options: { id: string; text: string }[] | unknown;
  answer_key: string;
  points: number;
  topic: string;
  difficulty: string;
  image_url?: string | null;
  media_url?: string | null;
  rubric?: unknown | null;
  created_at?: string;
  updated_at?: string;
}

/** Response verify-cccd-for-exam (TTDT) */
export interface VerifyCccdResponse {
  valid: boolean;
  message?: string;
  student_id?: string;
  student_name?: string;
  student_code?: string;
  /** Lớp học viên đang tham gia (từ enrollments + classes TTDT) */
  classes?: { id: string; name: string }[];
  allowed_windows?: { id: string; exam_id: string; title: string; start_at: number; end_at: number }[];
}

// --- Phase 5: Thi thực hành ---

export interface PracticalExamTemplate {
  id: string;
  title: string;
  description: string;
  duration_minutes?: number | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
}

export interface PracticalExamCriteria {
  id: string;
  template_id: string;
  order_index: number;
  name: string;
  description: string;
  max_score: number;
  weight: number;
  score_step?: number | null;
  created_at?: string;
}

export type PracticalSessionMode = 'student_upload' | 'teacher_grading';

export interface PracticalExamSession {
  id: string;
  template_id: string;
  class_id: string;
  start_at: number;
  end_at: number;
  access_code: string;
  /** Cách tổ chức kỳ thi: student_upload (HV tự upload) hoặc teacher_grading (GV chấm trực tiếp). */
  mode?: PracticalSessionMode;
  created_at?: string;
}

export type PracticalAttemptStatus = 'pending_upload' | 'submitted' | 'grading' | 'graded';

export interface PracticalAttempt {
  id: string;
  session_id: string;
  user_id: string;
  status: PracticalAttemptStatus;
  total_score?: number | null;
  submitted_at?: string | null;
  graded_at?: string | null;
  graded_by?: string | null;
  synced_to_ttdt_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PracticalAttemptPhoto {
  id: string;
  attempt_id: string;
  criteria_id?: string | null;
  label: string;
  file_url: string;
  order_index: number;
  uploaded_at?: string;
}

export interface PracticalAttemptScore {
  id: string;
  attempt_id: string;
  criteria_id: string;
  score: number;
  comment?: string | null;
  graded_by?: string | null;
  graded_at?: string | null;
}
