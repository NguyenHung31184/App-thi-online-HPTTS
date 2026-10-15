import { getLearningEnrollments, getAssignedLessons, getAssignedProgress, getQuizAttempts, recordLearningProgress, submitQuiz, watchLearningToken, flushAssignedProgress } from '../data/assigned-learning-repository';
import type { EnrollmentLearning } from '../domain/assigned-learning';

export async function loadAssignedLearning(): Promise<EnrollmentLearning[]> {
  const enrollments = await getLearningEnrollments();
  return Promise.all(enrollments.map(async (enrollment) => {
    const [lessons,progress,quizAttempts] = await Promise.all([getAssignedLessons(enrollment.id),getAssignedProgress(enrollment.id),getQuizAttempts(enrollment.id)]);
    return {enrollment,lessons,progress,quizAttempts};
  }));
}
export { getAssignedLessons, recordLearningProgress, submitQuiz, watchLearningToken, flushAssignedProgress };
