import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listExams, deleteExam } from '../../services/examService';
import type { Exam } from '../../types';

export default function AdminExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listExams();
      setExams(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải danh sách đề thi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Xóa đề thi "${title}"? Các câu hỏi và kỳ thi liên quan có thể bị ảnh hưởng.`)) return;
    try {
      await deleteExam(id);
      setExams((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa đề thi.');
    }
  };

  if (loading) return <p className="text-slate-500">Đang tải...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Đề thi</h1>
        <Link
          to="/admin/exams/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Thêm đề thi
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Tiêu đề</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Thời gian (phút)</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Số câu</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Đã kiểm định</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {exams.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Chưa có đề thi. Nhấn "Thêm đề thi" để tạo.
                </td>
              </tr>
            ) : (
              exams.map((exam) => (
                <tr key={exam.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link to={`/admin/exams/${exam.id}`} className="text-indigo-600 hover:underline">
                      {exam.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{exam.duration_minutes}</td>
                  <td className="px-4 py-2 text-slate-600">{exam.total_questions}</td>
                  <td className="px-4 py-2">
                    {exam.questions_snapshot_url ? (
                      <span className="text-green-600 text-sm">Có</span>
                    ) : (
                      <span className="text-slate-400 text-sm">Chưa</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/admin/exams/${exam.id}/questions`}
                      className="text-slate-600 hover:text-slate-900 mr-3"
                    >
                      Câu hỏi
                    </Link>
                    <Link to={`/admin/exams/${exam.id}`} className="text-indigo-600 hover:underline mr-3">
                      Sửa
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(exam.id, exam.title)}
                      className="text-red-600 hover:underline"
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
