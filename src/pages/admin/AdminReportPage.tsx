import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listExams } from '../../services/examService';
import { listExamWindows } from '../../services/examWindowService';
import { listClasses } from '../../services/ttdtDataService';
import {
  listAttemptsForReport,
  listViolationsForReport,
  exportReportToExcel,
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
  const [resultSearch, setResultSearch] = useState('');
  const [violationSearch, setViolationSearch] = useState('');
  const [classNames, setClassNames] = useState<Record<string, { name: string; code?: string }>>({});

  useEffect(() => {
    listExams().then(setExams).catch(() => {});
    listClasses()
      .then((cls) => {
        const map = Object.fromEntries(cls.map((c) => [c.id, { name: c.name, code: c.code }]));
        setClassNames(map);
      })
      .catch(() => {
        setClassNames({});
      });
  }, []);

  useEffect(() => {
    const run = async () => {
      if (!selectedExamId) {
        setWindows([]);
        setSelectedWindowId('');
        return;
      }
      setSelectedWindowId('');
      try {
        const ws = await listExamWindows({ exam_id: selectedExamId });
        setWindows(ws);
      } catch {
        setWindows([]);
      }
    };
    run();
  }, [selectedExamId]);

  useEffect(() => {
    const filters: ReportFilters = {};
    if (selectedExamId) filters.exam_id = selectedExamId;
    if (selectedWindowId) filters.window_id = selectedWindowId;

    const run = async () => {
      if (activeTab !== 'results' || !selectedExamId) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const data = await listAttemptsForReport(filters);
        setRows(data);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [selectedExamId, selectedWindowId, activeTab, reloadKey]);

  useEffect(() => {
    const filters: ReportFilters = {};
    if (selectedExamId) filters.exam_id = selectedExamId;
    if (selectedWindowId) filters.window_id = selectedWindowId;

    const run = async () => {
      if (activeTab !== 'violations' || !selectedExamId) {
        setViolationRows([]);
        return;
      }
      setLoadingViolations(true);
      try {
        const data = await listViolationsForReport(filters);
        setViolationRows(data);
      } catch {
        setViolationRows([]);
      } finally {
        setLoadingViolations(false);
      }
    };
    run();
  }, [selectedExamId, selectedWindowId, activeTab, reloadKey]);

  const handleExportExcel = useCallback(() => {
    exportReportToExcel(rows);
  }, [rows]);

  const handleReload = useCallback(() => {
    if (!selectedExamId) return;
    setReloadKey((k) => k + 1);
  }, [selectedExamId]);

  /** Tổng hợp vi phạm theo user: đếm từng loại event. */
  const aggregatedViolationRows = useMemo(() => {
    type AggRow = {
      id: string;
      user_id: string;
      user_name: string;
      user_email: string;
      focusLostCount: number;
      visibilityHiddenCount: number;
      fullscreenExitedCount: number;
      copyPasteBlockedCount: number;
      photoTakenCount: number;
    };
    const map = new Map<string, AggRow>();

    for (const r of violationRows) {
      const key = r.user_id || r.user_email;
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          user_id: r.user_id,
          user_name: r.user_name,
          user_email: r.user_email,
          focusLostCount: 0,
          visibilityHiddenCount: 0,
          fullscreenExitedCount: 0,
          copyPasteBlockedCount: 0,
          photoTakenCount: 0,
        });
      }
      const row = map.get(key)!;
      if (r.event === 'focus_lost') row.focusLostCount += 1;
      else if (r.event === 'visibility_hidden') row.visibilityHiddenCount += 1;
      else if (r.event === 'fullscreen_exited') row.fullscreenExitedCount += 1;
      else if (r.event === 'copy_paste_blocked') row.copyPasteBlockedCount += 1;
      else if (r.event === 'photo_taken') row.photoTakenCount += 1;
    }

    const list = Array.from(map.values());
    if (!violationSearch.trim()) return list;
    const q = violationSearch.trim().toLowerCase();
    return list.filter((row) => {
      const name = row.user_name?.toLowerCase() ?? '';
      const email = row.user_email?.toLowerCase() ?? '';
      return name.includes(q) || email.includes(q);
    });
  }, [violationRows, violationSearch]);

  const handleExportViolationsExcel = useCallback(() => {
    exportViolationsToExcel(aggregatedViolationRows);
  }, [aggregatedViolationRows]);

  const filteredResultRows = useMemo(() => {
    if (!resultSearch.trim()) return rows;
    const q = resultSearch.trim().toLowerCase();
    return rows.filter((r) => {
      const name = r.user_name?.toLowerCase() ?? '';
      const email = r.user_email?.toLowerCase() ?? '';
      const exam = r.exam_title?.toLowerCase() ?? '';
      const cls = (r.class_name || r.class_id || '').toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        exam.includes(q) ||
        cls.includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [rows, resultSearch]);

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
            className="border border-slate-300 rounded-lg px-3 py-2 min-w-[260px]"
          >
            <option value="">-- Tất cả kỳ --</option>
            {windows.map((w) => (
              <option key={w.id} value={w.id}>
                {new Date(w.start_at).toLocaleDateString('vi-VN')} – {w.access_code}
                {w.class_id
                  ? ` • Lớp: ${
                      classNames[w.class_id]?.code ||
                      classNames[w.class_id]?.name ||
                      w.class_id
                    }`
                  : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500 max-w-xs">
            Gợi ý: mỗi dòng gồm <strong>ngày thi – mã truy cập – lớp</strong> để dễ nhận diện.
          </p>
        </div>
      </div>

      {(loading || loadingViolations) && <p className="text-slate-500 text-sm">Đang tải...</p>}

      {activeTab === 'results' && selectedExamId && !loading && (
        <>
          <div className="flex flex-wrap gap-2 mb-4 print:hidden">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={rows.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Xuất Excel
            </button>
          </div>

          <div className="flex flex-col gap-2 mb-3">
            <p className="text-slate-600 text-sm">
              Số bài làm: <strong>{rows.length}</strong>
              {resultSearch.trim() && (
                <span className="ml-2 text-xs text-slate-500">
                  (phù hợp bộ lọc: <strong>{filteredResultRows.length}</strong>)
                </span>
              )}
            </p>
            <div className="max-w-md">
              <input
                type="text"
                value={resultSearch}
                onChange={(e) => setResultSearch(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Lọc theo tên, email, lớp, đề thi hoặc mã bài làm"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2">Học viên</th>
                  <th className="px-3 py-2">Đề thi</th>
                  <th className="px-3 py-2">Kỳ / Lớp</th>
                  <th className="px-3 py-2">Điểm</th>
                  <th className="px-3 py-2">Kết quả</th>
                  <th className="px-3 py-2">Hoàn thành</th>
                  <th className="px-3 py-2">Đồng bộ</th>
                  <th className="px-3 py-2 w-16">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {filteredResultRows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors">
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-slate-800">{r.user_name || r.user_email || '—'}</div>
                      {r.user_email && <div className="text-[11px] text-slate-500">{r.user_email}</div>}
                      {!r.user_email && r.user_id && (
                        <div className="font-mono text-[11px] text-slate-500">{r.user_id.slice(0, 8)}…</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{r.exam_title}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {r.class_name || r.class_id || '—'}
                    </td>
                    <td className="px-3 py-2 font-medium tabular-nums text-slate-800">
                      {r.score != null ? (r.score * 100).toFixed(1) + '%' : '—'}
                      {r.raw_score != null && (
                        <span className="text-slate-500 font-normal"> ({r.raw_score})</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {r.disqualified ? (
                        <span className="text-amber-700 font-medium">Loại</span>
                      ) : r.passed ? (
                        <span className="text-emerald-600 font-medium">Đạt</span>
                      ) : (
                        <span className="text-red-600 font-medium">Chưa đạt</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.completed_at ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.synced_to_ttdt_at ? (
                        <span className="text-emerald-600">✓ Có</span>
                      ) : (
                        <span className="text-slate-400">Chưa</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/admin/attempts/${r.id}/result`}
                        className="text-indigo-600 hover:underline text-xs font-medium"
                      >
                        Xem
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && (
            <p className="text-slate-500 text-sm mt-2">Chưa có bài làm nào đã nộp với bộ lọc đã chọn.</p>
          )}
          {rows.length > 0 && filteredResultRows.length === 0 && (
            <p className="text-slate-500 text-sm mt-2">
              Không có bài làm nào phù hợp với từ khóa lọc hiện tại.
            </p>
          )}
        </>
      )}

      {activeTab === 'violations' && selectedExamId && !loadingViolations && (
        <>
          <div className="flex flex-wrap gap-2 mb-4 print:hidden">
            <button
              type="button"
              onClick={handleExportViolationsExcel}
              disabled={violationRows.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Xuất Excel
            </button>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            <p className="text-slate-600 text-sm">
              Số log vi phạm (tổng tất cả sự kiện): <strong>{violationRows.length}</strong>
            </p>
            <div className="max-w-md">
              <input
                type="text"
                value={violationSearch}
                onChange={(e) => setViolationSearch(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Lọc theo tên hoặc email học viên"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 w-16 text-center">STT</th>
                  <th className="px-3 py-2">Học viên</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2 text-center">Mất focus</th>
                  <th className="px-3 py-2 text-center">Ẩn tab / thu nhỏ</th>
                  <th className="px-3 py-2 text-center">Thoát fullscreen</th>
                  <th className="px-3 py-2 text-center">Copy/Paste bị chặn</th>
                  <th className="px-3 py-2 text-center">Ảnh webcam</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedViolationRows.map((r, idx) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-center text-xs text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium text-slate-800">{r.user_name || r.user_email || '—'}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{r.user_email || '—'}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{r.focusLostCount}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{r.visibilityHiddenCount}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{r.fullscreenExitedCount}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{r.copyPasteBlockedCount}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{r.photoTakenCount}</td>
                  </tr>
                ))}
                {aggregatedViolationRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-sm text-slate-500">
                      Chưa có log vi phạm nào phù hợp với bộ lọc đã chọn.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
