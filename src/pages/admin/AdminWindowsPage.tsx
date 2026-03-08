import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listExamWindows, deleteExamWindow } from '../../services/examWindowService';
import { listExams } from '../../services/examService';
import { listClasses } from '../../services/ttdtDataService';
import type { ExamWindow } from '../../types';

export default function AdminWindowsPage() {
  const [windows, setWindows] = useState<ExamWindow[]>([]);
  const [exams, setExams] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    if (!window.confirm('Xóa kỳ thi này? Thí sinh sẽ không thể vào thi bằng mã này.')) return;
    try {
      await deleteExamWindow(id);
      setWindows((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa.');
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleString('vi-VN');
  };

  if (loading) return <p className="text-slate-500">Đang tải...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Kỳ thi</h1>
        <Link
          to="/admin/windows/new"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Thêm kỳ thi
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Đề thi</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Lớp</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Bắt đầu</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Kết thúc</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Mã truy cập</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {windows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Chưa có kỳ thi. Nhấn "Thêm kỳ thi" để tạo cửa sổ thi.
                </td>
              </tr>
            ) : (
              windows.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">{exams[w.exam_id] ?? w.exam_id}</td>
                  <td className="px-4 py-2">{classes[w.class_id] ?? w.class_id}</td>
                  <td className="px-4 py-2 text-slate-600">{formatTime(w.start_at)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatTime(w.end_at)}</td>
                  <td className="px-4 py-2 font-mono text-sm">{w.access_code}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/admin/windows/${w.id}`} className="text-indigo-600 hover:underline mr-3">
                      Sửa
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(w.id)}
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
