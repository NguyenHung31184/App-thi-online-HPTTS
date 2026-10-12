export type ExamUploadCategory = 'proctoring' | 'cccd';
export interface ExamUploadInput {
  category: ExamUploadCategory;
  attemptId: string;
  kind: string;
  file: File | Blob;
}
export type UploadExamFileResult =
  | { ok: true; path: string; signedUrl: string }
  | { ok: false; error: string };
