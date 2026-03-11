/**
 * Kiểm tra số CCCD với TTDT — rà soát học viên có đúng lớp được phép thi không để cho vào thi.
 * Ưu tiên gọi trực tiếp Supabase Edge Function `verify-cccd-for-exam` qua supabase-js (tự xử lý JWT),
 * hạn chế tự dùng fetch để tránh lỗi "Invalid JWT".
 */
import type { VerifyCccdResponse } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const TTDT_VERIFY_CCCD_URL = import.meta.env.VITE_TTDT_VERIFY_CCCD_URL || '';
const TTDT_API_KEY = import.meta.env.VITE_TTDT_API_KEY || '';

export function isVerifyCccdConfigured(): boolean {
  // Nếu đã cấu hình Supabase (Edge Function) thì coi như đã cấu hình verify CCCD.
  // TTDT_VERIFY_CCCD_URL chỉ dùng khi cần gọi server ngoài Supabase.
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

  try {
    // Nhánh 1: gọi trực tiếp Supabase Edge Function — đây là cấu hình mặc định.
    if (isSupabaseConfigured()) {
      const headers: Record<string, string> = {};
      if (TTDT_API_KEY) headers['x-api-key'] = TTDT_API_KEY;
      const { data, error } = await supabase.functions.invoke('verify-cccd-for-exam', {
        body: {
          id_card_number: cleanCccd,
          name: params.name,
          dob: params.dob,
          class_id: params.class_id,
          window_id: params.window_id,
        },
        ...(Object.keys(headers).length ? { headers } : {}),
      });

      if (error) {
        return {
          success: false,
          error: (error as { message?: string })?.message || 'Lỗi khi gọi verify-cccd-for-exam.',
        };
      }
      return { success: true, data: (data ?? {}) as VerifyCccdResponse };
    }

    // Nhánh 2: fallback gọi URL tùy chỉnh (nếu không dùng Supabase Edge Function).
    if (!TTDT_VERIFY_CCCD_URL) {
      return { success: false, error: 'Chưa cấu hình endpoint kiểm tra CCCD.' };
    }

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
