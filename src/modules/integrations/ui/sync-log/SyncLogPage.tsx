import { useMemo, useState } from 'react';
import { failedCounts, type ExamSyncLogEntry } from '../../domain/sync-log';
import { explainTheorySyncError } from '../../domain/sync-errors';
import { useCleanupSyncLogs, usePracticalSyncLog, useRetrySync, useTheorySyncLog, useTtdtSyncConfigured } from '../../queries/use-sync-log';
import { ResponseModal } from './ResponseModal';
import { PracticalSyncTable, TheorySyncTable } from './SyncLogTables';

type Tab = 'theory' | 'practical';

/** TTDT grade sync log: retry failed rows, read the server response, help for theory errors. */
export default function SyncLogPage() {
  const [tab, setTab] = useState<Tab>('theory');
  const [filterFailed, setFilterFailed] = useState(false);
  const [message, setMessage] = useState('');
  const [responseModal, setResponseModal] = useState<{ title: string; content: string } | null>(null);
  const [manualAttemptId, setManualAttemptId] = useState('');
  const configured = useTtdtSyncConfigured();
  const status = filterFailed ? ('failed' as const) : undefined;
  const theory = useTheorySyncLog(status, configured && tab === 'theory');
  const practical = usePracticalSyncLog(status, configured && tab === 'practical');
  const retry = useRetrySync();
  const cleanup = useCleanupSyncLogs();

  const theoryLogs = useMemo(() => theory.data ?? [], [theory.data]);
  const practicalLogs = useMemo(() => practical.data ?? [], [practical.data]);
  const counts = useMemo(() => failedCounts(theoryLogs, practicalLogs), [theoryLogs, practicalLogs]);
  const loading = tab === 'theory' ? theory.isFetching : practical.isFetching;
  const retryingId = retry.isPending ? retry.variables?.attemptId ?? null : null;

  const reload = () => void (tab === 'theory' ? theory.refetch() : practical.refetch());

  const runRetry = (source: 'theory' | 'practical', attemptId: string, onDone?: () => void) => {
    setMessage('');
    retry.mutate({ source, attemptId }, {
      onSuccess: (result) => { setMessage(result.message); onDone?.(); },
      onError: (e) => setMessage(e instanceof Error ? e.message : 'Lỗi thử lại.'),
    });
  };

  const handleManualRetry = () => {
    const id = manualAttemptId.trim();
    if (!id) return;
    runRetry('theory', id, () => setManualAttemptId(''));
  };

  const handleExplain = (log: ExamSyncLogEntry) =>
    setResponseModal({ title: `Hướng dẫn xử lý lỗi (${log.attempt_id.slice(0, 8)}…)`, content: explainTheorySyncError(log.response) });

  const handleCleanup = () => {
    if (!window.confirm('Xóa các log Lỗi đã cũ hơn 30 ngày? Thao tác này không thể hoàn tác.')) return;
    setMessage('Đang dọn dẹp log cũ...');
    cleanup.mutate(undefined, {
      onSuccess: () => setMessage('Đã dọn dẹp các log lỗi cũ (trên 30 ngày).'),
      onError: (e) => setMessage(e instanceof Error ? e.message : 'Lỗi khi dọn dẹp log.'),
    });
  };

  if (!configured) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Nhật ký đồng bộ TTDT</h1>
        <p className="text-amber-600">Chưa bật đồng bộ TTDT. Kiểm tra VITE_TTDT_SYNC_ENABLED và cấu hình máy chủ.</p>
      </div>
    );
  }

  const tabButton = (value: Tab, label: string, failed: number, total: number) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 ${tab === value ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
    >
      {label}
      <span className={`text-xs px-2 py-0.5 rounded-full ${tab === value ? 'bg-white/20' : 'bg-slate-100 text-slate-700'}`}>
        {failed}/{total}
      </span>
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Nhật ký đồng bộ TTDT</h1>
          <p className="text-slate-600 text-sm mt-1">Theo dõi log đồng bộ và thử lại các bản ghi lỗi. Chỉ Admin có quyền thao tác.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-full px-3 py-2">
            <input type="checkbox" checked={filterFailed} onChange={(e) => setFilterFailed(e.target.checked)} />
            Chỉ hiện lỗi
          </label>
          <button type="button" onClick={reload} className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-full hover:bg-slate-50 text-sm">
            Tải lại
          </button>
          <button
            type="button"
            onClick={handleCleanup}
            disabled={cleanup.isPending}
            className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-full hover:bg-rose-100 text-sm disabled:opacity-50"
          >
            {cleanup.isPending ? 'Đang dọn...' : 'Dọn lỗi cũ (30 ngày)'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex rounded-full border border-slate-200 bg-white overflow-hidden">
          {tabButton('theory', 'Lý thuyết', counts.theoryFailed, counts.theoryTotal)}
          {tabButton('practical', 'Thực hành', counts.practicalFailed, counts.practicalTotal)}
        </div>
      </div>

      {/* Manual retry for an attempt with no log row (the network dropped at submit time). */}
      <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 shrink-0">Retry bằng Attempt ID:</span>
        <input
          type="text"
          value={manualAttemptId}
          onChange={(e) => setManualAttemptId(e.target.value)}
          placeholder="UUID của attempt (bài làm không có trong log)"
          className="flex-1 min-w-[18rem] border border-slate-300 rounded px-2 py-1 text-xs font-mono"
        />
        <button
          type="button"
          onClick={handleManualRetry}
          disabled={!manualAttemptId.trim() || retry.isPending}
          className="px-3 py-1.5 bg-amber-500 text-white text-xs rounded hover:bg-amber-600 disabled:opacity-50"
        >
          {retry.isPending && retryingId === manualAttemptId.trim() ? 'Đang thử…' : 'Retry'}
        </button>
      </div>

      {message && <p className={`text-sm mb-2 ${message.includes('thành công') ? 'text-green-600' : 'text-amber-600'}`}>{message}</p>}

      {loading && <p className="text-slate-500 text-sm">Đang tải...</p>}

      {tab === 'theory' && !loading && (
        <TheorySyncTable
          logs={theoryLogs}
          retryingId={retryingId}
          onRetry={(id) => runRetry('theory', id)}
          onExplain={handleExplain}
          onShowResponse={(title, content) => setResponseModal({ title, content })}
        />
      )}

      {tab === 'practical' && !loading && (
        <PracticalSyncTable
          logs={practicalLogs}
          retryingId={retryingId}
          onRetry={(id) => runRetry('practical', id)}
          onShowResponse={(title, content) => setResponseModal({ title, content })}
        />
      )}

      {responseModal && <ResponseModal title={responseModal.title} content={responseModal.content} onClose={() => setResponseModal(null)} />}
    </div>
  );
}
