import { useState, useMemo } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AppLayout, { type NavSection } from '../../components/AppLayout';
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

const adminTitles: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/question-libraries': 'Ngân hàng câu hỏi',
  '/admin/exams': 'Đề thi & ma trận',
  '/admin/questions': 'Ngân hàng câu hỏi',
  '/admin/windows': 'Kỳ thi',
  '/admin/practical-templates': 'Mẫu đánh giá',
  '/admin/practical-sessions': 'Ca thi thực hành',
  '/admin/essay-grading': 'Chấm tự luận',
  '/admin/practical-grading': 'Chấm thi thực hành',
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
          title: 'HOME',
          items: [{ to: '/admin/dashboard', label: 'Dashboard', icon: DashboardIcon }],
        },
        {
          id: 'theory',
          title: 'THI LÝ THUYẾT',
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
        title: 'HOME',
        items: [{ to: '/admin/dashboard', label: 'Dashboard', icon: DashboardIcon }],
      },
      {
        id: 'theory',
        title: 'THI LÝ THUYẾT',
        items: [
          { to: '/admin/question-libraries', label: 'Ngân hàng câu hỏi', icon: QuestionBankIcon },
          { to: '/admin/exams', label: 'Đề thi & ma trận', icon: ExamIcon },
          { to: '/admin/windows', label: 'Kỳ thi', icon: CalendarIcon },
          { to: '/admin/essay-grading', label: 'Chấm tự luận', icon: EssayGradingIcon },
          { to: '/admin/report', label: 'Báo cáo lý thuyết', icon: ReportIcon },
        ],
      },
      {
        id: 'practical',
        title: 'THI THỰC HÀNH',
        items: [
          { to: '/admin/practical-templates', label: 'Mẫu đánh giá', icon: PracticalIcon },
          { to: '/admin/practical-sessions', label: 'Ca thi thực hành', icon: CalendarIcon },
          { to: '/admin/practical-grading', label: 'Chấm thực hành', icon: PracticalIcon },
        ],
      },
      {
        id: 'system',
        title: 'HỆ THỐNG',
        items: [{ to: '/admin/sync', label: 'Nhật ký đồng bộ TTDT', icon: SyncIcon }],
      },
    ];
  }, [isTeacher]);

  const title = useMemo(() => getAdminTitle(location.pathname), [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40">
        <p className="text-slate-500">Đang tải...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  const role = (user as { role?: string }).role;
  if (role !== 'admin' && role !== 'teacher') {
    return <Navigate to="/dashboard" replace />;
  }

  // Teachers can access the question library, exam authoring, reports, and attempt details.
  const teacherAllowedPrefixes = ['/admin', '/admin/dashboard', '/admin/exams', '/admin/questions', '/admin/question-libraries', '/admin/report', '/admin/attempts'];
  if (isTeacher && !teacherAllowedPrefixes.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <AppLayout
      navSections={navSections}
      title={title}
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
