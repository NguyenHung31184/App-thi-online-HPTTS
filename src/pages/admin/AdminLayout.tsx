import { useState, useMemo } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { adminAreaAccess, useAuth } from '../../modules/identity-access/public';
import AppLayout, { type NavSection } from '../../components/AppLayout';
import { SyncStatusChip } from '../../modules/integrations/public';
import { NetworkChip } from '../../shared/ui/NetworkChip';
import {
  ExamIcon,
  CalendarIcon,
  PracticalIcon,
  ReportIcon,
  SyncIcon,
  DashboardIcon,
  QuestionBankIcon,
} from '../../components/Icons';

const adminTitles: Record<string, string> = {
  '/admin/dashboard': 'Tổng quan',
  '/admin/question-libraries': 'Ngân hàng câu hỏi',
  '/admin/exams': 'Đề thi & ma trận',
  '/admin/questions': 'Ngân hàng câu hỏi',
  '/admin/windows': 'Kỳ thi',
  '/admin/practical-templates': 'Mẫu đánh giá',
  '/admin/practical-sessions': 'Ca thi thực hành',
  '/admin/practical-grading': 'Kết quả thực hành',
  '/admin/report': 'Báo cáo lý thuyết',
  '/admin/sync': 'Nhật ký đồng bộ TTDT',
};

function getAdminTitle(pathname: string): string {
  if (pathname === '/admin' || pathname === '/admin/') return 'Quản trị';
  if (pathname.startsWith('/admin/attempts/')) return 'Chi tiết bài làm';
  // Lấy route khớp dài nhất, để '/admin/question-libraries/x' không rơi vào key ngắn hơn.
  let match = '';
  for (const path of Object.keys(adminTitles)) {
    if ((pathname === path || pathname.startsWith(`${path}/`)) && path.length > match.length) match = path;
  }
  return match ? adminTitles[match] : 'Quản trị';
}

export default function AdminLayout() {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const isTeacher = (user as { role?: string })?.role === 'teacher';

  const navSections: NavSection[] = useMemo(() => {
    if (isTeacher) {
      return [
        {
          id: 'home',
          title: 'Trang chủ',
          items: [{ to: '/admin/dashboard', label: 'Tổng quan', icon: DashboardIcon }],
        },
        {
          id: 'theory',
          title: 'Thi lý thuyết',
          items: [
            { to: '/admin/question-libraries', label: 'Ngân hàng câu hỏi', icon: QuestionBankIcon },
            { to: '/admin/exams', label: 'Đề thi & ma trận', icon: ExamIcon },
            { to: '/admin/report', label: 'Báo cáo lý thuyết', icon: ReportIcon },
          ],
        },
      ];
    }
    return [
      {
        id: 'home',
        title: 'Trang chủ',
        items: [{ to: '/admin/dashboard', label: 'Tổng quan', icon: DashboardIcon }],
      },
      {
        id: 'theory',
        title: 'Thi lý thuyết',
        items: [
          { to: '/admin/question-libraries', label: 'Ngân hàng câu hỏi', icon: QuestionBankIcon },
          { to: '/admin/exams', label: 'Đề thi & ma trận', icon: ExamIcon },
          { to: '/admin/windows', label: 'Kỳ thi', icon: CalendarIcon },
          { to: '/admin/report', label: 'Báo cáo lý thuyết', icon: ReportIcon },
        ],
      },
      {
        id: 'practical',
        title: 'Thi thực hành',
        items: [
          { to: '/admin/practical-templates', label: 'Mẫu đánh giá', icon: PracticalIcon },
          { to: '/admin/practical-sessions', label: 'Ca thi thực hành', icon: CalendarIcon },
          { to: '/admin/practical-grading', label: 'Kết quả thực hành', icon: ReportIcon },
        ],
      },
      {
        id: 'system',
        title: 'Hệ thống',
        items: [{ to: '/admin/sync', label: 'Nhật ký đồng bộ TTDT', icon: SyncIcon }],
      },
    ];
  }, [isTeacher]);

  const title = useMemo(() => getAdminTitle(location.pathname), [location.pathname]);

  const access = adminAreaAccess({ loading, user, pathname: location.pathname });
  if (access.kind === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Đang tải...</p>
      </div>
    );
  }
  if (access.kind === 'redirect' || !user) return <Navigate to={access.kind === 'redirect' ? access.to : '/login'} replace />;

  return (
    <AppLayout
      navSections={navSections}
      title={title}
      breadcrumb="Quản trị"
      headerChips={<><NetworkChip />{!isTeacher && <SyncStatusChip />}</>}
      userEmail={user.email}
      userRole={isTeacher ? 'Giáo viên' : 'Admin'}
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
