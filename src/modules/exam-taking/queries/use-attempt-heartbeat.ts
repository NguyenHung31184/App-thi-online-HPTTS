import { useEffect } from 'react';
import { reportTheoryAttemptConnection } from '../application/manage-theory-attempt';

// Bảng giám sát coi bài là mất kết nối sau 60 giây không có tín hiệu, nên 20 giây cho phép lỡ hai lần.
const HEARTBEAT_MS = 20_000;

/** Gửi tín hiệu "còn mở" cho bài đang làm: ngay khi vào và mỗi 20 giây, dừng khi bài không còn in_progress. */
export function useAttemptHeartbeat(attemptId: string | undefined, active: boolean): void {
  useEffect(() => {
    if (!attemptId || !active) return;
    const beat = () => {
      reportTheoryAttemptConnection(attemptId).catch((err) => console.warn('[Heartbeat] Không gửi được tín hiệu:', err));
    };
    beat();
    const id = window.setInterval(beat, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [attemptId, active]);
}
