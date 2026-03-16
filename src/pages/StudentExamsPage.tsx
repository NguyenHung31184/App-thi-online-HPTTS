import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAllowedWindows, getExamIdForNewAttempt, type ExamWindowWithExam } from '../services/examWindowService';
import { createAttempt } from '../services/attemptService';
import { ExamCard } from '../components/ExamCard';

export default function StudentExamsPage() {
  const { user, studentSession } = useAuth();
  const navigate = useNavigate();
  const [windows, setWindows] = useState<ExamWindowWithExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [codeByWindow, setCodeByWindow] = useState<Record<string, string>>({});
  const [enterError, setEnterError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const sid = user?.student_id ?? studentSession?.student_id ?? undefined;
    getAllowedWindows(sid)
      .then((rows) => {
        if (!cancelled) setWindows(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi tải danh sách kỳ thi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.student_id, studentSession?.student_id]);

  const formatTime = (ts: number) => new Date(ts).toLocaleString('vi-VN');

  const handleEnter = async (windowId: string) => {
    const code = (codeByWindow[windowId] ?? '').trim();
    if (!code) {
      setEnterError('Vui lòng nhập mã truy cập.');
      return;
    }
    setEnterError('');
    setEnteringId(windowId);
    try {
      if (!user?.id) {
        setEnterError('Bạn chưa đăng nhập tài khoản thi. Vui lòng đăng nhập rồi thử lại.');
        return;
      }
      if (!user?.student_id && !studentSession?.student_id) {
        setEnterError('Vui lòng xác thực CCCD trước khi vào phòng thi (menu STUDENT → Xác thực CCCD).');
        return;
      }
      const win = windows.find((w) => w.id === windowId);
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
      const attempt = await createAttempt(user.id, windowId, getExamIdForNewAttempt(win));
      navigate(`/exam/${attempt.id}/intro`);
    } catch (e) {
      setEnterError(e instanceof Error ? e.message : 'Lỗi tạo bài làm.');
    } finally {
      setEnteringId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-2">Kỳ thi đang mở</h2>
      <p className="text-sm text-slate-600 mb-4">
        Danh sách các kỳ thi lý thuyết bạn được phép tham gia (lọc theo lớp trên TTDT). Vui lòng nhập đúng mã truy cập
        mà giám thị cung cấp trước khi vào phòng thi.
      </p>
      {loading && <p className="text-slate-500">Đang tải...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {enterError && <p className="text-amber-600 mb-2">{enterError}</p>}
      {!loading && !error && windows.length === 0 && (
        <p className="text-slate-500 mb-4">
          Hiện bạn không có kỳ thi nào trong thời gian làm bài. Nếu chắc chắn đã được xếp lớp/kỳ thi, hãy liên hệ giám
          thị để kiểm tra cấu hình.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {windows.map((w) => (
          <ExamCard
            key={w.id}
            title={w.exam_title ?? 'Đề thi'}
            subtitle={w.class_name ? `Lớp: ${w.class_name}` : undefined}
            meta="MCQ"
            footerLeft={
              <span className="text-xs text-slate-600">
                {formatTime(w.start_at)} – {formatTime(w.end_at)}
              </span>
            }
            footerRight={
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Mã truy cập"
                  value={codeByWindow[w.id] ?? ''}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setCodeByWindow((prev) => ({ ...prev, [w.id]: e.target.value }))}
                  className="border border-slate-300 rounded-lg px-2 py-1 w-24"
                />
                <button
                  type="button"
                  disabled={enteringId === w.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEnter(w.id);
                  }}
                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-xs"
                >
                  {enteringId === w.id ? 'Đang vào' : 'Vào thi'}
                </button>
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}

