import { useNavigate } from 'react-router-dom';

export default function RoleSelectPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40 p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">Chọn vai trò của bạn</h1>
        <p className="text-slate-500 text-sm text-center mb-8">
          Vui lòng chọn đúng vai trò để vào màn hình phù hợp.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="group rounded-xl border border-slate-200 p-4 text-left hover:border-indigo-500 hover:shadow-md transition-all bg-slate-50/60"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-1">Quản trị</p>
            <p className="font-semibold text-slate-800 mb-1">Admin</p>
            <p className="text-xs text-slate-500">
              Đăng nhập bằng email và mật khẩu để cấu hình đề thi, kỳ thi, xem báo cáo, đồng bộ điểm.
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="group rounded-xl border border-slate-200 p-4 text-left hover:border-blue-500 hover:shadow-md transition-all bg-slate-50/60"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 mb-1">Giáo viên</p>
            <p className="font-semibold text-slate-800 mb-1">Instruction</p>
            <p className="text-xs text-slate-500">
              Dùng tài khoản được cấp để chấm bài, xem kết quả, hỗ trợ coi thi.
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/verify-cccd')}
            className="group rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-500 hover:shadow-md transition-all bg-emerald-50/60"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-500 mb-1">Thí sinh</p>
            <p className="font-semibold text-slate-800 mb-1">Student</p>
            <p className="text-xs text-slate-500">
              Không cần tài khoản. Chụp CCCD để hệ thống xác thực và cho vào màn hình thi.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

