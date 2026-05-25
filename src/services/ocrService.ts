/**
 * OCR CCCD — gửi ảnh base64 lên proxy Vercel /api/scan-id-card.
 * Proxy giữ POTENTIAL_STUDENT_API_KEY server-side; client không cần biết key.
 *
 * Dev local override: đặt VITE_TTDT_SCAN_ID_CARD_URL để gọi thẳng Edge Function (kèm VITE_TTDT_API_KEY).
 * KHÔNG dùng VITE_TTDT_VERIFY_CCCD_URL để derive URL — verify URL luôn được set và sẽ bypass proxy.
 */
import type { OcrCccdResult } from '../types';

/** Dùng proxy Vercel mặc định; hoặc gọi thẳng nếu dev đặt VITE_TTDT_SCAN_ID_CARD_URL. */
function getScanConfig(): { url: string; apiKey: string } {
  const directUrl = (import.meta.env.VITE_TTDT_SCAN_ID_CARD_URL || '').trim();
  const directKey = (import.meta.env.VITE_TTDT_API_KEY || '').trim();

  if (directUrl) return { url: directUrl, apiKey: directKey };
  // Production: luôn dùng proxy Vercel — key giữ server-side, client không cần biết
  return { url: '/api/scan-id-card', apiKey: '' };
}

export function isOcrConfigured(): boolean {
  return true;
}

/** Đọc File thành base64 (không kèm prefix data URI). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      if (!base64) reject(new Error('Không đọc được dữ liệu ảnh.'));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error('Lỗi đọc file ảnh.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Gửi file ảnh CCCD lên proxy /api/scan-id-card (hoặc Edge Function trực tiếp nếu dev).
 */
export async function analyzeCccdByImageFile(
  file: File,
): Promise<{ success: boolean; data?: OcrCccdResult; error?: string }> {
  const { url, apiKey } = getScanConfig();

  let image_data: string;
  try {
    image_data = await fileToBase64(file);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi đọc file ảnh.' };
  }

  const mime_type = file.type || 'image/jpeg';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ image_data, mime_type }),
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

    if (!res.ok) {
      const serverMsg = typeof result?.error === 'string' ? result.error : '';
      const statusMsg =
        res.status === 429
          ? 'Hệ thống OCR đang bận, vui lòng thử lại sau ít phút hoặc nhập tay CCCD.'
          : res.status === 500
            ? 'Máy chủ đọc CCCD tạm thời lỗi. Bạn có thể nhập tay số CCCD bên dưới.'
            : `Lỗi OCR (${res.status})`;
      return { success: false, error: serverMsg || statusMsg };
    }

    if (result?.error) {
      return { success: false, error: result.error as string };
    }

    const data: OcrCccdResult = {
      id_card_number: result.id_card_number as string | undefined,
      full_name: result.name as string | undefined,
      name: result.name as string | undefined,
      dob: result.dob as string | undefined,
      date_of_birth: result.dob as string | undefined,
      id_card_issue_date: result.id_card_issue_date as string | undefined,
      id_card_issue_place: result.id_card_issue_place as string | undefined,
      permanent_address: result.address as string | undefined,
      address: result.address as string | undefined,
      gender: result.gender as string | undefined,
    };

    return { success: true, data };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { success: false, error: 'Hệ thống OCR mất quá nhiều thời gian. Vui lòng nhập tay CCCD bên dưới.' };
    }
    const message = err instanceof Error ? err.message : 'Lỗi mạng khi gọi OCR.';
    return {
      success: false,
      error:
        message.includes('fetch') || message.includes('Failed')
          ? 'Không kết nối được máy chủ đọc CCCD. Bạn có thể nhập tay số CCCD bên dưới hoặc thử lại sau.'
          : message,
    };
  }
}
