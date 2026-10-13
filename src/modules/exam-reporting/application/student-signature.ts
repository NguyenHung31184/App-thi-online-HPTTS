import { recordTheoryAttemptAuditEvent, uploadExamFileViaEdge } from '../../exam-taking/public';
import { signAttemptSignature } from '../data/signature-storage';
import { SIGNATURE_KIND } from '../domain/signature';

/** The signature of an attempt, signed for viewing; null when the student has not signed. */
export function loadAttemptSignatureUrl(userId: string, attemptId: string): Promise<string | null> {
  return signAttemptSignature(userId, attemptId);
}

/** Stores the signature image with the attempt's other uploads and returns a URL to show it. */
export async function saveAttemptSignature(attemptId: string, image: Blob): Promise<string> {
  const uploaded = await uploadExamFileViaEdge({ category: 'proctoring', attemptId, kind: SIGNATURE_KIND, file: image });
  if (!uploaded.ok) throw new Error(uploaded.error);
  // The file is the record; the log line only gives staff the time of signing.
  await recordTheoryAttemptAuditEvent(attemptId, 'signature_taken', { path: uploaded.path }).catch(() => undefined);
  return uploaded.signedUrl;
}
