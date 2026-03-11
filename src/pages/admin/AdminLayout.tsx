import { useState, useMemo } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AppLayout from '../../components/AppLayout';
import {
  ExamIcon,
  CalendarIcon,
  PracticalIcon,
  EssayGradingIcon,
  ReportIcon,
  SyncIcon,
  DashboardIcon,
  QuestionBankIcon,
} from '../../components/Icons';

const adminNavItems = [
  { to: '/admin/exams', label: 'Đề thi', icon: ExamIcon },
  { to: '/admin/questions', label: 'Soạn câu hỏi', icon: QuestionBankIcon },
  { to: '/admin/windows', label: 'Kỳ thi', icon: CalendarIcon },
  { to: '/admin/practical-templates', label: 'Thi thực hành', icon: PracticalIcon },
  { to: '/admin/essay-grading', label: 'Chấm tự luận', icon: EssayGradingIcon },
  { to: '/admin/report', label: 'Báo cáo', icon: ReportIcon },
  { to: '/admin/sync', label: 'Đồng bộ điểm', icon: SyncIcon },
];

const adminTitles: Record<string, string> = {
  '/admin': 'Quản trị',
  '/admin/exams': 'Đề thi',
  '/admin/questions': 'Soạn câu hỏi',
  '/admin/windows': 'Kỳ thi',
  '/admin/practical-templates': 'Thi thực hành',
  '/admin/practical-sessions': 'Ca thi thực hành',
  '/admin/essay-grading': 'Chấm tự luận',
  '/admin/practical-grading': 'Chấm thi thực hành',
  '/admin/report': 'Báo cáo',
  '/admin/sync': 'Đồng bộ điểm',
};

function getAdminTitle(pathname: string): string {
  if (pathname === '/admin' || pathname === '/admin/') return 'Quản trị';
  for (const [path, title] of Object.entries(adminTitles)) {
    if (pathname.startsWith(path)) return title;
  }
  return 'Quản trị';
}

export default function AdminLayout() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const navWithHome = useMemo(
    () => [{ to: '/dashboard', label: 'Trang chủ', icon: DashboardIcon }, ...adminNavItems],
    []
  );

  const title = useMemo(() => getAdminTitle(location.pathname), [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40">
        <p className="text-slate-500">Đang tải...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'teacher') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppLayout
      navItems={navWithHome}
      title={title}
      userEmail={user.email}
      userRole={user.role === 'admin' ? 'Admin' : 'Giáo viên'}
      onLogout={() => signOut()}
      isSidebarOpen={isSidebarOpen}
      setSidebarOpen={setSidebarOpen}
    >
      <div className="max-w-5xl mx-auto w-full">
        <Outlet />
      </div>
    </AppLayout>
  );
}
