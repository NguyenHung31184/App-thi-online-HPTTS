/**
 * Kiểm tra số CCCD với TTDT — gọi Edge Function verify-cccd-for-exam.
 * TTDT cần triển khai endpoint này (xem docs/TICH_HOP_KIEM_TRA_CCCD_TRUOC_THI.md).
 */
import type { VerifyCccdResponse } from '../types';

const TTDT_VERIFY_CCCD_URL = import.meta.env.VITE_TTDT_VERIFY_CCCD_URL || '';
const TTDT_API_KEY = import.meta.env.VITE_TTDT_API_KEY || '';

export function isVerifyCccdConfigured(): boolean {
  return Boolean(TTDT_VERIFY_CCCD_URL && TTDT_VERIFY_CCCD_URL.length > 0);
}

export interface VerifyCccdParams {
  id_card_number: string;
  name?: string;
  dob?: string;
  class_id?: string;
  window_id?: string;
}

/**
 * Gửi số CCCD (và tùy chọn name, dob) lên TTDT để kiểm tra có trong danh sách học viên được thi không.
 */
export async function verifyCccdForExam(
  params: VerifyCccdParams
): Promise<{ success: boolean; data?: VerifyCccdResponse; error?: string }> {
  if (!isVerifyCccdConfigured()) {
    return { success: false, error: 'Chưa cấu hình URL kiểm tra CCCD (VITE_TTDT_VERIFY_CCCD_URL).' };
  }

  const cleanCccd = (params.id_card_number || '').replace(/\s/g, '').trim();
  if (!cleanCccd) {
    return { success: false, error: 'Số CCCD không được để trống.' };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (TTDT_API_KEY) headers['x-api-key'] = TTDT_API_KEY;

    const res = await fetch(TTDT_VERIFY_CCCD_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id_card_number: cleanCccd,
        name: params.name,
        dob: params.dob,
        class_id: params.class_id,
        window_id: params.window_id,
      }),
    });

    const data: VerifyCccdResponse = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data?.message || `Lỗi từ server (${res.status})`,
      };
    }

    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi mạng khi kiểm tra CCCD.';
    return { success: false, error: message };
  }
}
