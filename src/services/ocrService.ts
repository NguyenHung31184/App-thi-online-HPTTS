/**
 * OCR CCCD — tận dụng server mà Chatbot tuyển sinh đang gọi.
 * Gọi proxy: https://chatbot-hptts-2025.vercel.app/api/ocr
 * Body: { image_url: string } (ảnh phải có URL public — upload Supabase Storage trước).
 */
import type { OcrCccdResult } from '../types';

const OCR_URL = import.meta.env.VITE_OCR_CCCD_URL || 'https://chatbot-hptts-2025.vercel.app/api/ocr';

export function isOcrConfigured(): boolean {
  return Boolean(OCR_URL && OCR_URL.length > 0);
}

/**
 * Gửi URL ảnh CCCD lên server OCR (proxy Chatbot), trả về thông tin trích xuất.
 */
export async function analyzeCccdByImageUrl(
  imageUrl: string
): Promise<{ success: boolean; data?: OcrCccdResult; error?: string }> {
  if (!isOcrConfigured()) {
    return { success: false, error: 'Chưa cấu hình dịch vụ OCR CCCD (VITE_OCR_CCCD_URL).' };
  }

  try {
    const res = await fetch(OCR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    let result: Record<string, unknown>;
    try {
      result = (await res.json()) as Record<string, unknown>;
    } catch {
      result = {};
    }

    if (!res.ok) {
      const serverMsg = typeof result?.error === 'string' ? result.error : (result?.message as string) || '';
      const statusMsg = res.status === 500
        ? 'Máy chủ đọc CCCD tạm thời lỗi. Bạn có thể nhập tay số CCCD bên dưới.'
        : `Lỗi OCR (${res.status})`;
      return {
        success: false,
        error: serverMsg || statusMsg,
      };
    }

    if (result?.success === false) {
      return {
        success: false,
        error: (result?.error as string) || 'Không đọc được thông tin từ ảnh CCCD.',
      };
    }

    const data: OcrCccdResult = {
      id_card_number: (result.id_card_number ?? result.cccd ?? result.idNumber) as string | undefined,
      full_name: (result.full_name ?? result.name) as string | undefined,
      name: (result.full_name ?? result.name) as string | undefined,
      dob: (result.dob ?? result.date_of_birth) as string | undefined,
      date_of_birth: (result.dob ?? result.date_of_birth) as string | undefined,
      id_card_issue_date: (result.id_card_issue_date ?? result.issue_date) as string | undefined,
      id_card_issue_place: (result.id_card_issue_place ?? result.issue_place) as string | undefined,
      permanent_address: (result.permanent_address ?? result.address) as string | undefined,
      address: (result.permanent_address ?? result.address) as string | undefined,
      gender: (result.gender ?? result.sex) as string | undefined,
    };

    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi mạng khi gọi OCR.';
    return {
      success: false,
      error: message.includes('fetch') || message.includes('Failed')
        ? 'Không kết nối được máy chủ đọc CCCD. Bạn có thể nhập tay số CCCD bên dưới hoặc thử lại sau.'
        : message,
    };
  }
}
