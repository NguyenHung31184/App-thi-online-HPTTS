import { uploadToExamUploads } from '../../../platform/storage/exam-uploads';
import type { PracticalAttempt, PracticalAttemptPhoto, PracticalAttemptScore, PracticalExamCriteria } from '../../../types';
import {
  callStartAttempt, callSubmitAttempt, deletePhotoRow, insertPhoto, markGraded, selectAttempt, selectAttemptsOfSession, selectPhotos,
  selectProfileStudentId, selectScores, upsertScore,
} from '../data/attempt-repository';
import { ttdtSyncBlocker, weightedTotal } from '../domain/grading';
import type { PhotoOptions } from '../domain/inputs';
import type { PracticalSessionWithTemplate } from '../domain/sessions';
// Legacy until integrations takes the TTDT sync (phase 5); listed in scripts/architecture-allowlist.json.
import { isTtdtSyncConfigured, syncPracticalAttemptToTtdt, type SyncResult } from '../../../services/ttdtSyncService';

export const createPracticalAttempt = (sessionId: string, accessCode: string): Promise<PracticalAttempt> => callStartAttempt(sessionId, accessCode);
export const submitPracticalAttempt = (attemptId: string): Promise<PracticalAttempt> => callSubmitAttempt(attemptId);
export const getPracticalAttempt = (id: string): Promise<PracticalAttempt | null> => selectAttempt(id);
export const listPracticalAttemptsBySession = (sessionId: string): Promise<PracticalAttempt[]> => selectAttemptsOfSession(sessionId);
export const listPracticalPhotos = (attemptId: string): Promise<PracticalAttemptPhoto[]> => selectPhotos(attemptId);
export const deletePracticalPhoto = (photoId: string): Promise<void> => deletePhotoRow(photoId);
export const listPracticalScores = (attemptId: string): Promise<PracticalAttemptScore[]> => selectScores(attemptId);

/** Stores the photo under practical/<attempt>/ in exam-uploads, then records it on the attempt. */
export async function uploadPracticalPhoto(attemptId: string, file: File, options?: PhotoOptions): Promise<PracticalAttemptPhoto> {
  const ext = file.name.split('.').pop() || 'jpg';
  const { publicUrl } = await uploadToExamUploads(`practical/${attemptId}/${Date.now()}.${ext}`, file);
  return insertPhoto({
    attempt_id: attemptId,
    criteria_id: options?.criteria_id ?? null,
    label: options?.label ?? '',
    file_url: publicUrl,
    order_index: options?.order_index ?? 0,
  });
}

export const upsertPracticalScore = (attemptId: string, criteriaId: string, score: number, comment?: string | null): Promise<PracticalAttemptScore> =>
  upsertScore(attemptId, criteriaId, score, comment ?? null);

/** Marks the attempt graded with the weighted total of the scores. */
export function completePracticalGrading(
  attemptId: string,
  criteria: PracticalExamCriteria[],
  scoresByCriteria: Record<string, number>,
  gradedBy: string,
): Promise<PracticalAttempt> {
  return markGraded(attemptId, weightedTotal(criteria, scoresByCriteria), gradedBy);
}

/** Saves every criterion's score and comment, then marks the attempt graded. */
export async function gradePracticalAttempt(
  attemptId: string,
  criteria: PracticalExamCriteria[],
  scores: Record<string, number>,
  comments: Record<string, string>,
  gradedBy: string,
): Promise<PracticalAttempt> {
  for (const c of criteria) await upsertPracticalScore(attemptId, c.id, scores[c.id] ?? 0, comments[c.id] || null);
  return completePracticalGrading(attemptId, criteria, scores, gradedBy);
}

export const ttdtSyncEnabled = (): boolean => isTtdtSyncConfigured();

/** Sends a graded attempt to TTDT once the student and the module are known. */
export async function syncGradeToTtdt(attempt: PracticalAttempt, session: PracticalSessionWithTemplate): Promise<SyncResult> {
  const studentId = await selectProfileStudentId(attempt.user_id);
  const blocker = ttdtSyncBlocker(studentId, session.template?.module_id ?? null);
  if (blocker) return { success: false, message: blocker };
  return syncPracticalAttemptToTtdt(attempt.id, attempt.total_score ?? 0, {
    classId: session.class_id,
    studentId,
    moduleId: session.template?.module_id,
  });
}
