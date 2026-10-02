import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { searchResultRows, type AttemptReportRow } from '../../domain/report-rows';
import { exportReportToExcel } from './download-report';

interface ResultsTabProps {
  rows: AttemptReportRow[];
  /** Kept by the page so it survives a reload. */
  search: string;
  onSearchChange: (value: string) => void;
}

export function ResultsTab({ rows, search, onSearchChange }: ResultsTabProps) {
  const shown = useMemo(() => searchResultRows(rows, search), [rows, search]);

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4 print:hidden">
        <button type="button" onClick={() => exportReportToExcel(rows)} disabled={rows.length === 0}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
          Xuất Excel
        </button>
      </div>

      <div className="flex flex-col gap-2 mb-3">
        <p className="text-slate-600 text-sm">
          Số bài làm: <strong>{rows.length}</strong>
          {search.trim() && (
            <span className="ml-2 text-xs text-slate-500">(lọc: <strong>{shown.length}</strong>)</span>
          )}
        </p>
        <div className="max-w-md">
          <input type="text" value={search} onChange={(e) => onSearchChange(e.target.value)}
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
            {shown.map((r) => (
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
                  {r.raw_score != null && <span className="text-slate-500 font-normal"> ({r.raw_score})</span>}
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
                  {r.synced_to_ttdt_at ? <span className="text-emerald-600">✓ Có</span> : <span className="text-slate-400">Chưa</span>}
                </td>
                <td className="px-3 py-2">
                  <Link to={`/admin/attempts/${r.id}/result`} className="text-indigo-600 hover:underline text-xs font-medium">
                    Xem
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && <p className="text-slate-500 text-sm mt-2">Chưa có bài làm nào với bộ lọc đã chọn.</p>}
      {rows.length > 0 && shown.length === 0 && (
        <p className="text-slate-500 text-sm mt-2">Không có bài làm nào phù hợp với từ khóa tìm kiếm.</p>
      )}
    </>
  );
}
