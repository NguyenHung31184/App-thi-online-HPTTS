import { useMemo } from 'react';
import { LiveExamMonitor } from '../../../exam-monitoring/public';
import { passFailCounts } from '../../domain/dashboard-stats';
import type { DashboardRecentAttemptRow } from '../../domain/recent-attempts';
import { useDashboardStats, useRecentAttempts } from '../../queries/use-exam-reporting';

const RECENT_LIMIT = 100;

function PassFailChart({ rows }: { rows: DashboardRecentAttemptRow[] }) {
  const stats = useMemo(() => passFailCounts(rows), [rows]);
  const items = [
    { label: 'Đạt', count: stats.passed, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
    { label: 'Không đạt', count: stats.failed, color: 'bg-rose-400', textColor: 'text-rose-600' },
    { label: 'Bị loại', count: stats.disqualified, color: 'bg-slate-400', textColor: 'text-slate-600' },
  ];

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const pct = (item.count / stats.total) * 100;
        return (
          <div key={item.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className={`font-medium ${item.textColor}`}>{item.label}</span>
              <span className="text-slate-500">{item.count} bài · {pct.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${item.color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-slate-400 pt-1">{rows.length} bài làm gần nhất</p>
    </div>
  );
}

const VIOLATION_LINES = [
  ['focus_lost', 'Mất focus'],
  ['visibility_hidden', 'Ẩn tab / thu nhỏ'],
  ['fullscreen_exited', 'Thoát fullscreen'],
  ['copy_paste_blocked', 'Copy/Paste bị chặn'],
  ['photo_taken', 'Ảnh webcam'],
] as const;

/** Staff dashboard: today's numbers, live monitoring, the last 7 days, recent results and signals. */
export default function AdminDashboardPage() {
  const statsQuery = useDashboardStats();
  const recentQuery = useRecentAttempts(RECENT_LIMIT);
  const failure = statsQuery.error ?? recentQuery.error;
  const error = failure ? (failure instanceof Error ? failure.message : 'Lỗi tải thống kê.') : '';
  const loading = !error && (statsQuery.isLoading || recentQuery.isLoading);
  // Both load together, as before: nothing is shown until both are in.
  const stats = !error && recentQuery.data ? statsQuery.data : undefined;
  const recentRows = recentQuery.data ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-4">Dashboard báo cáo</h2>
      {loading && <p className="text-slate-500 text-sm">Đang tải thống kê...</p>}
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Kỳ thi đang mở</p>
              <p className="text-2xl font-bold text-slate-900">{stats.openWindowsToday}</p>
              <p className="text-xs text-slate-500 mt-1">Trong thời điểm hiện tại</p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Bài làm hôm nay</p>
              <p className="text-2xl font-bold text-slate-900">{stats.attemptsToday}</p>
              <p className="text-xs text-slate-500 mt-1">
                Trong tổng số {stats.attemptsLast7Days} bài trong 7 ngày
              </p>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-1">
                Tỷ lệ Đạt (7 ngày)
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                {(stats.passedRateLast7Days * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500 mt-1">Đã loại trừ các bài bị loại</p>
            </div>
          </div>

          <LiveExamMonitor />

          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm mb-6">
            <p className="text-sm font-semibold text-slate-800 mb-3">
              Số bài làm theo ngày (7 ngày gần nhất)
            </p>
            {stats.attemptsPerDay.length === 0 ? (
              <p className="text-slate-500 text-sm">Chưa có dữ liệu trong 7 ngày gần đây.</p>
            ) : (
              <div className="h-40 flex items-end gap-2">
                {stats.attemptsPerDay.map((d) => {
                  const max = Math.max(...stats.attemptsPerDay.map((x) => x.completed || 1));
                  const height = (d.completed / max) * 100;
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-md bg-brand-500" style={{ height: `${height || 5}%` }} />
                      <div className="text-[10px] text-slate-500">{d.date.slice(5).replace('-', '/')}</div>
                      <div className="text-[10px] text-slate-700 font-semibold">{d.completed}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-800 mb-1">Kết quả thi</p>
              <p className="text-xs text-slate-500 mb-3">Tổng hợp từ các bài làm gần nhất</p>
              {recentRows.length > 0 ? <PassFailChart rows={recentRows} /> : <p className="text-slate-500 text-sm">Chưa có dữ liệu.</p>}
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-800 mb-3">
                Log vi phạm 24h gần nhất
              </p>
              <div className="space-y-1 text-xs text-slate-700">
                {VIOLATION_LINES.map(([key, label]) => (
                  <div key={key} className="flex justify-between">
                    <span>{label}</span>
                    <span className="font-mono">{stats.violationsLast24h[key]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-slate-500">
                Log lỗi đồng bộ TTDT hôm nay:{' '}
                <span className="font-semibold text-rose-600">{stats.syncFailedToday}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
