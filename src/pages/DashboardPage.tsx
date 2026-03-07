import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Dashboard</h2>
      <p className="text-slate-600 mb-6">
        Danh sách kỳ thi được phép làm sẽ hiển thị tại đây (Phase 2). Hiện tại chỉ là màn hình placeholder.
      </p>
      {user?.student_id && (
        <p className="text-sm text-slate-500 mb-4">
          Đã xác thực CCCD: {user.student_name || user.student_code}
        </p>
      )}
      <div className="flex gap-3">
        <Link
          to="/verify-cccd"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Xác thực CCCD
        </Link>
      </div>
    </div>
  );
}
