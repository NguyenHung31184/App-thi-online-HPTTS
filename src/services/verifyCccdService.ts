/**
 * Kiểm tra số CCCD với TTDT — rà soát học viên có đúng lớp được phép thi không để cho vào thi.
 * Gọi Edge Function verify-cccd-for-exam qua fetch với anon key + x-api-key (tránh 401 gateway).
 */
import type { VerifyCccdResponse } from '../types';
import { isSupabaseConfigured } from '../lib/supabaseClient';

const TTDT_VERIFY_CCCD_URL = import.meta.env.VITE_TTDT_VERIFY_CCCD_URL || '';
const TTDT_API_KEY = import.meta.env.VITE_TTDT_API_KEY || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export function isVerifyCccdConfigured(): boolean {
  return isSupabaseConfigured() || Boolean(TTDT_VERIFY_CCCD_URL && TTDT_VERIFY_CCCD_URL.length > 0);
}

export interface VerifyCccdParams {
  id_card_number: string;
  name?: string;
  dob?: string;
  class_id?: string;
  window_id?: string;
}

/**
 * Gửi số CCCD lên TTDT để rà soát: học viên có đúng lớp được phép thi không. Chỉ khi đúng lớp mới cho vào thi (trả allowed_windows).
 */
export async function verifyCccdForExam(
  params: VerifyCccdParams
): Promise<{ success: boolean; data?: VerifyCccdResponse; error?: string }> {
  const cleanCccd = (params.id_card_number || '').replace(/\s/g, '').trim();
  if (!cleanCccd) {
    return { success: false, error: 'Số CCCD không được để trống.' };
  }

  const url = TTDT_VERIFY_CCCD_URL || (isSupabaseConfigured() ? `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/functions/v1/verify-cccd-for-exam` : '');
  if (!url) {
    return { success: false, error: 'Chưa cấu hình endpoint kiểm tra CCCD.' };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': TTDT_API_KEY,
    };
    if (SUPABASE_ANON_KEY) headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;

    const res = await fetch(url, {
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

    const data = (await res.json()) as VerifyCccdResponse & { message?: string };

    if (!res.ok) {
      return {
        success: false,
        error: data?.message || `Lỗi từ server (${res.status})`,
      };
    }

    return { success: true, data: data as VerifyCccdResponse };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi mạng khi kiểm tra CCCD.';
    return { success: false, error: message };
  }
}
