import { supabase } from '../supabase/client';

/** The only Supabase Storage bucket still written to (CLAUDE.md, Storage Strategy). */
const EXAM_UPLOADS_BUCKET = 'exam-uploads';

/** Uploads a file to `exam-uploads` at `path` (never overwrites) and returns its stored path and public URL. */
export async function uploadToExamUploads(path: string, file: File): Promise<{ path: string; publicUrl: string }> {
  const { data, error } = await supabase.storage.from(EXAM_UPLOADS_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data: url } = supabase.storage.from(EXAM_UPLOADS_BUCKET).getPublicUrl(data.path);
  return { path: data.path, publicUrl: url.publicUrl };
}
