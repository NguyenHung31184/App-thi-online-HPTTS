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

    const result = await res.json();

    if (!res.ok || result?.success === false) {
      return {
        success: false,
        error: result?.error || `Lỗi OCR (${res.status})`,
      };
    }

    const data: OcrCccdResult = {
      id_card_number: result.id_card_number ?? result.cccd ?? result.idNumber,
      full_name: result.full_name ?? result.name,
      name: result.full_name ?? result.name,
      dob: result.dob ?? result.date_of_birth,
      date_of_birth: result.dob ?? result.date_of_birth,
      id_card_issue_date: result.id_card_issue_date ?? result.issue_date,
      id_card_issue_place: result.id_card_issue_place ?? result.issue_place,
      permanent_address: result.permanent_address ?? result.address,
      address: result.permanent_address ?? result.address,
      gender: result.gender ?? result.sex,
    };

    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi mạng khi gọi OCR.';
    return { success: false, error: message };
  }
}
