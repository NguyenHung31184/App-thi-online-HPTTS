import { getLearningEnrollments, getAssignedLessons, getAssignedProgress, recordLearningProgress, watchLearningToken, flushAssignedProgress } from '../data/assigned-learning-repository';
import type { EnrollmentLearning } from '../domain/assigned-learning';

export async function loadAssignedLearning(): Promise<EnrollmentLearning[]> {
  const enrollments = await getLearningEnrollments();
  return Promise.all(enrollments.map(async (enrollment) => {
    const [lessons,progress] = await Promise.all([getAssignedLessons(enrollment.id),getAssignedProgress(enrollment.id)]);
    return {enrollment,lessons,progress};
  }));
}
export { getAssignedLessons, recordLearningProgress, watchLearningToken, flushAssignedProgress };
