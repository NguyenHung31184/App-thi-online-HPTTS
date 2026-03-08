import { useState, useEffect } from 'react';
import { listExams } from '../../services/examService';
import { listExamWindows } from '../../services/examWindowService';
import {
  listAttemptsForReport,
  exportReportToCsv,
  exportReportToExcel,
  type AttemptReportRow,
  type ReportFilters,
} from '../../services/reportService';
import type { Exam, ExamWindow } from '../../types';

export default function AdminReportPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [windows, setWindows] = useState<ExamWindow[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedWindowId, setSelectedWindowId] = useState<string>('');
  const [rows, setRows] = useState<AttemptReportRow[]>([]);
  const [loading, setLoading] = useState(false);

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
    if (!selectedExamId) {
      setRows([]);
      return;
    }
    setLoading(true);
    listAttemptsForReport(filters)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [selectedExamId, selectedWindowId]);

  const handleExportCsv = () => {
    exportReportToCsv(rows);
  };

  const handleExportExcel = () => {
    exportReportToExcel(rows);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-4">Xuất báo cáo kết quả</h1>
      <p className="text-slate-600 text-sm mb-4">
        Chọn đề thi (và tùy chọn kỳ thi) để xem danh sách bài làm đã nộp, sau đó xuất CSV hoặc Excel.
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

      {loading && <p className="text-slate-500 text-sm">Đang tải...</p>}

      {selectedExamId && !loading && (
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
                  <th className="px-3 py-2">User ID</th>
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
                    <td className="px-3 py-2 font-mono text-xs">{r.user_id.slice(0, 8)}…</td>
                    <td className="px-3 py-2">{r.exam_title}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.window_id.slice(0, 8)}… / {r.class_id ? r.class_id.slice(0, 8) + '…' : '—'}</td>
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
    </div>
  );
}
