import { useState, useEffect } from 'react';
import { listExamSyncLog, listPracticalSyncLog } from '../../services/syncLogService';
import { getAttempt } from '../../services/attemptService';
import { getExam } from '../../services/examService';
import { getExamWindow } from '../../services/examWindowService';
import { getPracticalAttempt } from '../../services/practicalAttemptService';
import { getPracticalSessionWithTemplate } from '../../services/practicalSessionService';
import {
  syncAttemptToTtdt,
  syncPracticalAttemptToTtdt,
  isTtdtSyncConfigured,
} from '../../services/ttdtSyncService';
import type { ExamSyncLogEntry, PracticalSyncLogEntry } from '../../services/syncLogService';

type Tab = 'theory' | 'practical';

export default function AdminSyncPage() {
  const [tab, setTab] = useState<Tab>('theory');
  const [theoryLogs, setTheoryLogs] = useState<ExamSyncLogEntry[]>([]);
  const [practicalLogs, setPracticalLogs] = useState<PracticalSyncLogEntry[]>([]);
  const [filterFailed, setFilterFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const loadTheory = () => {
    setLoading(true);
    listExamSyncLog(filterFailed ? { status: 'failed' } : undefined)
      .then(setTheoryLogs)
      .catch(() => setTheoryLogs([]))
      .finally(() => setLoading(false));
  };

  const loadPractical = () => {
    setLoading(true);
    listPracticalSyncLog(filterFailed ? { status: 'failed' } : undefined)
      .then(setPracticalLogs)
      .catch(() => setPracticalLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === 'theory') loadTheory();
    else loadPractical();
  }, [tab, filterFailed]);

  const handleRetryTheory = async (attemptId: string) => {
    setMessage('');
    setRetryingId(attemptId);
    try {
      const attempt = await getAttempt(attemptId);
      if (!attempt) {
        setMessage('Không tìm thấy bài làm.');
        return;
      }
      const exam = await getExam(attempt.exam_id);
      if (!exam) {
        setMessage('Không tìm thấy đề thi.');
        return;
      }
      const window = await getExamWindow(attempt.window_id);
      const result = await syncAttemptToTtdt(attempt, exam, {
        classId: window?.class_id ?? null,
      });
      if (result.success) {
        setMessage('Đồng bộ thành công.');
        loadTheory();
      } else {
        setMessage(result.message ?? 'Đồng bộ thất bại.');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Lỗi thử lại.');
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryPractical = async (practicalAttemptId: string) => {
    setMessage('');
    setRetryingId(practicalAttemptId);
    try {
      const attempt = await getPracticalAttempt(practicalAttemptId);
      if (!attempt) {
        setMessage('Không tìm thấy bài làm thực hành.');
        return;
      }
      const session = await getPracticalSessionWithTemplate(attempt.session_id);
      const totalScore = attempt.total_score ?? 0;
      const result = await syncPracticalAttemptToTtdt(practicalAttemptId, totalScore, {
        classId: session?.class_id ?? null,
      });
      if (result.success) {
        setMessage('Đồng bộ thành công.');
        loadPractical();
      } else {
        setMessage(result.message ?? 'Đồng bộ thất bại.');
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Lỗi thử lại.');
    } finally {
      setRetryingId(null);
    }
  };

  if (!isTtdtSyncConfigured()) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Đồng bộ điểm TTDT</h1>
        <p className="text-amber-600">
          Chưa cấu hình VITE_TTDT_RECEIVE_GRADES_URL hoặc VITE_TTDT_API_KEY. Không thể đồng bộ hoặc xem log.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-4">Đồng bộ điểm TTDT</h1>
      <p className="text-slate-600 text-sm mb-4">
        Xem log đồng bộ điểm lý thuyết và thực hành sang TTDT. Có thể thử lại các bản ghi lỗi.
      </p>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setTab('theory')}
            className={`px-4 py-2 text-sm font-medium ${tab === 'theory' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            Lý thuyết (exam_sync_log)
          </button>
          <button
            type="button"
            onClick={() => setTab('practical')}
            className={`px-4 py-2 text-sm font-medium ${tab === 'practical' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            Thực hành (practical_sync_log)
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filterFailed}
            onChange={(e) => setFilterFailed(e.target.checked)}
          />
          Chỉ hiện lỗi
        </label>
        <button
          type="button"
          onClick={() => (tab === 'theory' ? loadTheory() : loadPractical())}
          className="px-3 py-1.5 bg-slate-200 text-slate-800 rounded hover:bg-slate-300 text-sm"
        >
          Tải lại
        </button>
      </div>

      {message && (
        <p className={`text-sm mb-2 ${message.includes('thành công') ? 'text-green-600' : 'text-amber-600'}`}>
          {message}
        </p>
      )}

      {loading && <p className="text-slate-500 text-sm">Đang tải...</p>}

      {tab === 'theory' && !loading && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2">Attempt ID</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Phản hồi</th>
                <th className="px-3 py-2">Thời gian</th>
                <th className="px-3 py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {theoryLogs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{log.attempt_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2">
                    <span className={log.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                      {log.status === 'success' ? 'Thành công' : 'Lỗi'}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate text-slate-600" title={log.response ?? ''}>
                    {log.response ? log.response.slice(0, 80) + (log.response.length > 80 ? '…' : '') : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(log.created_at).toLocaleString('vi-VN')}
                  </td>
                  <td className="px-3 py-2">
                    {log.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetryTheory(log.attempt_id)}
                        disabled={retryingId === log.attempt_id}
                        className="px-2 py-1 bg-amber-500 text-white text-xs rounded hover:bg-amber-600 disabled:opacity-50"
                      >
                        {retryingId === log.attempt_id ? 'Đang thử…' : 'Thử lại'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {theoryLogs.length === 0 && (
            <p className="p-4 text-slate-500 text-sm">Chưa có bản ghi đồng bộ lý thuyết.</p>
          )}
        </div>
      )}

      {tab === 'practical' && !loading && (
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
              {practicalLogs.map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{log.practical_attempt_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2">
                    <span className={log.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                      {log.status === 'success' ? 'Thành công' : 'Lỗi'}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-xs truncate text-slate-600" title={log.response ?? ''}>
                    {log.response ? log.response.slice(0, 80) + (log.response.length > 80 ? '…' : '') : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(log.created_at).toLocaleString('vi-VN')}
                  </td>
                  <td className="px-3 py-2">
                    {log.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetryPractical(log.practical_attempt_id)}
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
          {practicalLogs.length === 0 && (
            <p className="p-4 text-slate-500 text-sm">Chưa có bản ghi đồng bộ thực hành.</p>
          )}
        </div>
      )}
    </div>
  );
}
