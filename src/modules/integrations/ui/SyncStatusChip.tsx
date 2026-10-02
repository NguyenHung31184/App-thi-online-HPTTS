import { Link } from 'react-router-dom';
import { useWaitingSyncCount } from '../queries/use-sync-log';

/** Header chip: grades still waiting for TTDT, read from the server queue; opens the sync log. */
export function SyncStatusChip() {
  const waiting = useWaitingSyncCount(true);
  if (waiting.isLoading) return null;
  const text = waiting.isError ? 'TTDT: không đọc được hàng đợi' : waiting.data ? `TTDT: ${waiting.data} điểm chờ gửi` : 'TTDT: đã gửi hết';
  const tone = waiting.isError || waiting.data ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-700';
  return (
    <Link to="/admin/sync" className={`hidden sm:inline-flex items-center min-h-9 px-3 rounded-full border text-xs font-semibold ${tone} hover:bg-slate-50`}>
      {text}
    </Link>
  );
}
