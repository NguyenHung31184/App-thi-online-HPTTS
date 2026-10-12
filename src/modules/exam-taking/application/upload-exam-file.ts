import { compressImageForExamUpload } from '../../../platform/media/compress-exam-image';
import { invokeExamUpload } from '../data/exam-file-repository';
import type { ExamUploadInput, UploadExamFileResult } from '../domain/exam-upload';

export async function uploadExamFileViaEdge(input: ExamUploadInput): Promise<UploadExamFileResult> {
  try {
    const compressed = await compressImageForExamUpload(input.file);
    const file = compressed === input.file && input.file instanceof File
      ? input.file
      : new File([compressed], `${input.kind}.jpg`, {
        type: compressed === input.file ? compressed.type || 'image/jpeg' : 'image/jpeg',
      });
    return await invokeExamUpload({ ...input, file });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Lỗi mạng khi upload ảnh.' };
  }
}
