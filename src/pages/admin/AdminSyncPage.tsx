import { useMemo, useState, useEffect } from 'react';
import { listExamSyncLog, listPracticalSyncLog, cleanupOldSyncLogs } from '../../services/syncLogService';
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
  const [responseModal, setResponseModal] = useState<{ title: string; content: string } | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const counts = useMemo(() => {
    const tFailed = theoryLogs.filter((x) => x.status === 'failed').length;
    const pFailed = practicalLogs.filter((x) => x.status === 'failed').length;
    return {
      theoryTotal: theoryLogs.length,
      theoryFailed: tFailed,
      practicalTotal: practicalLogs.length,
      practicalFailed: pFailed,
    };
  }, [theoryLogs, practicalLogs]);

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

  const explainTheoryError = (log: ExamSyncLogEntry): string => {
    const r = (log.response ?? '').toLowerCase();
    if (r.includes('module_id')) {
      return [
        'Lỗi liên quan module_id (mã mô-đun).',
        '',
        '1. Vào menu Admin → Đề thi.',
        '2. Tìm đúng đề thi tương ứng với log này (xem cột "Đề thi / Kỳ").',
        '3. Mở màn hình Sửa đề thi và chọn/nhập đúng Mã mô-đun (module_id) của TTDT.',
        '4. Lưu lại, sau đó quay lại màn Đồng bộ điểm và bấm "Thử lại" cho dòng này.',
      ].join('\n');
    }
    if (r.includes('class_id')) {
      return [
        'Lỗi liên quan class_id (mã lớp).',
        '',
        '1. Vào menu Admin → Kỳ thi.',
        '2. Tìm đúng kỳ thi (kỳ / lớp) trùng với log này.',
        '3. Mở màn hình Sửa kỳ thi và chọn đúng Lớp TTDT.',
        '4. Lưu lại, sau đó quay lại màn Đồng bộ điểm và bấm "Thử lại" cho dòng này.',
      ].join('\n');
    }
    if (r.includes('student_id') || r.includes('enrollment_id')) {
      return [
        'Lỗi liên quan student_id / enrollment (học viên chưa map sang TTDT).',
        '',
        '1. Kiểm tra tài khoản thi của học viên đã được xác thực CCCD và gắn với học viên TTDT chưa.',
        '2. Nếu chưa, thực hiện bước xác thực CCCD / gắn student_id trong app thi hoặc app quản lý.',
        '3. Khi tài khoản đã có student_id, quay lại màn Đồng bộ điểm và bấm "Thử lại".',
      ].join('\n');
    }
    if (r.includes('401') || r.includes('jwt') || r.includes('authorization')) {
      return [
        'Lỗi xác thực API TTDT (401 / JWT / authorization).',
        '',
        '1. Mở file .env của app thi online.',
        '2. Kiểm tra lại VITE_TTDT_RECEIVE_GRADES_URL trỏ đúng endpoint receive-exam-results của TTDT.',
        '3. Kiểm tra lại VITE_TTDT_API_KEY trùng với API key cấu hình trong hàm receive-exam-results bên Supabase/app quản lý.',
        '4. Khởi động lại server/build để môi trường nhận giá trị mới, rồi bấm "Thử lại".',
      ].join('\n');
    }
    return [
      'Không nhận diện được loại lỗi cụ thể.',
      '',
      '1. Bấm nút "Xem" để đọc toàn bộ phản hồi chi tiết từ TTDT.',
      '2. Dựa trên thông báo đó, kiểm tra lại cấu hình đề thi, kỳ thi, học viên hoặc API key tương ứng.',
      '3. Sau khi chỉnh sửa, quay lại màn Đồng bộ điểm và bấm "Thử lại".',
    ].join('\n');
  };

  const handleExplainTheory = (log: ExamSyncLogEntry) => {
    const content = explainTheoryError(log);
    setResponseModal({
      title: `Hướng dẫn xử lý lỗi (${log.attempt_id.slice(0, 8)}…)`,
      content,
    });
  };

  const handleCleanup = async () => {
    if (!window.confirm('Xóa các log Lỗi đã cũ hơn 30 ngày? Thao tác này không thể hoàn tác.')) {
      return;
    }
    setCleaning(true);
    setMessage('Đang dọn dẹp log cũ...');
    try {
      await cleanupOldSyncLogs({ days: 30, status: 'failed' });
      setMessage('Đã dọn dẹp các log lỗi cũ (trên 30 ngày).');
      if (tab === 'theory') loadTheory();
      else loadPractical();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Lỗi khi dọn dẹp log.');
    } finally {
      setCleaning(false);
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
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Đồng bộ điểm TTDT</h1>
          <p className="text-slate-600 text-sm mt-1">
            Theo dõi log đồng bộ và thử lại các bản ghi lỗi. Chỉ Admin có quyền thao tác.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-full px-3 py-2">
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
            className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-full hover:bg-slate-50 text-sm"
          >
            Tải lại
          </button>
          <button
            type="button"
            onClick={handleCleanup}
            disabled={cleaning}
            className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-full hover:bg-rose-100 text-sm disabled:opacity-50"
          >
            {cleaning ? 'Đang dọn...' : 'Dọn lỗi cũ (30 ngày)'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex rounded-full border border-slate-200 bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setTab('theory')}
            className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 ${
              tab === 'theory' ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            Lý thuyết
            <span className={`text-xs px-2 py-0.5 rounded-full ${tab === 'theory' ? 'bg-white/20' : 'bg-slate-100 text-slate-700'}`}>
              {counts.theoryFailed}/{counts.theoryTotal}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('practical')}
            className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 ${
              tab === 'practical' ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            Thực hành
            <span className={`text-xs px-2 py-0.5 rounded-full ${tab === 'practical' ? 'bg-white/20' : 'bg-slate-100 text-slate-700'}`}>
              {counts.practicalFailed}/{counts.practicalTotal}
            </span>
          </button>
        </div>
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
                <th className="px-3 py-2">Học viên</th>
                <th className="px-3 py-2">Đề thi / Kỳ</th>
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
                    <div className="text-sm font-medium text-slate-800">
                      {log.user_name || log.user_email || '—'}
                    </div>
                    {log.user_email && (
                      <div className="text-[11px] text-slate-500">{log.user_email}</div>
                    )}
                    {!log.user_email && log.user_id && (
                      <div className="font-mono text-[11px] text-slate-500">
                        {log.user_id.slice(0, 8)}…
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-800">{log.exam_title || '—'}</div>
                    {log.window_id && (
                      <div className="text-[11px] text-slate-500">
                        {log.window_id.slice(0, 8)}… / {log.class_name || log.class_id || '—'}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={log.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                      {log.status === 'success' ? 'Thành công' : 'Lỗi'}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="truncate" title={log.response ?? ''}>
                        {log.response ? log.response.slice(0, 80) + (log.response.length > 80 ? '…' : '') : '—'}
                      </span>
                      {log.response && (
                        <button
                          type="button"
                          onClick={() => setResponseModal({ title: `Phản hồi (${log.attempt_id.slice(0, 8)}…)`, content: log.response ?? '' })}
                          className="text-xs px-2 py-1 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700"
                        >
                          Xem
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(log.created_at).toLocaleString('vi-VN')}
                  </td>
                  <td className="px-3 py-2">
                    {log.status === 'failed' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleRetryTheory(log.attempt_id)}
                          disabled={retryingId === log.attempt_id}
                          className="px-2 py-1 bg-amber-500 text-white text-xs rounded hover:bg-amber-600 disabled:opacity-50"
                        >
                          {retryingId === log.attempt_id ? 'Đang thử…' : 'Thử lại'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExplainTheory(log)}
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
                  <td className="px-3 py-2 max-w-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="truncate" title={log.response ?? ''}>
                        {log.response ? log.response.slice(0, 80) + (log.response.length > 80 ? '…' : '') : '—'}
                      </span>
                      {log.response && (
                        <button
                          type="button"
                          onClick={() => setResponseModal({ title: `Phản hồi (${log.practical_attempt_id.slice(0, 8)}…)`, content: log.response ?? '' })}
                          className="text-xs px-2 py-1 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-700"
                        >
                          Xem
                        </button>
                      )}
                    </div>
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

      {responseModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="font-semibold text-slate-800">{responseModal.title}</div>
              <button
                type="button"
                onClick={() => setResponseModal(null)}
                className="px-3 py-1.5 text-sm rounded-full border border-slate-200 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
            <div className="p-4">
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap break-words text-slate-800">
{responseModal.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
