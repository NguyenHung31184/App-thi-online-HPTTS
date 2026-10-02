import type { OcrCccdResult } from '../../../types';
import { ocrHttpError, ocrNetworkError, ocrResultFrom } from '../domain/ocr';

const OCR_TIMEOUT_MS = 50_000;

/** File contents as base64, without the data URI prefix. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (!base64) reject(new Error('Không đọc được dữ liệu ảnh.'));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error('Lỗi đọc file ảnh.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Reads a CCCD photo through the Vercel proxy `/api/scan-id-card`, which keeps the OCR API key on the server so it never
 * reaches the browser.
 */
export async function scanIdCard(file: File): Promise<{ success: boolean; data?: OcrCccdResult; error?: string }> {
  let image_data: string;
  try {
    image_data = await fileToBase64(file);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi đọc file ảnh.' };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch('/api/scan-id-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data, mime_type: file.type || 'image/jpeg' }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    let result: Record<string, unknown>;
    try {
      result = (await res.json()) as Record<string, unknown>;
    } catch {
      result = {};
    }
    if (!res.ok) return { success: false, error: ocrHttpError(res.status, result) };
    if (result?.error) return { success: false, error: result.error as string };
    return { success: true, data: ocrResultFrom(result) };
  } catch (err) {
    return { success: false, error: ocrNetworkError(err) };
  }
}
