import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listPracticalSessions,
  deletePracticalSession,
  getPracticalSessionWithTemplate,
} from '../../services/practicalSessionService';
import type { PracticalExamSession } from '../../types';
import ConfirmationModal from '../../components/ConfirmationModal';

export default function AdminPracticalSessionsPage() {
  const [sessions, setSessions] = useState<PracticalExamSession[]>([]);
  const [withTemplates, setWithTemplates] = useState<Record<string, string>>({});
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPracticalSessions()
      .then(async (list) => {
        if (cancelled) return;
        setSessions(list);
        const titles: Record<string, string> = {};
        const names: Record<string, string> = {};
        await Promise.all(
          list.map(async (s) => {
            const w = await getPracticalSessionWithTemplate(s.id);
            if (w?.template) titles[s.template_id] = w.template.title;
            if (w?.class_name) names[s.class_id] = w.class_name;
          })
        );
        setWithTemplates(titles);
        setClassNames(names);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Lỗi tải kỳ thi.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const doDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      setDeleting(true);
      await deletePracticalSession(confirmDeleteId);
      setSessions((prev) => prev.filter((s) => s.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa.');
    } finally {
      setDeleting(false);
    }
  };

  const formatTime = (ts: number) => new Date(ts).toLocaleString('vi-VN');

  if (loading) return <p className="text-slate-500">Đang tải...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Kỳ thi thực hành</h1>
        <Link
          to="/admin/practical-sessions/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Thêm kỳ thi
        </Link>
      </div>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Mẫu</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Lớp</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Bắt đầu</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Kết thúc</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Chưa có kỳ thi. Nhấn "Thêm kỳ thi" để tạo.
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">{withTemplates[s.template_id] ?? s.template_id.slice(0, 8)}</td>
                  <td className="px-4 py-2">{classNames[s.class_id] ?? s.class_id.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatTime(s.start_at)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatTime(s.end_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/admin/practical-grading?session=${s.id}`}
                      className="text-slate-600 hover:text-slate-900 mr-3"
                    >
                      Chấm bài
                    </Link>
                    <Link to={`/admin/practical-sessions/${s.id}`} className="text-indigo-600 hover:underline mr-3">
                      Sửa
                    </Link>
                    <button type="button" onClick={() => handleDelete(s.id)} className="text-red-600 hover:underline">
                      Xóa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmationModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={doDelete}
        title="Xóa kỳ thi thực hành"
        isLoading={deleting}
        confirmText="Xóa"
      >
        Xóa kỳ thi thực hành này?
      </ConfirmationModal>
    </div>
  );
}
