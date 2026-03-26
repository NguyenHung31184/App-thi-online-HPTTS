import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import type { Attempt } from '../types';

interface AttemptWithExam extends Attempt {
  exams?: { title: string; duration_minutes: number; pass_threshold: number } | null;
}

export default function StudentResultsPage() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<AttemptWithExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('attempts')
          .select(
            `
            *,
            exams (title, duration_minutes, pass_threshold)
          `
          )
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false });
        if (cancelled) return;
        if (err) {
          setError(err.message);
        } else {
          setAttempts((data ?? []) as AttemptWithExam[]);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Lỗi tải kết quả.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const formatTime = (ts?: number | null) =>
    ts != null ? new Date(ts).toLocaleString('vi-VN') : '—';

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-2">Kết quả các bài thi</h2>
      <p className="text-sm text-slate-600 mb-4">
        Danh sách các bài thi trắc nghiệm bạn đã hoàn thành. Có thể xem lại chi tiết điểm số và trạng thái đồng bộ
        sang TTDT.
      </p>
      {loading && <p className="text-slate-500">Đang tải...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && attempts.length === 0 && (
        <p className="text-slate-500">Bạn chưa có bài thi nào đã hoàn thành.</p>
      )}

      <div className="space-y-3">
        {attempts.map((a) => {
          const exam = a.exams;
          const denom = typeof a.total_max === 'number' && a.total_max > 0 ? a.total_max : 1;
          const raw = a.raw_score ?? 0;
          const percent = denom > 0 ? (raw / denom) * 100 : 0;
          const passed = (exam?.pass_threshold ?? 0.7) <= (a.score ?? 0);
          return (
            <div
              key={a.id}
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div>
                <p className="font-medium text-slate-800">
                  {exam?.title ?? 'Đề thi'}{' '}
                  <span className="text-xs font-mono text-slate-400">({a.id.slice(0, 8)}…)</span>
                </p>
                <p className="text-sm text-slate-600">
                  Điểm: <strong>{raw.toFixed(1)}</strong> / {denom}{' '}
                  <span className="text-slate-500">({percent.toFixed(1)}%)</span>
                </p>
                <p className="text-sm text-slate-600">
                  Trạng thái:{' '}
                  <span className={passed ? 'text-green-600 font-semibold' : 'text-amber-600 font-semibold'}>
                    {passed ? 'Đạt' : 'Chưa đạt'}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Hoàn thành: {formatTime(a.completed_at)} · Đồng bộ TTDT:{' '}
                  {a.synced_to_ttdt_at ? 'Đã đồng bộ' : 'Chưa đồng bộ'}
                </p>
              </div>
              <div className="flex flex-col items-stretch sm:items-end gap-2">
                <Link
                  to={`/exam/${a.id}/result`}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Xem chi tiết
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

