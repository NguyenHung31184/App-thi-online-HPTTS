import { useEffect, useState } from 'react';
import { getAdminDashboardStats, type AdminDashboardStats } from '../../services/dashboardService';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAdminDashboardStats()
      .then((res) => {
        if (!cancelled) setStats(res);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi tải thống kê.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

          <div className="grid gap-6 lg:grid-cols-3 mb-6">
            <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-800 mb-3">
                Số bài làm theo ngày (7 ngày gần nhất)
              </p>
              {stats.attemptsPerDay.length === 0 ? (
                <p className="text-slate-500 text-sm">Chưa có dữ liệu trong 7 ngày gần đây.</p>
              ) : (
                <div className="h-40 flex items-end gap-2">
                  {stats.attemptsPerDay.map((d) => {
                    const max = Math.max(
                      ...stats.attemptsPerDay.map((x) => x.completed || 1)
                    );
                    const height = (d.completed / max) * 100;
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-md bg-gradient-to-t from-indigo-500 to-sky-400"
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
                  <span className="font-mono">
                    {stats.violationsLast24h.copy_paste_blocked}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Ảnh webcam</span>
                  <span className="font-mono">{stats.violationsLast24h.photo_taken}</span>
                </div>
              </div>
              <div className="mt-4 text-xs text-slate-500">
                Log lỗi đồng bộ TTDT hôm nay:{' '}
                <span className="font-semibold text-rose-600">
                  {stats.syncFailedToday}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

