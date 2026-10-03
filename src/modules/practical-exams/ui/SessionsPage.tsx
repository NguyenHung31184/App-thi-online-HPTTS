import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Pencil, Trash2 } from 'lucide-react';
import ConfirmationModal from '../../../shared/ui/ConfirmationModal';
import IconAction from '../../../shared/ui/IconAction';
import { useDeleteSession, usePracticalSessions, useSessionNames } from '../queries/use-practical-exams';

const formatTime = (ts: number) => new Date(ts).toLocaleString('vi-VN');

export default function SessionsPage() {
  const sessionsQuery = usePracticalSessions();
  const names = useSessionNames(sessionsQuery.data);
  const remove = useDeleteSession();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const doDelete = () => {
    if (!confirmDeleteId) return;
    remove.mutate(confirmDeleteId, {
      onSuccess: () => setConfirmDeleteId(null),
      onError: (e) => setDeleteError(e instanceof Error ? e.message : 'Lỗi xóa.'),
    });
  };

  const loadError = sessionsQuery.error;
  const error = deleteError || (loadError ? (loadError instanceof Error ? loadError.message : 'Lỗi tải kỳ thi.') : '');
  // Names load with the list, as before: the table appears once both are in.
  if (sessionsQuery.isLoading || (sessionsQuery.data && names.isLoading)) return <p className="text-slate-500">Đang tải...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  const sessions = sessionsQuery.data ?? [];
  const titles = names.data?.titles ?? {};
  const classNames = names.data?.classNames ?? {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Kỳ thi thực hành</h1>
        <Link to="/admin/practical-sessions/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
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
                  <td className="px-4 py-2">{titles[s.template_id] ?? s.template_id.slice(0, 8)}</td>
                  <td className="px-4 py-2">{classNames[s.class_id] ?? s.class_id.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatTime(s.start_at)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatTime(s.end_at)}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1">
                      <IconAction to={`/admin/practical-grading?session=${s.id}`} title="Chấm bài" tone="blue"><ClipboardCheck className="w-4 h-4" /></IconAction>
                      <IconAction to={`/admin/practical-sessions/${s.id}`} title="Sửa kỳ thi" tone="indigo"><Pencil className="w-4 h-4" /></IconAction>
                      <IconAction onClick={() => setConfirmDeleteId(s.id)} title="Xóa kỳ thi" tone="red"><Trash2 className="w-4 h-4" /></IconAction>
                    </div>
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
        isLoading={remove.isPending}
        confirmText="Xóa"
      >
        Xóa kỳ thi thực hành này?
      </ConfirmationModal>
    </div>
  );
}
