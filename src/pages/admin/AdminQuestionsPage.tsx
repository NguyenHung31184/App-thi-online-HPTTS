import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getExam } from '../../services/examService';
import { listQuestionsByExam, deleteQuestion } from '../../services/questionService';
import type { Exam } from '../../types';
import type { Question } from '../../types';

export default function AdminQuestionsPage() {
  const { id: examId } = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!examId) return;
    setLoading(true);
    setError('');
    try {
      const [examData, list] = await Promise.all([
        getExam(examId),
        listQuestionsByExam(examId),
      ]);
      setExam(examData ?? null);
      setQuestions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [examId]);

  const handleDelete = async (qId: string) => {
    if (!window.confirm('Xóa câu hỏi này?')) return;
    try {
      await deleteQuestion(qId);
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa.');
    }
  };

  if (loading || !examId) return <p className="text-slate-500">Đang tải...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!exam) return <p className="text-red-600">Không tìm thấy đề thi.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to={`/admin/exams/${examId}`} className="text-slate-500 hover:text-slate-700 text-sm">← Đề thi</Link>
          <h1 className="text-xl font-semibold text-slate-800 mt-1">Câu hỏi: {exam.title}</h1>
        </div>
        <Link
          to={`/admin/exams/${examId}/questions/new`}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Thêm câu hỏi
        </Link>
        <Link
          to={`/admin/exams/${examId}/questions/import`}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          Import từ Excel
        </Link>
      </div>

      <div className="space-y-3">
        {questions.length === 0 ? (
          <p className="text-slate-500">Chưa có câu hỏi. Thêm câu hỏi trắc nghiệm một đáp án.</p>
        ) : (
          questions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white border border-slate-200 rounded-lg p-4 flex justify-between items-start"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800">
                  Câu {idx + 1}. {q.stem.slice(0, 120)}{q.stem.length > 120 ? '...' : ''}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Chủ đề: {q.topic || '—'} | Độ khó: {q.difficulty} | Điểm: {q.points}
                </p>
              </div>
              <div className="flex gap-2 ml-2">
                <Link
                  to={`/admin/exams/${examId}/questions/${q.id}`}
                  className="text-indigo-600 hover:underline text-sm"
                >
                  Sửa
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(q.id)}
                  className="text-red-600 hover:underline text-sm"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
