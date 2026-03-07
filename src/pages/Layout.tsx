import { Outlet, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <p className="text-slate-500">Đang tải...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="font-semibold text-slate-800">App Thi Online</Link>
          <Link to="/dashboard" className="text-slate-600 hover:text-slate-900">Trang chủ</Link>
          <Link to="/verify-cccd" className="text-slate-600 hover:text-slate-900">Xác thực CCCD</Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{user.email}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Đăng xuất
          </button>
        </div>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
