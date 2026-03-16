import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listExams, deleteExam } from '../../services/examService';
import type { Exam } from '../../types';
import ConfirmationModal from '../../components/ConfirmationModal';
import { ExamCard } from '../../components/ExamCard';

export default function AdminExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    setConfirmDelete({ id, title });
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      setDeleting(true);
      await deleteExam(confirmDelete.id);
      setExams((prev) => prev.filter((e) => e.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa đề thi.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Đề thi</h1>
          <p className="text-sm text-slate-600 mt-1">
            Quản lý danh sách đề thi lý thuyết. Mỗi đề cần gắn đúng mô-đun và ma trận câu hỏi.
          </p>
        </div>
        <Link
          to="/admin/exams/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Thêm đề thi
        </Link>
      </div>

      {loading && <p className="text-slate-500">Đang tải...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && exams.length === 0 && (
        <p className="text-slate-500 mb-4">
          Chưa có đề thi nào. Nhấn <strong>Thêm đề thi</strong> để tạo đề đầu tiên.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exams.map((exam) => (
          <ExamCard
            key={exam.id}
            title={exam.title}
            subtitle={exam.description}
            meta="MCQ"
            footerLeft={
              <>
                <span className="font-semibold">{exam.total_questions || 0}</span>
                <span className="text-slate-500 ml-1">câu</span>
              </>
            }
            footerRight={
              <span className="text-slate-500">
                {exam.duration_minutes || 0}'
                {' · '}
                {exam.questions_snapshot_url ? (
                  <span className="text-emerald-600 font-medium">Đã kiểm định</span>
                ) : (
                  <span className="text-slate-400">Chưa kiểm định</span>
                )}
              </span>
            }
            onClick={() => {}}
            actions={
              <div className="flex items-center gap-2 text-xs">
                <Link
                  to={`/admin/exams/${exam.id}/questions`}
                  className="text-slate-600 hover:text-slate-900"
                >
                  Câu hỏi
                </Link>
                <span className="text-slate-300">·</span>
                <Link to={`/admin/exams/${exam.id}/edit`} className="text-indigo-600 hover:underline">
                  Sửa
                </Link>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => handleDelete(exam.id, exam.title)}
                  className="text-red-600 hover:underline"
                >
                  Xóa
                </button>
              </div>
            }
          />
        ))}
      </div>

      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Xóa đề thi"
        isLoading={deleting}
        confirmText="Xóa"
      >
        {confirmDelete
          ? `Xóa đề thi "${confirmDelete.title}"? Các câu hỏi và kỳ thi liên quan có thể bị ảnh hưởng.`
          : ''}
      </ConfirmationModal>
    </div>
  );
}
