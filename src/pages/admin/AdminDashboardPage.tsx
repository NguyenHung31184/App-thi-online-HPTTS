import { useEffect, useMemo, useState } from 'react';
import {
  getAdminDashboardStats,
  listRecentCompletedAttemptsForDashboard,
  type AdminDashboardStats,
  type DashboardRecentAttemptRow,
} from '../../services/dashboardService';
import { LiveExamMonitor } from '../../modules/exam-monitoring/public';

// ── Chart helpers (pure CSS, no library) ──────────────────────────────────────

function PassFailChart({ rows }: { rows: DashboardRecentAttemptRow[] }) {
  const stats = useMemo(() => {
    let passed = 0, failed = 0, disq = 0;
    for (const r of rows) {
      if (r.disqualified) disq++;
      else if (r.passed) passed++;
      else failed++;
    }
    const total = rows.length || 1;
    return { passed, failed, disq, total };
  }, [rows]);

  const items = [
    { label: 'Đạt', count: stats.passed, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
    { label: 'Không đạt', count: stats.failed, color: 'bg-rose-400',    textColor: 'text-rose-600' },
    { label: 'Bị loại', count: stats.disq,   color: 'bg-slate-400',    textColor: 'text-slate-600' },
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
              <div
                className={`h-full rounded-full transition-all ${item.color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-slate-400 pt-1">{rows.length} bài làm gần nhất</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [recentRows, setRecentRows] = useState<DashboardRecentAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [statsRes, rows] = await Promise.all([
          getAdminDashboardStats(),
          listRecentCompletedAttemptsForDashboard(100),
        ]);
        if (!cancelled) {
          setStats(statsRes);
          setRecentRows(rows);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi tải thống kê.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-4">Dashboard báo cáo</h2>
      {loading && <p className="text-slate-500 text-sm">Đang tải thống kê...</p>}
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {stats && (
        <>
          {/* ── Stat cards ── */}
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

          {/* ── Attempts per day ── */}
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
                      <div
                        className="w-full rounded-t-md bg-brand-500"
                        style={{ height: `${height || 5}%` }}
                      />
                      <div className="text-[10px] text-slate-500">
                        {d.date.slice(5).replace('-', '/')}
                      </div>
                      <div className="text-[10px] text-slate-700 font-semibold">
                        {d.completed}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Row: results + violations ── */}
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-800 mb-1">Kết quả thi</p>
              <p className="text-xs text-slate-500 mb-3">Tổng hợp từ các bài làm gần nhất</p>
              {recentRows.length > 0 ? (
                <PassFailChart rows={recentRows} />
              ) : (
                <p className="text-slate-500 text-sm">Chưa có dữ liệu.</p>
              )}
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-800 mb-3">
                Log vi phạm 24h gần nhất
              </p>
              <div className="space-y-1 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span>Mất focus</span>
                  <span className="font-mono">{stats.violationsLast24h.focus_lost}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ẩn tab / thu nhỏ</span>
                  <span className="font-mono">{stats.violationsLast24h.visibility_hidden}</span>
                </div>
                <div className="flex justify-between">
                  <span>Thoát fullscreen</span>
                  <span className="font-mono">{stats.violationsLast24h.fullscreen_exited}</span>
                </div>
                <div className="flex justify-between">
                  <span>Copy/Paste bị chặn</span>
                  <span className="font-mono">{stats.violationsLast24h.copy_paste_blocked}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ảnh webcam</span>
                  <span className="font-mono">{stats.violationsLast24h.photo_taken}</span>
                </div>
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
