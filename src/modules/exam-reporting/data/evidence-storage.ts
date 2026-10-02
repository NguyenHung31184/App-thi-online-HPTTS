import { supabase } from '../../../platform/supabase/client';

const EXAM_UPLOADS_BUCKET = 'exam-uploads';
const SIGNED_SECONDS = 7_200;

/** Fresh signed URLs for evidence images, 100 paths per request; a failed batch leaves its paths unsigned. */
export async function signEvidencePaths(paths: string[]): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
  const result = new Map<string, string>();
  const batches: string[][] = [];
  for (let index = 0; index < uniquePaths.length; index += 100) batches.push(uniquePaths.slice(index, index + 100));
  await Promise.all(batches.map(async (batch) => {
    const { data, error } = await supabase.storage.from(EXAM_UPLOADS_BUCKET).createSignedUrls(batch, SIGNED_SECONDS);
    if (error) return;
    (data ?? []).forEach((item, index) => {
      const path = item.path || batch[index];
      if (path && item.signedUrl) result.set(path, item.signedUrl);
    });
  }));
  return result;
}

/** The face photo taken when the attempt started (first `photo_taken` audit log), signed for viewing. */
export async function signStartPhoto(attemptId: string): Promise<string | null> {
  const { data: rows, error } = await supabase
    .from('attempt_audit_logs')
    .select('metadata')
    .eq('attempt_id', attemptId)
    .eq('event', 'photo_taken')
    .order('created_at', { ascending: true })
    .limit(1);
  if (error || !rows?.length) return null;
  const meta = rows[0].metadata as Record<string, unknown> | null;
  const path = typeof meta?.path === 'string' ? meta.path.trim() : '';
  if (!path) return null;
  const { data: signed, error: signErr } = await supabase.storage.from(EXAM_UPLOADS_BUCKET).createSignedUrl(path, SIGNED_SECONDS);
  if (signErr || !signed?.signedUrl) return null;
  return signed.signedUrl;
}
