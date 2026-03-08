import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAttempt } from '../services/attemptService';
import { getExam } from '../services/examService';
import type { Attempt, Exam } from '../types';

export default function ExamResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!attemptId || !user?.id) return;
    getAttempt(attemptId)
      .then(async (a) => {
        if (!a) {
          setError('Không tìm thấy bài làm.');
          return;
        }
        if (a.user_id !== user.id) {
          setError('Bạn không có quyền xem kết quả này.');
          return;
        }
        setAttempt(a);
        const e = await getExam(a.exam_id);
        setExam(e ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Lỗi tải kết quả.'))
      .finally(() => setLoading(false));
  }, [attemptId, user?.id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <p className="p-4 text-slate-500">Đang tải...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;
  if (!attempt || !exam) return null;

  const scorePct = attempt.score != null ? Math.round(attempt.score * 100) : 0;
  const passed = (exam.pass_threshold ?? 0.7) <= (attempt.score ?? 0);

  return (
    <div className="max-w-2xl mx-auto p-4 print:max-w-none">
      <div className="bg-white border border-slate-200 rounded-lg p-6 print:border-0 print:shadow-none">
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Kết quả bài thi</h1>
        <p className="text-slate-600 mb-4">{exam.title}</p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm text-slate-500">Điểm</p>
            <p className="text-2xl font-bold text-slate-800">{scorePct}%</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-sm text-slate-500">Kết quả</p>
            <p className={`text-xl font-semibold ${passed ? 'text-green-600' : 'text-red-600'}`}>
              {passed ? 'Đạt' : 'Chưa đạt'}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-500">
          Điểm chi tiết: {typeof attempt.raw_score === 'number' ? attempt.raw_score : '—'} / tổng điểm câu hỏi.
          Ngưỡng đạt: {(exam.pass_threshold ?? 0.7) * 100}%.
        </p>

        {attempt.synced_to_ttdt_at && (
          <p className="text-sm text-green-600 mt-2">Đã đồng bộ điểm sang hệ thống TTDT.</p>
        )}

        <div className="mt-8 flex gap-3 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800"
          >
            In kết quả
          </button>
          <Link
            to="/dashboard"
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
