import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">Đang tải...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'teacher') {
    return <Navigate to="/dashboard" replace />;
  }

  const base = '/admin';
  const nav = [
    { to: `${base}/exams`, label: 'Đề thi' },
    { to: `${base}/windows`, label: 'Kỳ thi' },
    { to: `${base}/practical-templates`, label: 'Thi thực hành' },
    { to: `${base}/essay-grading`, label: 'Chấm tự luận' },
    { to: `${base}/report`, label: 'Báo cáo' },
    { to: `${base}/sync`, label: 'Đồng bộ điểm' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="font-semibold text-slate-800">App Thi Online</Link>
          <Link to="/dashboard" className="text-slate-600 hover:text-slate-900">Trang chủ</Link>
          {nav.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={location.pathname.startsWith(to) ? 'text-indigo-600 font-medium' : 'text-slate-600 hover:text-slate-900'}
            >
              {label}
            </Link>
          ))}
        </div>
        <span className="text-sm text-slate-500">Quản trị</span>
      </header>
      <main className="p-4 max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
