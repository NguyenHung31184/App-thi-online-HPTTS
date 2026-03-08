import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listPracticalTemplates,
  deletePracticalTemplate,
} from '../../services/practicalTemplateService';
import type { PracticalExamTemplate } from '../../types';

export default function AdminPracticalTemplatesPage() {
  const [templates, setTemplates] = useState<PracticalExamTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listPracticalTemplates();
      setTemplates(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải danh sách mẫu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Xóa mẫu "${title}"? Các tiêu chí và kỳ thi liên quan sẽ bị ảnh hưởng.`))
      return;
    try {
      await deletePracticalTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa mẫu.');
    }
  };

  if (loading) return <p className="text-slate-500">Đang tải...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Mẫu thi thực hành</h1>
        <div className="flex gap-2">
          <Link
            to="/admin/practical-sessions"
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Kỳ thi thực hành
          </Link>
          <Link
            to="/admin/practical-templates/new"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Thêm mẫu
          </Link>
        </div>
      </div>
      <p className="text-slate-600 text-sm mb-4">
        Mẫu thi thực hành gồm các tiêu chí chấm (max_score, weight). Sau khi tạo mẫu, thêm tiêu chí rồi tạo kỳ thi.
      </p>
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Tiêu đề</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Mô tả</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Thời gian (phút)</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Chưa có mẫu. Nhấn "Thêm mẫu" để tạo.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link to={`/admin/practical-templates/${t.id}`} className="text-indigo-600 hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600 max-w-xs truncate">{t.description || '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{t.duration_minutes ?? '—'}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/admin/practical-templates/${t.id}`}
                      className="text-slate-600 hover:text-slate-900 mr-3"
                    >
                      Sửa / Tiêu chí
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(t.id, t.title)}
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
