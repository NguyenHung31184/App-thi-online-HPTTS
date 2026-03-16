import { useState, useMemo } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AppLayout, { type NavSection } from '../components/AppLayout';
import { DashboardIcon, IdCardIcon, SettingsIcon, ExamIcon, GradingIcon } from '../components/Icons';

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
  const isAdmin = (user as any)?.role === 'admin';

  const navSections: NavSection[] = useMemo(() => {
    // Nếu là Admin, ẩn hoàn toàn các mục HOME/STUDENT và để họ dùng khu Quản trị riêng.
    if (isAdmin) {
      return [
        {
          id: 'home',
          title: 'HOME',
          items: [{ to: '/dashboard', label: 'Dashboard', icon: DashboardIcon }],
        },
      ];
    }

    const sections: NavSection[] = [
      {
        id: 'home',
        title: 'HOME',
        items: [{ to: '/dashboard', label: 'Dashboard', icon: DashboardIcon }],
      },
      {
        id: 'student',
        title: 'STUDENT',
        items: [
          { to: '/student/exams', label: 'Exams', icon: ExamIcon },
          { to: '/student/results', label: 'Result', icon: GradingIcon },
          { to: '/verify-cccd', label: 'Xác thực CCCD', icon: IdCardIcon },
        ],
      },
    ];
    // Chỉ Admin có nhóm ADMIN, chuẩn bị sẵn để sau này map với app quản lý.
    if (isAdmin) {
      sections.push({
        id: 'admin',
        title: 'ADMIN',
        items: [{ to: '/admin', label: 'Quản trị', icon: SettingsIcon }],
      });
    }
    return sections;
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
    isAdmin
      ? 'Admin'
      : user?.role === 'teacher'
      ? 'Giáo viên'
      : 'Thí sinh';

  return (
    <AppLayout
      navSections={navSections}
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
