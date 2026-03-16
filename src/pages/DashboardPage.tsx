import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getAllowedWindows,
  getExamWindow,
  getExamIdForNewAttempt,
  type ExamWindowWithExam,
} from '../services/examWindowService';
import { createAttempt } from '../services/attemptService';
import {
  getAllowedPracticalSessions,
  getPracticalSession,
} from '../services/practicalSessionService';
import { createPracticalAttempt } from '../services/practicalAttemptService';
import type { PracticalSessionWithTemplate } from '../services/practicalSessionService';
import { getAdminDashboardStats, type AdminDashboardStats } from '../services/dashboardService';

export default function DashboardPage() {
  const { user } = useAuth();

  if (user && (user.role === 'admin' || user.role === 'teacher' || user.role === 'proctor')) {
    return <AdminTeacherDashboard />;
  }

  return <StudentDashboard />;
}

function AdminTeacherDashboard() {
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

function StudentDashboard() {
  const { user, studentSession } = useAuth();
  const navigate = useNavigate();
  const [windows, setWindows] = useState<ExamWindowWithExam[]>([]);
  const [practicalSessions, setPracticalSessions] = useState<PracticalSessionWithTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enteringWindowId, setEnteringWindowId] = useState<string | null>(null);
  const [enteringPracticalId, setEnteringPracticalId] = useState<string | null>(null);
  const [codeByWindow, setCodeByWindow] = useState<Record<string, string>>({});
  const [codeByPractical, setCodeByPractical] = useState<Record<string, string>>({});
  const [enterError, setEnterError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // Dùng student_id (từ Supabase profile hoặc từ phiên CCCD) để lọc kỳ thi được phép.
    const sid = user?.student_id ?? studentSession?.student_id ?? undefined;
    Promise.all([getAllowedWindows(sid), getAllowedPracticalSessions(sid)])
      .then(([winList, practicalList]) => {
        if (!cancelled) {
          setWindows(winList);
          setPracticalSessions(practicalList);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi tải kỳ thi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.student_id, studentSession?.student_id]);

  const handleEnterExam = async (windowId: string) => {
    const code = (codeByWindow[windowId] ?? '').trim();
    if (!code) {
      setEnterError('Vui lòng nhập mã truy cập.');
      return;
    }
    setEnterError('');
    setEnteringWindowId(windowId);
    try {
      const win = await getExamWindow(windowId);
      if (!win) {
        setEnterError('Không tìm thấy kỳ thi.');
        return;
      }
      if (win.access_code !== code) {
        setEnterError('Mã truy cập không đúng.');
        return;
      }
      const now = Date.now();
      if (now < win.start_at || now > win.end_at) {
        setEnterError('Hiện không trong thời gian làm bài của kỳ thi này.');
        return;
      }
      if (!user?.id) {
        setEnterError('Bạn chưa đăng nhập tài khoản thi. Vui lòng đăng nhập rồi thử lại.');
        setEnteringWindowId(null);
        return;
      }
      // Chỉ chặn xác thực CCCD đối với tài khoản thí sinh (không áp dụng cho Admin).
      if (user.role !== 'admin' && !user?.student_id && !studentSession?.student_id) {
        setEnterError('Vui lòng xác thực CCCD trước khi vào phòng thi (bấm "Xác thực CCCD" bên trên).');
        setEnteringWindowId(null);
        return;
      }
      const attempt = await createAttempt(user.id, windowId, getExamIdForNewAttempt(win));
      navigate(`/exam/${attempt.id}`);
    } catch (e) {
      setEnterError(e instanceof Error ? e.message : 'Lỗi tạo bài làm.');
    } finally {
      setEnteringWindowId(null);
    }
  };

  const handleEnterPractical = async (sessionId: string) => {
    const code = (codeByPractical[sessionId] ?? '').trim();
    if (!code) {
      setEnterError('Vui lòng nhập mã truy cập.');
      return;
    }
    setEnterError('');
    setEnteringPracticalId(sessionId);
    try {
      const session = await getPracticalSession(sessionId);
      if (!session) {
        setEnterError('Không tìm thấy kỳ thi.');
        return;
      }
      if (session.access_code !== code) {
        setEnterError('Mã truy cập không đúng.');
        return;
      }
      const now = Date.now();
      if (now < session.start_at || now > session.end_at) {
        setEnterError('Hiện không trong thời gian làm bài.');
        return;
      }
      if (!user?.id) {
        setEnterError('Bạn chưa đăng nhập tài khoản thi. Vui lòng đăng nhập rồi thử lại.');
        setEnteringPracticalId(null);
        return;
      }
      if (user.role !== 'admin' && !user?.student_id && !studentSession?.student_id) {
        setEnterError('Vui lòng xác thực CCCD trước khi vào phòng thi (bấm "Xác thực CCCD" bên trên).');
        setEnteringPracticalId(null);
        return;
      }
      const attempt = await createPracticalAttempt(sessionId, user.id);
      navigate(`/practical/${attempt.id}`);
    } catch (e) {
      setEnterError(e instanceof Error ? e.message : 'Lỗi tạo bài làm.');
    } finally {
      setEnteringPracticalId(null);
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleString('vi-VN');

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-4">Bảng điều khiển</h2>
      {user?.role !== 'admin' && (user?.student_id || studentSession?.student_id) && (
        <p className="text-sm text-slate-600 mb-4 rounded-xl bg-white/80 border border-slate-100 px-4 py-2 inline-block">
          Đã xác thực CCCD:{' '}
          {user?.student_name ||
            user?.student_code ||
            studentSession?.student_name ||
            studentSession?.student_code}
        </p>
      )}

      {user?.role !== 'admin' && (
        <div className="flex gap-3 mb-6">
          <Link
            to="/verify-cccd"
            className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-blue-600 shadow-lg shadow-indigo-500/25 transition-all"
          >
            Xác thực CCCD
          </Link>
        </div>
      )}

      <h3 className="text-lg font-semibold text-slate-700 mb-3">Kỳ thi đang mở</h3>
      {loading && <p className="text-slate-500">Đang tải...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && windows.length === 0 && practicalSessions.length === 0 && (
        <p className="text-slate-500">
          Không có kỳ thi nào trong thời gian làm bài. Nếu bạn đã xác thực CCCD, hãy kiểm tra bạn thuộc lớp được gắn với kỳ thi.
        </p>
      )}
      {enterError && <p className="text-amber-600 mb-2">{enterError}</p>}

      <div className="space-y-4">
        {windows.map((w) => (
          <div
            key={w.id}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="font-medium text-slate-800">{w.exam_title ?? 'Đề thi'}</p>
            {w.class_name && <p className="text-sm text-slate-500">Lớp: {w.class_name}</p>}
            <p className="text-sm text-slate-600">
              {formatTime(w.start_at)} — {formatTime(w.end_at)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Mã truy cập"
                value={codeByWindow[w.id] ?? ''}
                onChange={(e) => setCodeByWindow((prev) => ({ ...prev, [w.id]: e.target.value }))}
                className="border border-slate-300 rounded-lg px-3 py-2 w-40"
              />
              <button
                type="button"
                disabled={enteringWindowId === w.id}
                onClick={() => handleEnterExam(w.id)}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-blue-600 shadow-md disabled:opacity-50 transition-all"
              >
                {enteringWindowId === w.id ? 'Đang vào...' : 'Vào thi'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {practicalSessions.length > 0 && (
        <>
          <h3 className="text-lg font-medium text-slate-700 mt-8 mb-3">Thi thực hành đang mở</h3>
          <div className="space-y-4">
            {practicalSessions.map((s) => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <p className="font-medium text-slate-800">{s.template?.title ?? 'Thi thực hành'}</p>
                {s.class_name && <p className="text-sm text-slate-500">Lớp: {s.class_name}</p>}
                <p className="text-sm text-slate-600">
                  {formatTime(s.start_at)} — {formatTime(s.end_at)}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Mã truy cập"
                    value={codeByPractical[s.id] ?? ''}
                    onChange={(e) => setCodeByPractical((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    className="border border-slate-300 rounded-lg px-3 py-2 w-40"
                  />
                  <button
                    type="button"
                    disabled={enteringPracticalId === s.id}
                    onClick={() => handleEnterPractical(s.id)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-teal-600 shadow-md disabled:opacity-50 transition-all"
                  >
                    {enteringPracticalId === s.id ? 'Đang vào...' : 'Vào thi thực hành'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
