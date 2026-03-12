import { useState, useEffect } from 'react';
import { listExams } from '../../services/examService';
import { listExamWindows } from '../../services/examWindowService';
import {
  listAttemptsForReport,
  listViolationsForReport,
  exportReportToCsv,
  exportReportToExcel,
  exportViolationsToCsv,
  exportViolationsToExcel,
  type AttemptReportRow,
  type ViolationReportRow,
  type ReportFilters,
} from '../../services/reportService';
import type { Exam, ExamWindow } from '../../types';

export default function AdminReportPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [windows, setWindows] = useState<ExamWindow[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedWindowId, setSelectedWindowId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'results' | 'violations'>('results');
  const [rows, setRows] = useState<AttemptReportRow[]>([]);
  const [violationRows, setViolationRows] = useState<ViolationReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingViolations, setLoadingViolations] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    listExams().then(setExams).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedExamId) {
      setWindows([]);
      setSelectedWindowId('');
      return;
    }
    listExamWindows({ exam_id: selectedExamId }).then(setWindows).catch(() => setWindows([]));
    setSelectedWindowId('');
  }, [selectedExamId]);

  useEffect(() => {
    const filters: ReportFilters = {};
    if (selectedExamId) filters.exam_id = selectedExamId;
    if (selectedWindowId) filters.window_id = selectedWindowId;
    if (activeTab !== 'results') {
      setRows([]);
      return;
    }
    if (!selectedExamId) {
      setRows([]);
      return;
    }
    setLoading(true);
    listAttemptsForReport(filters)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [selectedExamId, selectedWindowId, activeTab, reloadKey]);

  useEffect(() => {
    const filters: ReportFilters = {};
    if (selectedExamId) filters.exam_id = selectedExamId;
    if (selectedWindowId) filters.window_id = selectedWindowId;
    if (activeTab !== 'violations') {
      setViolationRows([]);
      return;
    }
    if (!selectedExamId) {
      setViolationRows([]);
      return;
    }
    setLoadingViolations(true);
    listViolationsForReport(filters)
      .then(setViolationRows)
      .catch(() => setViolationRows([]))
      .finally(() => setLoadingViolations(false));
  }, [selectedExamId, selectedWindowId, activeTab, reloadKey]);

  const handleExportCsv = () => {
    exportReportToCsv(rows);
  };

  const handleExportExcel = () => {
    exportReportToExcel(rows);
  };

  const handleExportViolationsCsv = () => {
    exportViolationsToCsv(violationRows);
  };

  const handleExportViolationsExcel = () => {
    exportViolationsToExcel(violationRows);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReload = () => {
    if (!selectedExamId) return;
    setReloadKey((k) => k + 1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold text-slate-800">Báo cáo thi</h1>
        <button
          type="button"
          onClick={handleReload}
          disabled={!selectedExamId || loading || loadingViolations}
          className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Nạp lại dữ liệu
        </button>
      </div>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('results')}
          className={`px-3 py-1.5 text-sm font-medium rounded-full border ${
            activeTab === 'results'
              ? 'bg-slate-800 text-white border-slate-800'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          Kết quả
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('violations')}
          className={`px-3 py-1.5 text-sm font-medium rounded-full border ${
            activeTab === 'violations'
              ? 'bg-rose-700 text-white border-rose-700'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          Vi phạm
        </button>
      </div>
      <p className="text-slate-600 text-sm mb-4">
        Chọn đề thi (và tùy chọn kỳ thi) để {activeTab === 'results' ? 'xem và xuất danh sách bài làm đã nộp.' : 'xem nhật ký vi phạm (mất focus, thoát fullscreen, copy/paste, ảnh webcam...).'}
      </p>

      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Đề thi</label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 min-w-[200px]"
          >
            <option value="">-- Chọn đề thi --</option>
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Kỳ thi (tùy chọn)</label>
          <select
            value={selectedWindowId}
            onChange={(e) => setSelectedWindowId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 min-w-[200px]"
          >
            <option value="">-- Tất cả kỳ --</option>
            {windows.map((w) => (
              <option key={w.id} value={w.id}>
                {new Date(w.start_at).toLocaleDateString('vi-VN')} – {w.access_code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(loading || loadingViolations) && <p className="text-slate-500 text-sm">Đang tải...</p>}

      {activeTab === 'results' && selectedExamId && !loading && (
        <>
          <div className="flex flex-wrap gap-2 mb-4 print:hidden">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Xuất CSV
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={rows.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Xuất Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={rows.length === 0}
              className="px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              In / PDF
            </button>
          </div>

          <p className="text-slate-600 text-sm mb-2">
            Số bài làm: <strong>{rows.length}</strong>
          </p>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2">Mã bài làm</th>
                  <th className="px-3 py-2">Học viên</th>
                  <th className="px-3 py-2">Đề thi</th>
                  <th className="px-3 py-2">Kỳ / Lớp</th>
                  <th className="px-3 py-2">Điểm</th>
                  <th className="px-3 py-2">Đạt</th>
                  <th className="px-3 py-2">Hoàn thành</th>
                  <th className="px-3 py-2">Đồng bộ TTDT</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{r.id.slice(0, 8)}…</td>
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-slate-800">{r.user_name || r.user_email || '—'}</div>
                      {r.user_email && <div className="text-[11px] text-slate-500">{r.user_email}</div>}
                      {!r.user_email && r.user_id && <div className="font-mono text-[11px] text-slate-500">{r.user_id.slice(0, 8)}…</div>}
                    </td>
                    <td className="px-3 py-2">{r.exam_title}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs">{r.window_id.slice(0, 8)}…</span>
                      {r.class_name || r.class_id ? (
                        <span className="text-slate-700"> / <strong>{r.class_name || r.class_id}</strong></span>
                      ) : (
                        ' / —'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.score != null ? (r.score * 100).toFixed(1) + '%' : '—'}
                      {r.raw_score != null && ` (${r.raw_score})`}
                    </td>
                    <td className="px-3 py-2">
                      {r.disqualified ? (
                        <span className="text-red-600">Loại</span>
                      ) : r.passed ? (
                        <span className="text-green-600">Đạt</span>
                      ) : (
                        <span className="text-amber-600">Chưa đạt</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.completed_at ?? '—'}</td>
                    <td className="px-3 py-2">{r.synced_to_ttdt_at ? 'Có' : 'Chưa'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && (
            <p className="text-slate-500 text-sm mt-2">Chưa có bài làm nào đã nộp với bộ lọc đã chọn.</p>
          )}
        </>
      )}

      {activeTab === 'violations' && selectedExamId && !loadingViolations && (
        <>
          <div className="flex flex-wrap gap-2 mb-4 print:hidden">
            <button
              type="button"
              onClick={handleExportViolationsCsv}
              disabled={violationRows.length === 0}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Xuất CSV
            </button>
            <button
              type="button"
              onClick={handleExportViolationsExcel}
              disabled={violationRows.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Xuất Excel
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={violationRows.length === 0}
              className="px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              In / PDF
            </button>
          </div>

          <p className="text-slate-600 text-sm mb-2">
            Số log vi phạm: <strong>{violationRows.length}</strong>
          </p>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2">Mã log</th>
                  <th className="px-3 py-2">Mã bài làm</th>
                  <th className="px-3 py-2">Học viên</th>
                  <th className="px-3 py-2">Đề thi</th>
                  <th className="px-3 py-2">Kỳ / Lớp</th>
                  <th className="px-3 py-2">Sự kiện</th>
                  <th className="px-3 py-2">Thời điểm</th>
                </tr>
              </thead>
              <tbody>
                {violationRows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{r.id.slice(0, 8)}…</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.attempt_id.slice(0, 8)}…</td>
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-slate-800">{r.user_name || r.user_email || '—'}</div>
                      {r.user_email && <div className="text-[11px] text-slate-500">{r.user_email}</div>}
                      {!r.user_email && r.user_id && <div className="font-mono text-[11px] text-slate-500">{r.user_id.slice(0, 8)}…</div>}
                    </td>
                    <td className="px-3 py-2">{r.exam_title}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs">{r.window_id.slice(0, 8)}…</span>
                      {r.class_name || r.class_id ? (
                        <span className="text-slate-700"> / <strong>{r.class_name || r.class_id}</strong></span>
                      ) : (
                        ' / —'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.event === 'focus_lost'
                        ? 'Mất focus (chuyển sang cửa sổ / ứng dụng khác)'
                        : r.event === 'visibility_hidden'
                        ? 'Ẩn tab (thu nhỏ trình duyệt hoặc chuyển tab khác)'
                        : r.event === 'copy_paste_blocked'
                        ? 'Copy/Paste bị chặn (cố gắng sao chép / dán trong đề thi)'
                        : r.event === 'photo_taken'
                        ? 'Ảnh webcam (hệ thống tự chụp khi giám sát)'
                        : r.event === 'fullscreen_exited'
                        ? 'Thoát fullscreen khi đang làm bài'
                        : r.event}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {violationRows.length === 0 && (
            <p className="text-slate-500 text-sm mt-2">Chưa có log vi phạm nào với bộ lọc đã chọn.</p>
          )}
        </>
      )}
    </div>
  );
}
