/**
 * Mở app HPTTS khác không cần nhập lại mật khẩu (Edge Function `app-handoff`). App nguồn xin một mã đăng nhập dùng
 * một lần cho chính người đang dùng; app đích đọc `#handoff=` lúc khởi động và đổi mã lấy phiên (auth.verifyOtp).
 * Cùng một tệp ở ba repo (app quản lý, Sổ chuyên cần, App thi): sửa một chỗ thì sửa cả ba.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type AppTarget = 'quanly' | 'socc' | 'thi';

export const APP_LABELS: Record<AppTarget, string> = {
  quanly: 'Training Manager (quản lý)',
  socc: 'Class Log (sổ chuyên cần)',
  thi: 'Learn & Exam (thi, học)',
};

const TARGET_ORDER: AppTarget[] = ['quanly', 'socc', 'thi'];

/** Mã trong `#handoff=...` (hoặc null). */
export function readHandoffToken(hash: string): string | null {
  const match = /(?:^#|&)handoff=([^&]+)/.exec(hash);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Các app người dùng được mở, trừ app đang đứng, theo thứ tự cố định. */
export function otherTargets(targets: unknown, current: AppTarget): AppTarget[] {
  const list = Array.isArray(targets) ? targets : [];
  return TARGET_ORDER.filter((t) => t !== current && list.includes(t));
}

/**
 * Gọi trước khi dựng giao diện: có mã thì xóa khỏi thanh địa chỉ rồi đổi lấy phiên. Lỗi (mã hết hạn, đã dùng) thì
 * bỏ qua, người dùng thấy màn đăng nhập như thường.
 */
export async function consumeHandoff(supabase: SupabaseClient): Promise<void> {
  if (typeof window === 'undefined') return;
  const token = readHandoffToken(window.location.hash);
  if (!token) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'magiclink' });
  if (error) console.warn('Không dùng được mã chuyển app:', error.message);
}

export async function fetchAppTargets(supabase: SupabaseClient, current: AppTarget): Promise<AppTarget[]> {
  const { data, error } = await supabase.functions.invoke('app-handoff', { body: { action: 'targets' } });
  if (error) throw error;
  return otherTargets((data as { targets?: unknown } | null)?.targets, current);
}

/**
 * Mở app đích ở tab mới. Tab được mở ngay trong lúc bấm (trình duyệt không chặn), rồi mới gán địa chỉ khi có mã.
 */
export async function openApp(supabase: SupabaseClient, target: AppTarget): Promise<void> {
  const tab = window.open('about:blank', '_blank');
  if (tab) tab.opener = null;
  try {
    const { data, error } = await supabase.functions.invoke('app-handoff', { body: { action: 'open', target } });
    const url = (data as { url?: string } | null)?.url;
    if (error || !url) throw error ?? new Error('Không mở được app');
    if (tab) tab.location.href = url;
    else window.location.assign(url);
  } catch (reason) {
    tab?.close();
    throw reason;
  }
}
