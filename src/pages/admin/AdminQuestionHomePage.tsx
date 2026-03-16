import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listOccupations } from '../../services/occupationService';
import { listQuestionsByOccupation } from '../../services/questionBankService';
import type { Occupation } from '../../types';
import { ExamCard } from '../../components/ExamCard';

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

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-2">Soạn câu hỏi</h1>
      <p className="text-slate-600 text-sm mb-6">
        Soạn câu hỏi <strong>theo nghề đào tạo</strong> (không theo khóa học). Chọn một nghề bên dưới để thêm/sửa câu hỏi trong ngân hàng hoặc import từ Excel. Phần này tách riêng, không phụ thuộc vào việc tạo đề thi.
      </p>

      {loading && <p className="text-slate-500">Đang tải...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && occupations.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-amber-800 text-sm">
          <p className="font-medium mb-2">Chưa có nghề đào tạo.</p>
          <p>App thi online lấy danh sách nghề từ bảng <strong>courses</strong> (cùng Supabase với app quản lý TTDT). Kiểm tra đã có dữ liệu trong bảng <code className="bg-amber-100 px-1 rounded">courses</code> chưa và RLS/policy có cho phép đọc không.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {occupations.map((occ) => (
            <ExamCard
              key={occ.id}
              title={occ.name}
              subtitle={occ.code ? `Mã nghề: ${occ.code}` : undefined}
              meta="Nghề đào tạo"
              footerLeft={
                <>
                  <span className="font-semibold">{counts[occ.id] ?? 0}</span>
                  <span className="text-slate-500 ml-1">câu trong ngân hàng</span>
                </>
              }
              footerRight={
                <Link
                  to={`/admin/questions/occupation/${occ.id}`}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  Soạn câu hỏi
                </Link>
              }
              onClick={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
