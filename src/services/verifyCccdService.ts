import type { VerifyCccdResponse } from '../types';
import { supabase } from '../lib/supabaseClient';

export function isVerifyCccdConfigured(): boolean {
  return true;
}

export interface VerifyCccdParams {
  id_card_number: string;
  name?: string;
  dob?: string;
  class_id?: string;
  window_id?: string;
  exam_account_email?: string;
}

export async function verifyCccdForExam(
  params: VerifyCccdParams,
): Promise<{ success: boolean; data?: VerifyCccdResponse; error?: string }> {
  const idCardNumber = params.id_card_number.replace(/\s/g, '').trim();
  if (!idCardNumber) return { success: false, error: 'Số CCCD không được để trống.' };
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) return { success: false, error: 'Phiên đăng nhập đã hết hạn.' };
  try {
    const response = await fetch('/api/verify-cccd-for-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
      body: JSON.stringify({ ...params, id_card_number: idCardNumber }),
    });
    const result = await response.json() as VerifyCccdResponse & { message?: string };
    return response.ok
      ? { success: true, data: result }
      : { success: false, error: result.message || `Lỗi từ máy chủ (${response.status})` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Lỗi mạng khi kiểm tra CCCD.' };
  }
}
