import { useState, useMemo } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppLayout from '../components/AppLayout';
import { DashboardIcon, IdCardIcon, SettingsIcon } from '../components/Icons';

const viewTitles: Record<string, string> = {
  '/dashboard': 'Trang chủ',
  '/': 'Trang chủ',
  '/verify-cccd': 'Xác thực CCCD',
  '/admin': 'Quản trị',
};

export default function Layout() {
  const { user, studentSession, loading, signOut } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const navItems = useMemo(() => {
    const items = [
      { to: '/dashboard', label: 'Trang chủ', icon: DashboardIcon },
      { to: '/verify-cccd', label: 'Xác thực CCCD', icon: IdCardIcon },
    ];
    if (user?.role === 'admin' || user?.role === 'teacher') {
      items.push({ to: '/admin', label: 'Quản trị', icon: SettingsIcon });
    }
    return items;
  }, [user?.role]);

  const title = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/admin')) return 'Quản trị';
    return viewTitles[path] ?? 'App Thi Online';
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40">
        <p className="text-slate-500">Đang tải...</p>
      </div>
    );
  }

  if (!user && !studentSession) {
    return <Navigate to="/start" replace />;
  }

  const displayEmail =
    user?.email ?? studentSession?.student_code ?? studentSession?.student_id ?? 'Thí sinh';
  const displayRole =
    user?.role === 'admin'
      ? 'Admin'
      : user?.role === 'teacher'
      ? 'Giáo viên'
      : 'Thí sinh';

  return (
    <AppLayout
      navItems={navItems}
      title={title}
      userEmail={displayEmail}
      userRole={displayRole}
      onLogout={() => signOut()}
      isSidebarOpen={isSidebarOpen}
      setSidebarOpen={setSidebarOpen}
    >
      <Outlet />
    </AppLayout>
  );
}
