import { Link } from 'react-router-dom';
import type { DashboardRecentAttemptRow } from '../services/dashboardService';

interface Props {
  rows: DashboardRecentAttemptRow[];
  /** Hiện link /admin/... (chỉ khi đang ở khu admin hoặc user admin). */
  showAdminLinks?: boolean;
}

export default function DashboardRecentAttemptsTable({ rows, showAdminLinks }: Props) {
  if (rows.length === 0) {
    return <p className="text-slate-500 text-sm">Chưa có bài làm đã nộp gần đây.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
          <tr>
            <th className="px-3 py-2 font-semibold">Học viên</th>
            <th className="px-3 py-2 font-semibold">Đề thi</th>
            <th className="px-3 py-2 font-semibold min-w-[200px]">Kỳ thi (cửa sổ)</th>
            <th className="px-3 py-2 font-semibold whitespace-nowrap">Thời gian làm</th>
            <th className="px-3 py-2 font-semibold">Điểm</th>
            <th className="px-3 py-2 font-semibold">Kết quả</th>
            <th className="px-3 py-2 font-semibold w-20">Chi tiết</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-3 py-2 text-slate-800 max-w-[140px]">
                <span className="line-clamp-2" title={r.student_label}>
                  {r.student_label}
                </span>
              </td>
              <td className="px-3 py-2 text-slate-800 max-w-[180px]">
                {showAdminLinks ? (
                  <Link
                    to={`/admin/exams/${r.exam_id}`}
                    className="text-indigo-600 hover:underline line-clamp-2"
                    title={r.exam_title}
                  >
                    {r.exam_title}
                  </Link>
                ) : (
                  <span className="line-clamp-2" title={r.exam_title}>
                    {r.exam_title}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-600 text-xs leading-snug max-w-[280px]">
                {showAdminLinks ? (
                  <Link
                    to={`/admin/windows/${r.window_id}`}
                    className="text-indigo-600 hover:underline block line-clamp-3"
                    title={r.window_label}
                  >
                    {r.window_label}
                  </Link>
                ) : (
                  <span className="line-clamp-3" title={r.window_label}>
                    {r.window_label}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{r.duration_label}</td>
              <td className="px-3 py-2 text-slate-800 font-medium tabular-nums">{r.raw_display}</td>
              <td className="px-3 py-2">
                {r.disqualified ? (
                  <span className="text-amber-700 font-medium">Bị loại</span>
                ) : r.passed ? (
                  <span className="text-emerald-600 font-medium">Đạt</span>
                ) : (
                  <span className="text-red-600 font-medium">Chưa đạt</span>
                )}
              </td>
              <td className="px-3 py-2">
                <Link
                  to={showAdminLinks ? `/admin/attempts/${r.id}/result` : `/exam/${r.id}/result`}
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
  );
}
