import type { QuizAttempt, QuizQuestion } from './quiz';

export interface AssignedBlock {
  id: string;
  block_type: 'video' | 'pdf' | 'article' | 'quiz';
  title: string | null;
  content_url: string | null;
  storage_provider: string | null;
  body_richtext: string | null;
  duration_seconds: number | null;
  quiz_pass_percent: number | null;
  /** Quiz: số lượt làm; bản nháp có thể trống (máy chủ dùng 3). */
  quiz_max_attempts?: number | null;
  /** Quiz trong phiên bản đã xuất bản: câu hỏi không kèm đáp án. */
  questions?: QuizQuestion[];
  order_index: number;
}

export interface AssignedLesson {
  assignment_id: string;
  lesson_id: string;
  lesson_version_id: string;
  version: number;
  module_id: string;
  title: string;
  description: string | null;
  order_index: number;
  required: boolean;
  opens_at: string | null;
  due_at: string | null;
  can_open: boolean;
  blocks: AssignedBlock[];
}

export interface RecordLearningInput {
  enrollmentId: string;
  assignmentId: string;
  blockId: string;
  resumeSeconds?: number;
  fromSeconds?: number;
  toSeconds?: number;
  confirmRead?: boolean;
}

export interface LearningReceipt {
  id: string;
  status: 'in_progress' | 'completed';
  resume_seconds: number;
  source: 'manual' | 'video' | 'server_quiz' | 'scorm';
  completed_at: string | null;
  updated_at: string;
}

export interface LearningEnrollment { id: string; classId: string; className: string }
export interface AssignedProgress extends LearningReceipt { assignment_id: string; block_id: string }
export interface AssignedQuizAttempt extends QuizAttempt { assignment_id: string; block_id: string }
export interface EnrollmentLearning {
  enrollment: LearningEnrollment;
  lessons: AssignedLesson[];
  progress: AssignedProgress[];
  quizAttempts: AssignedQuizAttempt[];
}

export function assignedLessonUrl(enrollmentId: string, lesson: AssignedLesson): string {
  const search = new URLSearchParams({ enrollment: enrollmentId, assignment: lesson.assignment_id });
  return `/student/learn/${lesson.lesson_id}?${search}`;
}

export function mayConfirmRead(block: AssignedBlock): boolean {
  return block.block_type === 'article' || block.block_type === 'pdf'
    || (block.block_type === 'video' && block.storage_provider === 'youtube');
}

export function validateProgressInput(input: RecordLearningInput): void {
  if (!input.enrollmentId || !input.assignmentId || !input.blockId) throw new Error('Thiếu thông tin ghi danh hoặc bài học.');
  if (!Number.isInteger(input.resumeSeconds ?? 0) || (input.resumeSeconds ?? 0) < 0) throw new Error('Vị trí xem tiếp không hợp lệ.');
  if (input.fromSeconds !== undefined || input.toSeconds !== undefined) {
    if (!Number.isInteger(input.fromSeconds) || !Number.isInteger(input.toSeconds)
      || input.fromSeconds! < 0 || input.toSeconds! <= input.fromSeconds!) throw new Error('Khoảng phát video không hợp lệ.');
  }
}
