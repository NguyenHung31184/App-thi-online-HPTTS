import type { VerifyCccdResponse } from '../../../types';
import { currentAccessToken } from './auth-session';

export interface VerifyCccdParams {
  id_card_number: string;
  name?: string;
  dob?: string;
  class_id?: string;
  window_id?: string;
  exam_account_email?: string;
}

/** Asks the server (`/api/verify-cccd-for-exam`) whether this CCCD is on a class list for the signed-in account. */
export async function callVerifyCccd(params: VerifyCccdParams): Promise<{ success: boolean; data?: VerifyCccdResponse; error?: string }> {
  const token = await currentAccessToken();
  if (!token) return { success: false, error: 'Phiên đăng nhập đã hết hạn.' };
  try {
    const response = await fetch('/api/verify-cccd-for-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    });
    const result = await response.json() as VerifyCccdResponse & { message?: string };
    return response.ok
      ? { success: true, data: result }
      : { success: false, error: result.message || `Lỗi từ máy chủ (${response.status})` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Lỗi mạng khi kiểm tra CCCD.' };
  }
}
