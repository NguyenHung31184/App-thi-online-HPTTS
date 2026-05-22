import { useEffect, useMemo, useState } from 'react';
import {
  getAdminDashboardStats,
  listRecentCompletedAttemptsForDashboard,
  type AdminDashboardStats,
  type DashboardRecentAttemptRow,
} from '../../services/dashboardService';
import DashboardRecentAttemptsTable from '../../components/DashboardRecentAttemptsTable';

// ── Chart helpers (pure CSS, no library) ──────────────────────────────────────

interface ScoreBucket { label: string; count: number; pct: number }

function buildScoreDistribution(rows: DashboardRecentAttemptRow[]): ScoreBucket[] {
  const counts = Array(10).fill(0) as number[];
  let valid = 0;
  for (const r of rows) {
    if (r.score == null) continue;
    const bucket = Math.min(9, Math.floor(r.score * 10));
    counts[bucket]++;
    valid++;
  }
  return counts.map((c, i) => ({
    label: `${i * 10}–${(i + 1) * 10}%`,
    count: c,
    pct: valid > 0 ? (c / valid) * 100 : 0,
  }));
}

interface ExamStat { title: string; total: number; passed: number; passRate: number }

function buildTopExams(rows: DashboardRecentAttemptRow[]): ExamStat[] {
  const map = new Map<string, ExamStat>();
  for (const r of rows) {
    const key = r.exam_title;
    const existing = map.get(key) ?? { title: key, total: 0, passed: 0, passRate: 0 };
    existing.total++;
    if (r.passed) existing.passed++;
    map.set(key, existing);
  }
  return [...map.values()]
    .map((s) => ({ ...s, passRate: s.total > 0 ? s.passed / s.total : 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

// ── Sub-chart components ──────────────────────────────────────────────────────

function ScoreDistributionChart({ rows }: { rows: DashboardRecentAttemptRow[] }) {
  const buckets = useMemo(() => buildScoreDistribution(rows), [rows]);
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const scored = rows.filter((r) => r.score != null).length;
  if (scored === 0) return <p className="text-slate-500 text-sm">Chưa có dữ liệu.</p>;
  return (
    <div className="flex items-end gap-1 h-32">
      {buckets.map((b) => (
        <div key={b.label} className="flex-1 flex flex-col items-center gap-1 group relative">
          <div
            className={`w-full rounded-t-sm transition-all ${
              b.label.startsWith('0') || b.label.startsWith('10') || b.label.startsWith('20') || b.label.startsWith('30') || b.label.startsWith('40') || b.label.startsWith('50')
                ? 'bg-gradient-to-t from-rose-400 to-rose-300'
                : b.label.startsWith('60') || b.label.startsWith('70')
                ? 'bg-gradient-to-t from-amber-400 to-amber-300'
                : 'bg-gradient-to-t from-emerald-500 to-emerald-400'
            }`}
            style={{ height: `${(b.count / max) * 100 || 3}%` }}
          />
          {b.count > 0 && (
            <span className="text-[9px] font-semibold text-slate-600">{b.count}</span>
          )}
          <span className="text-[8px] text-slate-400 leading-tight text-center">
            {b.label.replace('%', '')}
          </span>
          {/* Tooltip */}
          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-slate-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
            {b.label}: {b.count} bài ({b.pct.toFixed(1)}%)
          </div>
        </div>
      ))}
    </div>
  );
}

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

function TopExamsChart({ rows }: { rows: DashboardRecentAttemptRow[] }) {
  const top = useMemo(() => buildTopExams(rows), [rows]);
  const maxAttempts = Math.max(...top.map((e) => e.total), 1);
  if (top.length === 0) return <p className="text-slate-500 text-sm">Chưa có dữ liệu.</p>;
  return (
    <div className="space-y-3">
      {top.map((e) => (
        <div key={e.title}>
          <div className="flex justify-between text-xs mb-1 gap-2">
            <span className="text-slate-700 font-medium truncate flex-1" title={e.title}>{e.title}</span>
            <span className="text-slate-400 flex-shrink-0">{e.total} bài</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full flex">
                <div
                  className="bg-emerald-400 rounded-l-full"
                  style={{ width: `${(e.passed / maxAttempts) * 100}%` }}
                />
                <div
                  className="bg-rose-300"
                  style={{ width: `${((e.total - e.passed) / maxAttempts) * 100}%` }}
                />
              </div>
            </div>
            <span className={`text-[10px] font-semibold flex-shrink-0 w-10 text-right ${e.passRate >= 0.7 ? 'text-emerald-600' : 'text-rose-500'}`}>
              {(e.passRate * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded-full bg-emerald-400" />Đạt</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2 rounded-full bg-rose-300" />Không đạt/Bị loại</span>
      </div>
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

          {/* ── Row: attempts/day + violations ── */}
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
                    const max = Math.max(...stats.attemptsPerDay.map((x) => x.completed || 1));
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

          {/* ── Row: 3 charts from recentRows ── */}
          {recentRows.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-3 mb-6">
              {/* Chart 1: Score distribution */}
              <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-800 mb-1">Phân phối điểm số</p>
                <p className="text-xs text-slate-500 mb-3">
                  Theo dải 10% — {recentRows.filter((r) => r.score != null).length} bài có điểm
                </p>
                <ScoreDistributionChart rows={recentRows} />
              </div>

              {/* Chart 2: Pass / Fail / Disqualified */}
              <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-800 mb-1">Kết quả thi</p>
                <p className="text-xs text-slate-500 mb-3">Tổng hợp từ các bài làm gần nhất</p>
                <PassFailChart rows={recentRows} />
              </div>

              {/* Chart 3: Top exams */}
              <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-800 mb-1">Top đề thi</p>
                <p className="text-xs text-slate-500 mb-3">Theo số bài làm · thanh xanh = đạt</p>
                <TopExamsChart rows={recentRows} />
              </div>
            </div>
          )}

          {/* ── Recent attempts table ── */}
          <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-slate-800">Bài làm gần đây (đã nộp)</p>
              <span className="text-xs text-slate-400">{recentRows.length} bài</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Đề thi, kỳ thi, thời gian làm, điểm, kết quả — bấm <strong>Xem</strong> để xem chi tiết từng câu.
            </p>
            <DashboardRecentAttemptsTable rows={recentRows} showAdminLinks />
          </div>
        </>
      )}
    </div>
  );
}
