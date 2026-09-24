import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { filterLibraryQuestions, type LibraryQuestionFilter, type QuestionStatus } from '../domain/question-library';
import { useLibraryContext } from './library-context';
import { errorMessage, focusRing, questionStatusLabels, questionStatusTone, questionTypeLabels } from './labels';
import { EmptyState, ErrorState, LoadingState } from './states';

const statuses: QuestionStatus[] = ['published', 'review', 'draft', 'retired'];
const fieldClass = `min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ${focusRing}`;

export default function QuestionLibraryQuestionsPage() {
  const { workspace, workspaceLoading, workspaceError, refetchWorkspace } = useLibraryContext();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const rawStatus = params.get('status') ?? '';
  const status: LibraryQuestionFilter['status'] = rawStatus === 'all' || statuses.includes(rawStatus as QuestionStatus) ? rawStatus as LibraryQuestionFilter['status'] : '';
  // The editor returns here with the same filters.
  const returnState = { returnTo: `${location.pathname}${location.search}` };
  const taxonomyNodeId = params.get('node') ?? '';
  const text = params.get('q') ?? '';
  const nodes = useMemo(() => workspace?.nodes ?? [], [workspace]);
  const questions = useMemo(() => workspace?.questions ?? [], [workspace]);
  const nodeNames = useMemo(() => new Map(nodes.map((node) => [node.id, node.name])), [nodes]);
  const visible = useMemo(
    () => filterLibraryQuestions(questions, nodes, { status, taxonomyNodeId, text }),
    [questions, nodes, status, taxonomyNodeId, text],
  );

  const setFilter = (key: 'status' | 'node' | 'q', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const hasFilter = Boolean(status || taxonomyNodeId || text);

  return (
    <div className="space-y-4">
      <h2 className="sr-only">Danh sách câu hỏi</h2>
      <form role="search" className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]" onSubmit={(event) => event.preventDefault()}>
        <label className="grid gap-1 text-sm font-medium text-slate-700">Tìm trong nội dung
          <input type="search" value={text} onChange={(event) => setFilter('q', event.target.value)} className={fieldClass} placeholder="Từ khóa trong câu hỏi hoặc chủ đề" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">Trạng thái
          <select value={status} onChange={(event) => setFilter('status', event.target.value)} className={fieldClass}>
            <option value="">Đang dùng (trừ Ngừng sử dụng)</option>
            <option value="all">Tất cả trạng thái</option>
            {statuses.map((value) => <option key={value} value={value}>{questionStatusLabels[value]}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">Mục trong cây kiến thức
          <select value={taxonomyNodeId} onChange={(event) => setFilter('node', event.target.value)} className={fieldClass}>
            <option value="">Tất cả mục</option>
            {nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
          </select>
        </label>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-slate-600" aria-live="polite">
          {workspace ? `Đang hiện ${visible.length} trên ${questions.length} câu` : ''}
          {hasFilter && workspace && (
            <button type="button" onClick={() => setParams({}, { replace: true })} className={`ml-2 inline-flex min-h-11 items-center rounded px-1 font-medium text-indigo-700 hover:text-indigo-900 ${focusRing}`}>Bỏ lọc</button>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="import" className={`inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 ${focusRing}`}>Nhập từ Excel/ZIP</Link>
          <Link to="new" state={returnState} className={`inline-flex min-h-11 items-center rounded-lg bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800 ${focusRing}`}>Thêm câu hỏi</Link>
        </div>
      </div>

      {workspaceLoading && <LoadingState>Đang tải câu hỏi…</LoadingState>}
      {workspaceError != null && <ErrorState title="Không tải được câu hỏi" detail={errorMessage(workspaceError, 'Kiểm tra kết nối mạng.')} onRetry={refetchWorkspace} />}
      {workspace && questions.length === 0 && (
        <EmptyState title="Ngân hàng chưa có câu hỏi">
          <p>Bấm "Thêm câu hỏi" để soạn từng câu, hoặc "Nhập từ Excel/ZIP" để nhập nhiều câu một lần.</p>
        </EmptyState>
      )}
      {workspace && questions.length > 0 && visible.length === 0 && (
        <EmptyState title="Không có câu nào khớp bộ lọc">
          <button type="button" onClick={() => setParams({}, { replace: true })} className={`inline-flex min-h-11 items-center rounded px-1 font-medium text-indigo-700 hover:text-indigo-900 ${focusRing}`}>Bỏ lọc</button>
        </EmptyState>
      )}

      {visible.length > 0 && (
        <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {visible.map((question) => (
            <li key={question.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="min-w-0">
                <p className="text-sm leading-6 text-slate-900 line-clamp-3 break-words">{question.stem || 'Câu hỏi chưa có nội dung.'}</p>
                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span>{questionTypeLabels[question.questionType] ?? question.questionType}</span>
                  <span>{question.points} điểm</span>
                  {question.taxonomyNodeId && <span>{nodeNames.get(question.taxonomyNodeId) ?? 'Mục đã xóa'}</span>}
                  {!question.taxonomyNodeId && question.topic && <span>{question.topic}</span>}
                  {(question.imageUrl || question.mediaUrl) && <span>Có hình hoặc video</span>}
                </p>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <span className={`rounded-md px-2 py-1 text-xs font-medium ${questionStatusTone[question.status]}`}>{questionStatusLabels[question.status]}</span>
                <Link to={question.id} state={returnState} className={`inline-flex min-h-11 items-center rounded px-1 text-sm font-medium text-indigo-700 hover:text-indigo-900 ${focusRing}`}>
                  Sửa
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
