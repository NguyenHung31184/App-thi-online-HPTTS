/**
 * OCR CCCD — gửi ảnh dạng base64 trực tiếp lên Edge Function scan-id-card (Gemini Vision).
 * Không cần upload lên Storage trước — nhanh hơn, không phụ thuộc proxy server.
 * Tương tự cách Chatbot tuyển sinh đang dùng.
 */
import type { OcrCccdResult } from '../types';

const TTDT_API_KEY = import.meta.env.VITE_TTDT_API_KEY || '';
const TTDT_VERIFY_CCCD_URL = import.meta.env.VITE_TTDT_VERIFY_CCCD_URL || '';

function getScanIdCardUrl(): string {
  const explicit = (import.meta.env.VITE_TTDT_SCAN_ID_CARD_URL || '').trim();
  if (explicit) return explicit;
  if (!TTDT_VERIFY_CCCD_URL) return '';
  // Derive từ verify-cccd URL: thay đuôi function name thành scan-id-card
  return TTDT_VERIFY_CCCD_URL.replace(/\/verify-cccd-for-exam\/?$/, '/scan-id-card');
}

export function isOcrConfigured(): boolean {
  return Boolean(getScanIdCardUrl() && TTDT_API_KEY);
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
 * Gửi file ảnh CCCD lên scan-id-card (Gemini Vision) qua base64.
 * Không cần upload Storage trước — đọc trực tiếp trên thiết bị.
 */
export async function analyzeCccdByImageFile(
  file: File,
): Promise<{ success: boolean; data?: OcrCccdResult; error?: string }> {
  const url = getScanIdCardUrl();
  if (!url || !TTDT_API_KEY) {
    return {
      success: false,
      error: 'Chưa cấu hình dịch vụ đọc CCCD (cần VITE_TTDT_API_KEY và VITE_TTDT_VERIFY_CCCD_URL).',
    };
  }

  let image_data: string;
  try {
    image_data = await fileToBase64(file);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi đọc file ảnh.' };
  }

  const mime_type = file.type || 'image/jpeg';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TTDT_API_KEY,
      },
      body: JSON.stringify({ image_data, mime_type }),
    });

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

    // scan-id-card (Gemini) trả về: id_card_number, name, dob, gender, address, id_card_issue_date, id_card_issue_place
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
