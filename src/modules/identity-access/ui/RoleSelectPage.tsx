import { useNavigate } from 'react-router-dom';

export default function RoleSelectPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-50 p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">Chọn vai trò của bạn</h1>
        <p className="text-slate-500 text-sm text-center mb-8">
          Vui lòng chọn đúng vai trò để vào màn hình phù hợp.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="group rounded-xl border border-slate-200 p-4 text-left hover:border-brand-500 transition-colors bg-slate-50"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 mb-1">Quản trị</p>
            <p className="font-semibold text-slate-800 mb-1">Admin</p>
            <p className="text-xs text-slate-500">
              Đăng nhập bằng email và mật khẩu để cấu hình đề thi, kỳ thi, xem báo cáo, đồng bộ điểm.
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="group rounded-xl border border-slate-200 p-4 text-left hover:border-brand-500 transition-colors bg-slate-50"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 mb-1">Giáo viên</p>
            <p className="font-semibold text-slate-800 mb-1">Instructor</p>
            <p className="text-xs text-slate-500">
              Dùng tài khoản được cấp để chấm bài, xem kết quả, hỗ trợ coi thi.
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="group rounded-xl border border-slate-200 p-4 text-left hover:border-brand-500 transition-colors bg-slate-50"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 mb-1">Thí sinh</p>
            <p className="font-semibold text-slate-800 mb-1">Student</p>
            <p className="text-xs text-slate-500">
              Đăng nhập bằng tài khoản thi (mã học viên/email + mật khẩu). Sau khi đăng nhập, vào mục “Xác thực CCCD” để hệ thống kiểm tra rồi vào phòng thi.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

