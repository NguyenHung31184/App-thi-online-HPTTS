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

type TrialFilter = 'all' | 'real' | 'trial';

export default function AdminReportPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [allWindows, setAllWindows] = useState<ExamWindow[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedWindowId, setSelectedWindowId] = useState<string>('');
  const [filterTrial, setFilterTrial] = useState<TrialFilter>('all');
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
    listExamWindows().then(setAllWindows).catch(() => setAllWindows([]));
    listClasses()
      .then((cls) => {
        const map = Object.fromEntries(cls.map((c) => [c.id, { name: c.name, code: c.code }]));
        setClassNames(map);
      })
      .catch(() => setClassNames({}));
  }, []);

  // Danh sách lớp có kỳ thi
  const availableClasses = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; label: string }[] = [];
    for (const w of allWindows) {
      if (w.class_id && !seen.has(w.class_id)) {
        seen.add(w.class_id);
        const info = classNames[w.class_id];
        result.push({
          id: w.class_id,
          label: info ? (info.code ? `${info.name} (${info.code})` : info.name) : w.class_id,
        });
      }
    }
    return result.sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  }, [allWindows, classNames]);

  // Windows sau khi lọc lớp + loại kỳ (dùng để build dropdown Đề thi)
  const windowsByClassAndTrial = useMemo(() =>
    allWindows
      .filter((w) => !selectedClassId || w.class_id === selectedClassId)
      .filter((w) =>
        filterTrial === 'all' ? true : filterTrial === 'trial' ? (w.is_trial ?? false) : !(w.is_trial ?? false),
      ),
    [allWindows, selectedClassId, filterTrial],
  );

  // Đề thi khả dụng (chỉ hiện đề có kỳ phù hợp với lớp + loại kỳ)
  const availableExams = useMemo(() => {
    const ids = new Set(windowsByClassAndTrial.map((w) => w.exam_id));
    return exams.filter((e) => ids.has(e.id));
  }, [exams, windowsByClassAndTrial]);

  // Windows sau khi lọc thêm đề thi → hiển thị trong dropdown Kỳ thi
  const filteredWindows = useMemo(() =>
    windowsByClassAndTrial.filter((w) => !selectedExamId || w.exam_id === selectedExamId),
    [windowsByClassAndTrial, selectedExamId],
  );

  // Reset exam nếu không còn trong danh sách khả dụng
  useEffect(() => {
    if (selectedExamId && !availableExams.find((e) => e.id === selectedExamId)) {
      setSelectedExamId('');
      setSelectedWindowId('');
    }
  }, [availableExams, selectedExamId]);

  // Reset window nếu không còn trong danh sách đã lọc
  useEffect(() => {
    if (selectedWindowId && !filteredWindows.find((w) => w.id === selectedWindowId)) {
      setSelectedWindowId('');
    }
  }, [filteredWindows, selectedWindowId]);

  const hasSelection = Boolean(selectedExamId || selectedWindowId);

  useEffect(() => {
    const filters: ReportFilters = {};
    if (selectedWindowId) filters.window_id = selectedWindowId;
    else if (selectedExamId) filters.exam_id = selectedExamId;

    const run = async () => {
      if (activeTab !== 'results' || !hasSelection) { setRows([]); return; }
      setLoading(true);
      try { setRows(await listAttemptsForReport(filters)); }
      catch { setRows([]); }
      finally { setLoading(false); }
    };
    run();
  }, [selectedExamId, selectedWindowId, activeTab, reloadKey]);

  useEffect(() => {
    const filters: ReportFilters = {};
    if (selectedWindowId) filters.window_id = selectedWindowId;
    else if (selectedExamId) filters.exam_id = selectedExamId;

    const run = async () => {
      if (activeTab !== 'violations' || !hasSelection) { setViolationRows([]); return; }
      setLoadingViolations(true);
      try { setViolationRows(await listViolationsForReport(filters)); }
      catch { setViolationRows([]); }
      finally { setLoadingViolations(false); }
    };
    run();
  }, [selectedExamId, selectedWindowId, activeTab, reloadKey]);

  const handleExportExcel = useCallback(() => exportReportToExcel(rows), [rows]);
  const handleReload = useCallback(() => { if (hasSelection) setReloadKey((k) => k + 1); }, [hasSelection]);

  const aggregatedViolationRows = useMemo(() => {
    type AggRow = {
      id: string; user_id: string; user_name: string; user_email: string;
      focusLostCount: number; visibilityHiddenCount: number;
      fullscreenExitedCount: number; copyPasteBlockedCount: number; photoTakenCount: number;
    };
    const map = new Map<string, AggRow>();
    for (const r of violationRows) {
      const key = r.user_id || r.user_email;
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, {
          id: key, user_id: r.user_id, user_name: r.user_name, user_email: r.user_email,
          focusLostCount: 0, visibilityHiddenCount: 0, fullscreenExitedCount: 0,
          copyPasteBlockedCount: 0, photoTakenCount: 0,
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
    return list.filter((row) =>
      (row.user_name?.toLowerCase() ?? '').includes(q) ||
      (row.user_email?.toLowerCase() ?? '').includes(q),
    );
  }, [violationRows, violationSearch]);

  const handleExportViolationsExcel = useCallback(
    () => exportViolationsToExcel(aggregatedViolationRows),
    [aggregatedViolationRows],
  );

  const filteredResultRows = useMemo(() => {
    if (!resultSearch.trim()) return rows;
    const q = resultSearch.trim().toLowerCase();
    return rows.filter((r) =>
      (r.user_name?.toLowerCase() ?? '').includes(q) ||
      (r.user_email?.toLowerCase() ?? '').includes(q) ||
      (r.exam_title?.toLowerCase() ?? '').includes(q) ||
      (r.class_name || r.class_id || '').toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q),
    );
  }, [rows, resultSearch]);

  const trialBtnCls = (v: TrialFilter) =>
    `px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
      filterTrial === v
        ? v === 'trial'
          ? 'bg-slate-600 text-white border-slate-600'
          : v === 'real'
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-slate-800 text-white border-slate-800'
        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
    }`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Báo cáo thi</h1>
          <p className="text-sm text-slate-500 mt-0.5">Lọc theo lớp, đề thi, loại kỳ thi rồi chọn kỳ thi cụ thể để xem báo cáo.</p>
        </div>
        <button
          type="button"
          onClick={handleReload}
          disabled={!hasSelection || loading || loadingViolations}
          className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Nạp lại
        </button>
      </div>

      {/* Bộ lọc */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 space-y-3">
        {/* Row 1: Loại kỳ thi */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 min-w-[4.5rem]">Loại kỳ thi</span>
          <div className="flex gap-1.5">
            <button type="button" className={trialBtnCls('all')} onClick={() => setFilterTrial('all')}>Tất cả</button>
            <button type="button" className={trialBtnCls('real')} onClick={() => setFilterTrial('real')}>Thi thật</button>
            <button type="button" className={trialBtnCls('trial')} onClick={() => setFilterTrial('trial')}>Thi thử</button>
          </div>
        </div>

        {/* Row 2: Lớp + Đề thi */}
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Lớp</label>
            <select
              value={selectedClassId}
              onChange={(e) => { setSelectedClassId(e.target.value); setSelectedExamId(''); setSelectedWindowId(''); }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[200px] bg-white"
            >
              <option value="">-- Tất cả lớp --</option>
              {availableClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">
              Đề thi / Môn
              {availableExams.length > 0 && (
                <span className="ml-1 text-slate-400">({availableExams.length})</span>
              )}
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => { setSelectedExamId(e.target.value); setSelectedWindowId(''); }}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[220px] bg-white"
            >
              <option value="">-- Tất cả đề thi --</option>
              {availableExams.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Kỳ thi */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">
            Kỳ thi cụ thể
            {filteredWindows.length > 0 && (
              <span className="ml-1 text-slate-400">({filteredWindows.length} kỳ)</span>
            )}
          </label>
          <select
            value={selectedWindowId}
            onChange={(e) => setSelectedWindowId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm min-w-[320px] bg-white"
            disabled={filteredWindows.length === 0}
          >
            <option value="">-- Tất cả kỳ phù hợp --</option>
            {filteredWindows.map((w) => (
              <option key={w.id} value={w.id}>
                {w.is_trial ? '[Thử] ' : ''}
                {new Date(w.start_at).toLocaleDateString('vi-VN')} – {w.access_code}
                {w.class_id
                  ? ` • ${classNames[w.class_id]?.code || classNames[w.class_id]?.name || w.class_id}`
                  : ''}
              </option>
            ))}
          </select>
          {filteredWindows.length === 0 && (selectedClassId || selectedExamId || filterTrial !== 'all') && (
            <p className="text-xs text-slate-400">Không có kỳ thi phù hợp với bộ lọc.</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setActiveTab('results')}
          className={`px-3 py-1.5 text-sm font-medium rounded-full border ${activeTab === 'results' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
          Kết quả
        </button>
        <button type="button" onClick={() => setActiveTab('violations')}
          className={`px-3 py-1.5 text-sm font-medium rounded-full border ${activeTab === 'violations' ? 'bg-rose-700 text-white border-rose-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
          Vi phạm
        </button>
      </div>

      {!hasSelection && (
        <p className="text-slate-400 text-sm">Chọn ít nhất một đề thi hoặc kỳ thi để xem báo cáo.</p>
      )}

      {(loading || loadingViolations) && <p className="text-slate-500 text-sm">Đang tải...</p>}

      {activeTab === 'results' && hasSelection && !loading && (
        <>
          <div className="flex flex-wrap gap-2 mb-4 print:hidden">
            <button type="button" onClick={handleExportExcel} disabled={rows.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              Xuất Excel
            </button>
          </div>

          <div className="flex flex-col gap-2 mb-3">
            <p className="text-slate-600 text-sm">
              Số bài làm: <strong>{rows.length}</strong>
              {resultSearch.trim() && (
                <span className="ml-2 text-xs text-slate-500">(lọc: <strong>{filteredResultRows.length}</strong>)</span>
              )}
            </p>
            <div className="max-w-md">
              <input type="text" value={resultSearch} onChange={(e) => setResultSearch(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Tìm theo tên, email, lớp, đề thi hoặc mã bài làm" />
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
                    <td className="px-3 py-2 text-xs text-slate-600">{r.class_name || r.class_id || '—'}</td>
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
                      <Link to={`/admin/attempts/${r.id}/result`}
                        className="text-indigo-600 hover:underline text-xs font-medium">
                        Xem
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && (
            <p className="text-slate-500 text-sm mt-2">Chưa có bài làm nào với bộ lọc đã chọn.</p>
          )}
          {rows.length > 0 && filteredResultRows.length === 0 && (
            <p className="text-slate-500 text-sm mt-2">Không có bài làm nào phù hợp với từ khóa tìm kiếm.</p>
          )}
        </>
      )}

      {activeTab === 'violations' && hasSelection && !loadingViolations && (
        <>
          <div className="flex flex-wrap gap-2 mb-4 print:hidden">
            <button type="button" onClick={handleExportViolationsExcel} disabled={violationRows.length === 0}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
              Xuất Excel
            </button>
          </div>
          <div className="flex flex-col gap-2 mb-3">
            <p className="text-slate-600 text-sm">
              Số log vi phạm: <strong>{violationRows.length}</strong>
            </p>
            <div className="max-w-md">
              <input type="text" value={violationSearch} onChange={(e) => setViolationSearch(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Lọc theo tên hoặc email học viên" />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 w-10 text-center">STT</th>
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
