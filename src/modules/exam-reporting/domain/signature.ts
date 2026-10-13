/** Upload kind of the signature image; the upload function names the file `<kind>_<timestamp>.<ext>`. */
export const SIGNATURE_KIND = 'signature';

export const SIGNATURE_STATEMENT = 'Tôi xác nhận đã tự làm bài thi này và đã được biết kết quả.';

/** Folder of one attempt's uploads in the exam bucket: the same place as the photo taken at the start. */
export function attemptUploadFolder(userId: string, attemptId: string): string {
  return `proctoring/${userId}/${attemptId}`;
}

/** The newest signature among the file names of an attempt folder, or null. Timestamps sort as text. */
export function latestSignatureFile(names: string[]): string | null {
  const signatures = names.filter((name) => name.startsWith(`${SIGNATURE_KIND}_`)).sort();
  return signatures.length > 0 ? signatures[signatures.length - 1] : null;
}

/** Shortest total stroke, in canvas pixels, that counts as a signature and not a stray tap. */
export const MIN_SIGNATURE_LENGTH = 120;
