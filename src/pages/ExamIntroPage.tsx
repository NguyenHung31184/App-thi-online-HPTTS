import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAttempt } from '../services/attemptService';
import { getExam } from '../services/examService';
import type { Attempt, Exam } from '../types';

export default function ExamIntroPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!attemptId) return;
        const a = await getAttempt(attemptId);
        if (!a) {
          if (!cancelled) setError('Không tìm thấy bài làm.');
          return;
        }
        if (user?.id && a.user_id && a.user_id !== user.id) {
          if (!cancelled) setError('Bạn không có quyền làm bài này.');
          return;
        }
        const e = await getExam(a.exam_id);
        if (!cancelled) {
          setAttempt(a);
          setExam(e ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi tải thông tin bài thi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [attemptId, user?.id]);

  const handleStart = () => {
    if (!attemptId || !confirmed) return;
    navigate(`/exam/${attemptId}`);
  };

  if (loading) return <p className="p-4 text-slate-500">Đang tải...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;
  if (!attempt || !exam) return null;

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col lg:flex-row">
        <div className="lg:w-1/2 bg-slate-900 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-400 mb-2">
              App Thi Online · HPTTS
            </p>
            <h1 className="text-2xl font-bold mb-3">{exam.title}</h1>
            <p className="text-sm text-slate-300">
              Bài thi gồm tối đa <span className="font-semibold text-white">{exam.total_questions}</span> câu hỏi, thời
              gian làm bài <span className="font-semibold text-white">{exam.duration_minutes}</span> phút. Hãy đọc kỹ
              hướng dẫn bên phải trước khi bắt đầu.
            </p>
          </div>
        </div>

        <div className="lg:w-1/2 p-6 space-y-4">
          <section>
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-1">
              Mô tả bài thi
            </h2>
            <p className="text-sm text-slate-600">
              Bài thi trắc nghiệm trực tuyến, hệ thống tự chấm điểm. Một số câu hỏi có thể ở dạng kéo thả, chọn nhiều
              đáp án hoặc tự luận ngắn.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-1">
              Hướng dẫn nhanh
            </h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
              <li>Nhập mã truy cập đúng để vào phòng thi.</li>
              <li>Chọn đáp án và nộp bài trước khi hết giờ.</li>
              <li>Bạn có thể bắt đầu ngay khi sẵn sàng.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-1">
              Lưu ý kỹ thuật
            </h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
              <li>Đảm bảo kết nối Internet ổn định, pin thiết bị đủ cho toàn bộ thời gian thi.</li>
              <li>Không tự ý đóng trình duyệt hoặc tắt thiết bị khi đang làm bài.</li>
              <li>Hệ thống tự lưu câu trả lời định kỳ, nhưng bạn vẫn nên nộp bài trước khi hết giờ.</li>
            </ul>
          </section>

          <section className="pt-2 border-t border-slate-200">
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span>
                Tôi đã đọc hướng dẫn và sẵn sàng bắt đầu.
              </span>
            </label>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={!confirmed}
                onClick={handleStart}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700"
              >
                Bắt đầu làm bài
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

