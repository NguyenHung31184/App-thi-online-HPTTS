import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listExams, deleteExam } from '../../services/examService';
import type { Exam } from '../../types';
import ConfirmationModal from '../../components/ConfirmationModal';
import EmptyState from '../../components/EmptyState';

function LockBadge({ locked }: { locked: boolean }) {
  if (locked) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
        Đã khóa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
      </svg>
      Chưa khóa
    </span>
  );
}

interface ActionBtnProps {
  to?: string;
  onClick?: () => void;
  title: string;
  color?: 'default' | 'blue' | 'indigo' | 'red';
  children: React.ReactNode;
}

function ActionBtn({ to, onClick, title, color = 'default', children }: ActionBtnProps) {
  const colorClass = {
    default: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
    blue: 'text-sky-600 hover:text-sky-800 hover:bg-sky-50',
    indigo: 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50',
    red: 'text-red-500 hover:text-red-700 hover:bg-red-50',
  }[color];

  const cls = `w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${colorClass}`;
  if (to) return <Link to={to} title={title} className={cls}>{children}</Link>;
  return <button type="button" onClick={onClick} title={title} className={cls}>{children}</button>;
}

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

  useEffect(() => { load(); }, []);

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
          <p className="text-sm text-slate-500 mt-1">
            Tạo đề → Thêm câu hỏi → <strong>Khóa đề</strong> → Tạo kỳ thi.
          </p>
        </div>
        <Link
          to="/admin/exams/new"
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Thêm đề thi
        </Link>
      </div>

      {loading && <p className="text-slate-500 text-sm">Đang tải...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && exams.length === 0 && (
        <EmptyState
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          title="Chưa có đề thi nào"
          description="Tạo đề thi đầu tiên, thêm câu hỏi rồi khóa đề trước khi tạo kỳ thi."
          action={
            <Link to="/admin/exams/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
              Tạo đề thi đầu tiên
            </Link>
          }
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exams.map((exam) => {
          const isLocked = Boolean(exam.locked_at);
          return (
            <div key={exam.id} className="rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
              {/* Card header gradient */}
              <div className="h-20 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 relative overflow-hidden flex items-start justify-end p-2">
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,_#ffffff_0,_transparent_55%)]" />
                <div className="relative z-10">
                  <LockBadge locked={isLocked} />
                </div>
              </div>

              {/* Card body */}
              <div className="flex-1 px-4 pt-3 pb-2">
                <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">{exam.title}</h3>
                {exam.description && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-1">{exam.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span><strong className="text-slate-700">{exam.total_questions || 0}</strong> câu</span>
                  <span className="text-slate-300">·</span>
                  <span>{exam.duration_minutes || 0} phút</span>
                </div>
              </div>

              {/* Card footer: icon actions */}
              <div className="px-3 pb-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-2">
                <ActionBtn to={`/admin/exams/${exam.id}/questions`} title="Câu hỏi" color="default">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />
                  </svg>
                </ActionBtn>
                <ActionBtn to={`/admin/exams/${exam.id}`} title="Chi tiết" color="blue">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </ActionBtn>
                <ActionBtn to={`/admin/exams/${exam.id}/edit`} title="Sửa thông tin" color="indigo">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </ActionBtn>
                <ActionBtn onClick={() => setConfirmDelete({ id: exam.id, title: exam.title })} title="Xóa đề thi" color="red">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </ActionBtn>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        title="Xóa đề thi"
        isLoading={deleting}
        confirmText="Xóa"
      >
        {confirmDelete ? `Xóa đề thi "${confirmDelete.title}"? Các câu hỏi và kỳ thi liên quan có thể bị ảnh hưởng.` : ''}
      </ConfirmationModal>
    </div>
  );
}
