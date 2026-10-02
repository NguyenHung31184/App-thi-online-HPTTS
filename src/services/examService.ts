// Moved to src/modules/exam-management; kept until the last consumer imports the module (phase 1b, step 3).
export { createExam, deleteExam, getExam, listExams, lockExam, unlockExam, updateExam } from '../modules/exam-management/public';
export type { CreateExamInput, UpdateExamInput } from '../modules/exam-management/public';
