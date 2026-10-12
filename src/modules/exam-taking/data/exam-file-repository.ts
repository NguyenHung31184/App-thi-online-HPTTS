import { supabase } from '../../../platform/supabase/client';
import type { ExamUploadInput, UploadExamFileResult } from '../domain/exam-upload';

/** Supabase trả message chung; body JSON của Edge có trường `error` chi tiết hơn (401/400/502). */
async function messageFromInvokeFailure(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      try {
        const ct = (ctx.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          const j = (await ctx.clone().json()) as { error?: string };
          if (typeof j?.error === 'string' && j.error.trim()) {
            return j.error.trim();
          }
        }
      } catch {
        /* bỏ qua parse */
      }
      return `Lỗi upload ảnh (HTTP ${ctx.status}).`;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Không upload được ảnh.';
}

/**
 * Upload ảnh thi online qua Edge `upload-exam-file`.
 * - Bucket `exam-uploads` nên để private.
 * - Edge trả về signed URL ngắn hạn để OCR / hiển thị tạm thời.
 */
export async function invokeExamUpload(input: ExamUploadInput): Promise<UploadExamFileResult> {
  try {
    const form = new FormData();
    form.set('category', input.category);
    form.set('attempt_id', input.attemptId);
    form.set('kind', input.kind);
    form.set('file', input.file);

    const { data, error } = await supabase.functions.invoke<{ success: boolean; path?: string; signedUrl?: string; error?: string }>(
      'upload-exam-file',
      { body: form }
    );
    if (error) {
      return { ok: false, error: await messageFromInvokeFailure(error) };
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

