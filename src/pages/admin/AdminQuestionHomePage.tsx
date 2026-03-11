import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listOccupations } from '../../services/occupationService';
import { listQuestionsByOccupation } from '../../services/questionBankService';
import type { Occupation } from '../../types';

export default function AdminQuestionHomePage() {
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    listOccupations()
      .then(async (list) => {
        setOccupations(list);
        const next: Record<string, number> = {};
        for (const o of list) {
          try {
            const q = await listQuestionsByOccupation(o.id);
            next[o.id] = q.length;
          } catch {
            next[o.id] = 0;
          }
        }
        setCounts(next);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Lỗi tải danh sách nghề.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-500">Đang tải...</p>;
  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-2">Soạn câu hỏi</h1>
      <p className="text-slate-600 text-sm mb-6">
        Soạn câu hỏi <strong>theo nghề đào tạo</strong> (không theo khóa học). Chọn một nghề bên dưới để thêm/sửa câu hỏi trong ngân hàng hoặc import từ Excel. Phần này tách riêng, không phụ thuộc vào việc tạo đề thi.
      </p>

      {occupations.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-amber-800 text-sm">
          <p className="font-medium mb-2">Chưa có nghề đào tạo.</p>
          <p>App thi online lấy danh sách nghề từ bảng <strong>courses</strong> (cùng Supabase với app quản lý TTDT). Kiểm tra đã có dữ liệu trong bảng <code className="bg-amber-100 px-1 rounded">courses</code> chưa và RLS/policy có cho phép đọc không.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Nghề đào tạo</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Mã</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Số câu trong ngân hàng</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {occupations.map((occ) => (
                <tr key={occ.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{occ.name}</td>
                  <td className="px-4 py-2 text-slate-600">{occ.code ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{counts[occ.id] ?? 0}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/admin/questions/occupation/${occ.id}`}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                    >
                      Soạn câu hỏi
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
