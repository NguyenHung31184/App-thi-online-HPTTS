import { supabase } from '../lib/supabaseClient';
import type { Attempt } from '../types';

export interface SyncResult {
  success: boolean;
  message?: string;
}

export function isTtdtSyncConfigured(): boolean {
  return (import.meta.env.VITE_TTDT_SYNC_ENABLED ?? '') === '1';
}

async function requestSync(body: Record<string, string>): Promise<SyncResult> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) return { success: false, message: 'Phiên đăng nhập đã hết hạn.' };
  try {
    const response = await fetch('/api/sync-ttdt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { success?: boolean; message?: string };
    return { success: response.ok && result.success === true, message: result.message };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Không thể gọi dịch vụ đồng bộ TTDT.' };
  }
}

export async function syncAttemptToTtdt(
  attempt: Attempt,
  _exam: { module_id?: string | null; title: string; pass_threshold?: number },
  _options?: Record<string, unknown>,
): Promise<SyncResult> {
  void _exam;
  void _options;
  if (!isTtdtSyncConfigured()) return { success: false, message: 'Chưa bật đồng bộ TTDT.' };
  return requestSync({ source: 'theory', attempt_id: attempt.id });
}

export async function syncPracticalAttemptToTtdt(
  practicalAttemptId: string,
  _totalScore: number,
  _options?: Record<string, unknown>,
): Promise<SyncResult> {
  void _totalScore;
  void _options;
  if (!isTtdtSyncConfigured()) return { success: false, message: 'Chưa bật đồng bộ TTDT.' };
  return requestSync({ source: 'practical', attempt_id: practicalAttemptId });
}
