import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getExam, validateExamAndCreateSnapshot } from '../../services/examService';
import { listQuestionsByExam } from '../../services/questionService';
import type { Exam } from '../../types';

export default function AdminExamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [validateMessage, setValidateMessage] = useState('');
  const [error, setError] = useState('');

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

  const handleValidate = async () => {
    if (!id) return;
    setValidating(true);
    setValidateMessage('');
    try {
      const result = await validateExamAndCreateSnapshot(id);
      if (result.valid) {
        setValidateMessage('Kiểm định thành công. Snapshot đã lưu.');
        load();
      } else {
        setValidateMessage(result.message ?? 'Kiểm định thất bại.');
      }
    } catch (e) {
      setValidateMessage(e instanceof Error ? e.message : 'Lỗi kiểm định.');
    } finally {
      setValidating(false);
    }
  };

  if (loading || !id) return <p className="text-slate-500">Đang tải...</p>;
  if (error || !exam) return <p className="text-red-600">{error || 'Không tìm thấy đề thi.'}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">{exam.title}</h1>
        <div className="flex gap-2">
          <Link
            to={`/admin/exams/${id}/questions`}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
          >
            Quản lý câu hỏi ({questionCount})
          </Link>
          <button
            type="button"
            onClick={handleValidate}
            disabled={validating}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {validating ? 'Đang kiểm định...' : 'Kiểm định đề'}
          </button>
          <Link
            to={`/admin/exams/${id}/edit`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Sửa đề thi
          </Link>
          <button
            type="button"
            onClick={() => navigate('/admin/exams')}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Quay lại
          </button>
        </div>
      </div>

      {validateMessage && (
        <p className={`mb-4 p-3 rounded-lg ${validateMessage.includes('thành công') ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
          {validateMessage}
        </p>
      )}

      <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-2">
        <p><span className="text-slate-500">Mô tả:</span> {exam.description || '—'}</p>
        <p><span className="text-slate-500">Thời gian:</span> {exam.duration_minutes} phút</p>
        <p><span className="text-slate-500">Ngưỡng đạt:</span> {(exam.pass_threshold ?? 0) * 100}%</p>
        <p><span className="text-slate-500">Số câu:</span> {exam.total_questions}</p>
        <p><span className="text-slate-500">Đã kiểm định:</span> {exam.questions_snapshot_url ? 'Có' : 'Chưa'}</p>
      </div>
    </div>
  );
}
