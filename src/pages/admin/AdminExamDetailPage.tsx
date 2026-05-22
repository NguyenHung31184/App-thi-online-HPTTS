import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getExam, lockExam, unlockExam } from '../../services/examService';
import { listQuestionsByExam } from '../../services/questionService';
import type { Exam } from '../../types';

export default function AdminExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [lockMessageOk, setLockMessageOk] = useState(false);
  const [error, setError] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [examData, questions] = await Promise.all([
        getExam(id),
        listQuestionsByExam(id),
      ]);
      setExam(examData ?? null);
      setQuestionCount(questions.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải đề thi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleLock = async () => {
    if (!id) return;
    setLocking(true);
    setLockMessage('');
    try {
      const result = await lockExam(id);
      if (result.ok) {
        setLockMessageOk(true);
        setLockMessage('Đề thi đã được khóa. Câu hỏi không thể thay đổi cho đến khi mở khóa.');
        await load();
      } else {
        setLockMessageOk(false);
        setLockMessage(result.message);
      }
    } catch (e) {
      setLockMessageOk(false);
      setLockMessage(e instanceof Error ? e.message : 'Lỗi khóa đề.');
    } finally {
      setLocking(false);
    }
  };

  const handleUnlock = async () => {
    if (!id) return;
    setLocking(true);
    setLockMessage('');
    try {
      await unlockExam(id);
      setLockMessageOk(true);
      setLockMessage('Đề thi đã được mở khóa. Bạn có thể chỉnh sửa câu hỏi.');
      await load();
    } catch (e) {
      setLockMessageOk(false);
      setLockMessage(e instanceof Error ? e.message : 'Lỗi mở khóa đề.');
    } finally {
      setLocking(false);
    }
  };

  if (loading || !id) return <p className="text-slate-500">Đang tải...</p>;
  if (error || !exam) return <p className="text-red-600">{error || 'Không tìm thấy đề thi.'}</p>;

  const isLocked = Boolean(exam.locked_at);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-800">{exam.title}</h1>
          {isLocked && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
              Đã khóa
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link
            to={`/admin/exams/${id}/questions`}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm"
          >
            Câu hỏi ({questionCount})
          </Link>

          {isLocked ? (
            <button
              type="button"
              onClick={handleUnlock}
              disabled={locking}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm"
            >
              {locking ? 'Đang xử lý...' : 'Mở khóa đề'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLock}
              disabled={locking}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm"
            >
              {locking ? 'Đang khóa...' : 'Khóa đề thi'}
            </button>
          )}

          <Link
            to={`/admin/exams/${id}/edit`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            Sửa thông tin
          </Link>
          <button
            type="button"
            onClick={() => navigate('/admin/exams')}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
          >
            Quay lại
          </button>
        </div>
      </div>

      {lockMessage && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${lockMessageOk ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
          {lockMessage}
        </div>
      )}

      {isLocked && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
          <strong>Đề đang khóa</strong> — Câu hỏi không thể thêm/sửa/xóa.
          Khóa lúc: {new Date(exam.locked_at!).toLocaleString('vi-VN')}.
          Để chỉnh sửa, nhấn <strong>Mở khóa đề</strong> trước.
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2 text-sm">
        <p><span className="text-slate-500 w-28 inline-block">Mô tả:</span> {exam.description || '—'}</p>
        <p><span className="text-slate-500 w-28 inline-block">Thời gian:</span> {exam.duration_minutes} phút</p>
        <p><span className="text-slate-500 w-28 inline-block">Ngưỡng đạt:</span> {(exam.pass_threshold ?? 0) * 100}%</p>
        <p><span className="text-slate-500 w-28 inline-block">Số câu:</span> {exam.total_questions}</p>
        <p>
          <span className="text-slate-500 w-28 inline-block">Trạng thái:</span>
          {isLocked ? (
            <span className="text-emerald-700 font-medium">Đã khóa</span>
          ) : (
            <span className="text-slate-400">Chưa khóa</span>
          )}
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <span className="font-medium text-slate-700">Hướng dẫn khóa đề</span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${guideOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {guideOpen && (
          <div className="px-4 py-3 text-xs text-slate-600 space-y-1.5 bg-white border-t border-slate-200">
            <p>1. Thêm đủ câu hỏi theo ma trận blueprint (nếu có).</p>
            <p>2. Nhấn <strong>Khóa đề thi</strong> — hệ thống xác thực blueprint rồi đóng băng danh sách câu hỏi.</p>
            <p>3. Tạo kỳ thi (<strong>Kỳ thi</strong> trong menu) để học viên vào thi.</p>
            <p>4. Nếu cần sửa câu hỏi sau khi khóa: nhấn <strong>Mở khóa</strong>, sửa xong, khóa lại.</p>
          </div>
        )}
      </div>
    </div>
  );
}
