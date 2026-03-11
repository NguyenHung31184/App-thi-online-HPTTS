import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllowedWindows, getExamWindow, type ExamWindowWithExam } from '../services/examWindowService';
import { createAttempt } from '../services/attemptService';
import { getAllowedPracticalSessions, getPracticalSession } from '../services/practicalSessionService';
import { createPracticalAttempt } from '../services/practicalAttemptService';
import type { PracticalSessionWithTemplate } from '../services/practicalSessionService';

export default function DashboardPage() {
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
      // Với schema hiện tại, attempts.user_id phải là Supabase auth user (auth.uid()).
      // Vì vậy vẫn cần tài khoản đăng nhập Supabase; CCCD chỉ là lớp kiểm tra bổ sung.
      if (!user?.id) {
        setEnterError('Bạn chưa đăng nhập tài khoản thi. Vui lòng đăng nhập rồi thử lại.');
        return;
      }
      const attempt = await createAttempt(user.id, windowId, win.exam_id);
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
      {(user?.student_id || studentSession?.student_id) && (
        <p className="text-sm text-slate-600 mb-4 rounded-xl bg-white/80 border border-slate-100 px-4 py-2 inline-block">
          Đã xác thực CCCD:{' '}
          {user?.student_name ||
            user?.student_code ||
            studentSession?.student_name ||
            studentSession?.student_code}
        </p>
      )}

      <div className="flex gap-3 mb-6">
        <Link
          to="/verify-cccd"
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-blue-600 shadow-lg shadow-indigo-500/25 transition-all"
        >
          Xác thực CCCD
        </Link>
      </div>

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
