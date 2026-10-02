import { supabase } from '../../../platform/supabase/client';

export interface SyncResult {
  success: boolean;
  message?: string;
}

/** The TTDT grade sync is switched on per deployment (`VITE_TTDT_SYNC_ENABLED=1`). */
export function syncEnabled(): boolean {
  return (import.meta.env.VITE_TTDT_SYNC_ENABLED ?? '') === '1';
}

/** Asks the server (`/api/sync-ttdt`) to send one attempt's grade to TTDT; the server reads everything else itself. */
export async function requestSync(body: { source: 'theory' | 'practical'; attempt_id: string }): Promise<SyncResult> {
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
