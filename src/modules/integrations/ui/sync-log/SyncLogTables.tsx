import type { ExamSyncLogEntry, PracticalSyncLogEntry } from '../../domain/sync-log';

type ShowResponse = (title: string, content: string) => void;

function StatusText({ status }: { status: 'success' | 'failed' }) {
  return <span className={status === 'success' ? 'text-green-600' : 'text-red-600'}>{status === 'success' ? 'Thành công' : 'Lỗi'}</span>;
}

function ResponseCell({ response, title, onShow }: { response: string | null; title: string; onShow: ShowResponse }) {
  return (
    <td className="px-3 py-2 max-w-xs text-slate-600">
      <div className="flex items-center gap-2">
        <span className="truncate" title={response ?? ''}>
          {response ? response.slice(0, 80) + (response.length > 80 ? '…' : '') : '—'}
        </span>
        {response && (
          <button
            type="button"
            onClick={() => onShow(title, response)}
            className="text-xs px-2 py-1 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700"
          >
            Xem
          </button>
        )}
      </div>
    </td>
  );
}

interface TheoryProps {
  logs: ExamSyncLogEntry[];
  retryingId: string | null;
  onRetry: (attemptId: string) => void;
  onExplain: (log: ExamSyncLogEntry) => void;
  onShowResponse: ShowResponse;
}

export function TheorySyncTable({ logs, retryingId, onRetry, onExplain, onShowResponse }: TheoryProps) {
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="px-3 py-2">Attempt ID</th>
            <th className="px-3 py-2">Học viên</th>
            <th className="px-3 py-2">Đề thi / Kỳ</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2">Phản hồi</th>
            <th className="px-3 py-2">Thời gian</th>
            <th className="px-3 py-2">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-mono text-xs">{log.attempt_id.slice(0, 8)}…</td>
              <td className="px-3 py-2">
                <div className="text-sm font-medium text-slate-800">{log.user_name || log.user_email || '—'}</div>
                {log.user_email && <div className="text-[11px] text-slate-500">{log.user_email}</div>}
              </td>
              <td className="px-3 py-2">
                <div className="text-slate-800">{log.exam_title || '—'}</div>
                {log.window_id && (
                  <div className="text-[11px] text-slate-500">
                    {log.window_id.slice(0, 8)}… / {log.class_name || log.class_id || '—'}
                  </div>
                )}
              </td>
              <td className="px-3 py-2"><StatusText status={log.status} /></td>
              <ResponseCell response={log.response} title={`Phản hồi (${log.attempt_id.slice(0, 8)}…)`} onShow={onShowResponse} />
              <td className="px-3 py-2 text-slate-600">{new Date(log.created_at).toLocaleString('vi-VN')}</td>
              <td className="px-3 py-2">
                {log.status === 'failed' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onRetry(log.attempt_id)}
                      disabled={retryingId === log.attempt_id}
                      className="px-2 py-1 bg-amber-500 text-white text-xs rounded hover:bg-amber-600 disabled:opacity-50"
                    >
                      {retryingId === log.attempt_id ? 'Đang thử…' : 'Thử lại'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onExplain(log)}
                      className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded hover:bg-slate-200 border border-slate-200"
                    >
                      Hướng dẫn
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <p className="p-4 text-slate-500 text-sm">Chưa có bản ghi đồng bộ lý thuyết.</p>}
    </div>
  );
}

interface PracticalProps {
  logs: PracticalSyncLogEntry[];
  retryingId: string | null;
  onRetry: (attemptId: string) => void;
  onShowResponse: ShowResponse;
}

export function PracticalSyncTable({ logs, retryingId, onRetry, onShowResponse }: PracticalProps) {
  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="px-3 py-2">Practical Attempt ID</th>
            <th className="px-3 py-2">Trạng thái</th>
            <th className="px-3 py-2">Phản hồi</th>
            <th className="px-3 py-2">Thời gian</th>
            <th className="px-3 py-2">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t border-slate-100">
              <td className="px-3 py-2 font-mono text-xs">{log.practical_attempt_id.slice(0, 8)}…</td>
              <td className="px-3 py-2"><StatusText status={log.status} /></td>
              <ResponseCell response={log.response} title={`Phản hồi (${log.practical_attempt_id.slice(0, 8)}…)`} onShow={onShowResponse} />
              <td className="px-3 py-2 text-slate-600">{new Date(log.created_at).toLocaleString('vi-VN')}</td>
              <td className="px-3 py-2">
                {log.status === 'failed' && (
                  <button
                    type="button"
                    onClick={() => onRetry(log.practical_attempt_id)}
                    disabled={retryingId === log.practical_attempt_id}
                    className="px-2 py-1 bg-amber-500 text-white text-xs rounded hover:bg-amber-600 disabled:opacity-50"
                  >
                    {retryingId === log.practical_attempt_id ? 'Đang thử…' : 'Thử lại'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <p className="p-4 text-slate-500 text-sm">Chưa có bản ghi đồng bộ thực hành.</p>}
    </div>
  );
}
