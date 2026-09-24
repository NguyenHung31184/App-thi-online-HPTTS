import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { countQuestionsByStatus } from '../domain/question-library';
import type { LibraryOutletContext } from './library-context';
import { useOccupationOptions, useQuestionLibraries, useQuestionLibraryWorkspace } from '../queries/use-question-library';
import { errorMessage, focusRing, libraryCourse, questionStatusLabels } from './labels';
import { BackLink, ErrorState, LoadingState } from './states';

const tabs = [
  { to: '', label: 'Cây kiến thức', end: true },
  { to: 'questions', label: 'Câu hỏi', end: false },
  { to: 'imports', label: 'Nhập tài liệu', end: false },
];

export default function QuestionLibraryLayout() {
  const { libraryId = '' } = useParams();
  const { data: libraries = [], isLoading, error, refetch } = useQuestionLibraries();
  const { data: occupations = [] } = useOccupationOptions();
  const library = libraries.find((item) => item.id === libraryId) ?? null;
  const { data: workspace, isLoading: workspaceLoading, error: workspaceError, refetch: refetchWorkspace } = useQuestionLibraryWorkspace(library ? libraryId : '');

  if (isLoading) return <LoadingState>Đang tải ngân hàng câu hỏi…</LoadingState>;
  if (error) {
    return <ErrorState title="Không tải được ngân hàng câu hỏi" detail={errorMessage(error, 'Kiểm tra kết nối mạng.')} onRetry={() => void refetch()} action={<BackLink to="/admin/question-libraries">Về danh sách ngân hàng</BackLink>} />;
  }
  if (!library) {
    return <ErrorState title="Không tìm thấy ngân hàng này" detail="Ngân hàng có thể đã bị lưu trữ, hoặc tài khoản của bạn không có quyền xem." action={<BackLink to="/admin/question-libraries">Về danh sách ngân hàng</BackLink>} />;
  }

  const counts = workspace ? countQuestionsByStatus(workspace.questions) : null;
  const context: LibraryOutletContext = { library, workspace, workspaceLoading, workspaceError, refetchWorkspace: () => void refetchWorkspace() };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-600">{libraryCourse(library, occupations)}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 break-words">{library.name}</h1>
          {library.description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{library.description}</p>}
        </div>
        <BackLink to="/admin/question-libraries">Tất cả ngân hàng</BackLink>
      </header>

      {/* Each count opens the questions tab filtered to that status, so the number leads straight to the rows behind it. */}
      <ul className="flex flex-wrap gap-x-2 gap-y-1 text-sm" aria-label="Số câu hỏi theo trạng thái">
        {(['published', 'review', 'draft', 'retired'] as const).map((status) => (
          <li key={status}>
            <Link to={`questions?status=${status}`} className={`inline-flex min-h-11 items-baseline gap-2 rounded-lg px-2 pt-2.5 hover:bg-slate-100 ${focusRing}`}>
              <span className="text-slate-600">{questionStatusLabels[status]}</span>
              <span className="text-lg font-semibold tabular-nums text-slate-900">{counts ? counts[status] : '…'}</span>
            </Link>
          </li>
        ))}
      </ul>

      <nav aria-label="Mục trong ngân hàng" className="border-b border-slate-200">
        <ul className="-mb-px flex flex-wrap gap-1">
          {tabs.map((tab) => (
            <li key={tab.label}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) => `inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${focusRing} ${isActive ? 'border-indigo-700 text-indigo-800' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Outlet context={context} />
    </div>
  );
}
