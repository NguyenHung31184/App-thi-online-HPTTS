import { supabase } from '../lib/supabaseClient';

export type ExamUploadCategory = 'proctoring' | 'cccd';

export type UploadExamFileResult =
  | { ok: true; path: string; signedUrl: string }
  | { ok: false; error: string };

/**
 * Upload ảnh thi online qua Edge `upload-exam-file`.
 * - Bucket `exam-uploads` nên để private.
 * - Edge trả về signed URL ngắn hạn để OCR / hiển thị tạm thời.
 */
export async function uploadExamFileViaEdge(input: {
  category: ExamUploadCategory;
  attemptId: string;
  kind: string;
  file: File | Blob;
}): Promise<UploadExamFileResult> {
  try {
    const form = new FormData();
    form.set('category', input.category);
    form.set('attempt_id', input.attemptId);
    form.set('kind', input.kind);
    // Supabase Edge multipart expects File for correct metadata; wrap Blob if needed.
    const file =
      input.file instanceof File
        ? input.file
        : new File([input.file], `${input.kind}.jpg`, { type: input.file.type || 'image/jpeg' });
    form.set('file', file);

    const { data, error } = await supabase.functions.invoke<{ success: boolean; path?: string; signedUrl?: string; error?: string }>(
      'upload-exam-file',
      { body: form }
    );
    if (error) {
      return { ok: false, error: error.message || 'Không upload được ảnh.' };
    }
    if (!data?.success || !data.path || !data.signedUrl) {
      return { ok: false, error: data?.error || 'Phản hồi upload không hợp lệ.' };
    }
    return { ok: true, path: data.path, signedUrl: data.signedUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi mạng khi upload ảnh.';
    return { ok: false, error: msg };
  }
}

