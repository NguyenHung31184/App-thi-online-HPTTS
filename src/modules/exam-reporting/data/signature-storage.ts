import { supabase } from '../../../platform/supabase/client';
import { attemptUploadFolder, latestSignatureFile, SIGNATURE_KIND } from '../domain/signature';

const EXAM_UPLOADS_BUCKET = 'exam-uploads';
const SIGNED_SECONDS = 7_200;

/**
 * Signed URL of the attempt's signature, or null when the student has not signed. Storage policies let a student
 * read their own attempt folder and exam staff read every folder.
 */
export async function signAttemptSignature(userId: string, attemptId: string): Promise<string | null> {
  const folder = attemptUploadFolder(userId, attemptId);
  const { data: files, error } = await supabase.storage.from(EXAM_UPLOADS_BUCKET).list(folder, { search: `${SIGNATURE_KIND}_` });
  if (error) throw new Error(error.message);
  const file = latestSignatureFile((files ?? []).map((item) => item.name));
  if (!file) return null;
  const { data: signed, error: signError } = await supabase.storage
    .from(EXAM_UPLOADS_BUCKET)
    .createSignedUrl(`${folder}/${file}`, SIGNED_SECONDS);
  if (signError || !signed?.signedUrl) throw new Error(signError?.message ?? 'Không mở được ảnh chữ ký.');
  return signed.signedUrl;
}
