import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listExamWindows, deleteExamWindow } from '../../services/examWindowService';
import { listExams } from '../../services/examService';
import { listClasses } from '../../services/ttdtDataService';
import type { ExamWindow } from '../../types';
import ConfirmationModal from '../../components/ConfirmationModal';
import { ExamCard } from '../../components/ExamCard';

export default function AdminWindowsPage() {
  const [windows, setWindows] = useState<ExamWindow[]>([]);
  const [exams, setExams] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [winList, examList, classList] = await Promise.all([
        listExamWindows(),
        listExams(),
        listClasses(),
      ]);
      setWindows(winList);
      setExams(Object.fromEntries(examList.map((e) => [e.id, e.title])));
      setClasses(Object.fromEntries(classList.map((c) => [c.id, c.name])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải danh sách kỳ thi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const doDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      setDeleting(true);
      await deleteExamWindow(confirmDeleteId);
      setWindows((prev) => prev.filter((w) => w.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa.');
    } finally {
      setDeleting(false);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('vi-VN');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Kỳ thi</h1>
          <p className="text-sm text-slate-600 mt-1">
            Danh sách cửa sổ thi (kỳ thi) đang được cấu hình, gắn với đề thi và lớp TTDT.
          </p>
        </div>
        <Link
          to="/admin/windows/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Thêm kỳ thi
        </Link>
      </div>

      {loading && <p className="text-slate-500">Đang tải...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && windows.length === 0 && (
        <p className="text-slate-500 mb-4">
          Chưa có kỳ thi nào. Nhấn <strong>Thêm kỳ thi</strong> để tạo cửa sổ thi đầu tiên.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {windows.map((w) => (
          <ExamCard
            key={w.id}
            title={exams[w.exam_id] ?? 'Kỳ thi'}
            subtitle={classes[w.class_id] ? `Lớp: ${classes[w.class_id]}` : undefined}
            meta={`Mã: ${w.access_code}`}
            footerLeft={
              <span className="text-slate-600 text-xs">
                {formatTime(w.start_at)} – {formatTime(w.end_at)}
              </span>
            }
            footerRight={
              <div className="flex items-center gap-2 text-xs">
                <Link to={`/admin/windows/${w.id}`} className="text-indigo-600 hover:underline">
                  Sửa
                </Link>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => handleDelete(w.id)}
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
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={doDelete}
        title="Xóa kỳ thi"
        isLoading={deleting}
        confirmText="Xóa"
      >
        Xóa kỳ thi này? Thí sinh sẽ không thể vào thi bằng mã này.
      </ConfirmationModal>
    </div>
  );
}
