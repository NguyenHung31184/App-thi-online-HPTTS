export { selectStudentResults as listStudentResults, currentResultUserId, selectLegacyTotalPoints as getLegacyTotalPoints, fetchStartExamPhotoSignedUrl, fetchMyStudentRecord } from '../data/student-result-repository';

import { getAttempt } from '../../exam-taking/public';
import { getExam } from '../../exam-management/public';
import { currentResultUserId } from '../data/student-result-repository';

export async function loadStudentResult(attemptId: string, userId?: string) {
  const ownerId = userId || await currentResultUserId();
  if (!ownerId) throw new Error('Bạn chưa đăng nhập. Vui lòng đăng nhập lại để xem kết quả.');
  const attempt = await getAttempt(attemptId);
  if (!attempt) throw new Error('Không tìm thấy bài làm.');
  if (attempt.user_id !== ownerId) throw new Error('Bạn không có quyền xem kết quả này.');
  const exam = await getExam(attempt.exam_id);
  return { attempt, exam };
}
