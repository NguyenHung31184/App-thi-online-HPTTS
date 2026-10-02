// Moved to src/modules/exam-management; kept until the last consumer imports the module (phase 1b, step 3).
export {
  createExamWindow, deleteAllTrialAttempts, deleteExamWindow, getAllowedWindows, getExamWindow, listExamWindows, updateExamWindow,
} from '../modules/exam-management/public';
export type { CreateExamWindowInput, ExamWindowWithExam, UpdateExamWindowInput } from '../modules/exam-management/public';
