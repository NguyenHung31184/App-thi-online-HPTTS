import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { QuestionType } from '../../../types';
import { QUESTION_TYPES } from '../domain/question-draft';
import { filterLibraryQuestions, questionIssues, type LibraryQuestionFilter, type QuestionStatus } from '../domain/question-library';
import { useChangeQuestionStatus, useQuestionExport, useRemoveQuestions } from '../queries/use-question-actions';
import { ConfirmDialog } from './confirm-dialog';
import { saveFile } from './download';
import { useLibraryContext } from './library-context';
import {
  deleteExplanation, drawWarning, errorMessage, fieldClass, focusRing, questionStatusLabels, questionStatusTone, questionTypeLabels, removeResultMessage,
} from './labels';
import { EmptyState, ErrorState, LoadingState } from './states';

const statuses: QuestionStatus[] = ['published', 'review', 'draft', 'retired'];
type BulkAction = QuestionStatus | 'delete';
const bulkActions: { value: BulkAction; label: string }[] = [
  { value: 'published', label: 'Chuyển sang Đã phát hành' },
  { value: 'review', label: 'Chuyển sang Chờ duyệt' },
  { value: 'draft', label: 'Chuyển sang Bản nháp' },
  { value: 'retired', label: 'Chuyển sang Ngừng sử dụng' },
  { value: 'delete', label: 'Xóa' },
];
const linkClass = `inline-flex min-h-11 items-center rounded px-1 font-medium text-indigo-700 hover:text-indigo-900 ${focusRing}`;
const secondaryClass = `inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${focusRing}`;

export default function QuestionLibraryQuestionsPage() {
  const { library, workspace, workspaceLoading, workspaceError, refetchWorkspace } = useLibraryContext();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const changeStatus = useChangeQuestionStatus(library.id);
  const remove = useRemoveQuestions(library.id);
  const exporter = useQuestionExport();
  const actionId = useId();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [action, setAction] = useState<BulkAction | ''>('');
  const [confirming, setConfirming] = useState(false);

  const rawStatus = params.get('status') ?? '';
  const status: LibraryQuestionFilter['status'] = rawStatus === 'all' || statuses.includes(rawStatus as QuestionStatus) ? rawStatus as LibraryQuestionFilter['status'] : '';
  const rawType = params.get('type') ?? '';
  const type: NonNullable<LibraryQuestionFilter['type']> = rawType === 'broken' || QUESTION_TYPES.includes(rawType as QuestionType) ? rawType as QuestionType | 'broken' : '';
  // The editor returns here with the same filters.
  const returnState = { returnTo: `${location.pathname}${location.search}` };
  const taxonomyNodeId = params.get('node') ?? '';
  const text = params.get('q') ?? '';
  const nodes = useMemo(() => workspace?.nodes ?? [], [workspace]);
  const questions = useMemo(() => workspace?.questions ?? [], [workspace]);
  const nodeNames = useMemo(() => new Map(nodes.map((node) => [node.id, node.name])), [nodes]);
  const visible = useMemo(
    () => filterLibraryQuestions(questions, nodes, { status, taxonomyNodeId, text, type }),
    [questions, nodes, status, taxonomyNodeId, text, type],
  );
  const issuesById = useMemo(() => new Map(questions.map((question) => [question.id, questionIssues(question)])), [questions]);
  const brokenCount = questions.filter((question) => question.status !== 'retired' && (issuesById.get(question.id)?.length ?? 0) > 0).length;

  // Actions apply to the selected rows that are on screen, never to rows hidden by a filter.
  const selectedVisible = visible.filter((question) => selected.has(question.id));
  const allSelected = visible.length > 0 && selectedVisible.length === visible.length;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedVisible.length > 0 && !allSelected;
  });

  const setFilter = (key: 'status' | 'node' | 'q' | 'type', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((current) => {
    const next = new Set(current);
    for (const question of visible) {
      if (allSelected) next.delete(question.id); else next.add(question.id);
    }
    return next;
  });

  const runAction = async () => {
    const ids = selectedVisible.map((question) => question.id);
    try {
      if (action === 'delete') {
        toast.success(removeResultMessage(await remove.mutateAsync(ids)));
      } else if (action) {
        const changed = await changeStatus.mutateAsync({ ids, status: action });
        toast.success(`Đã chuyển ${changed} câu sang ${questionStatusLabels[action]}.`);
      }
      setSelected(new Set());
      setAction('');
    } catch (reason) {
      toast.error(errorMessage(reason, 'Không thực hiện được thao tác.'));
    } finally {
      setConfirming(false);
    }
  };

  const exportVisible = async () => {
    try {
      saveFile(await exporter.mutateAsync({ questions: visible, libraryName: library.name }));
    } catch {
      toast.error('Không xuất được file Excel.');
    }
  };

  const hasFilter = Boolean(status || taxonomyNodeId || text || type);
  const count = selectedVisible.length;
  const brokenSelected = selectedVisible.filter((question) => (issuesById.get(question.id)?.length ?? 0) > 0).length;
  const pending = changeStatus.isPending || remove.isPending;

  return (
    <div className="space-y-4">
      <h2 className="sr-only">Danh sách câu hỏi</h2>
      <form role="search" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]" onSubmit={(event) => event.preventDefault()}>
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
        <label className="grid gap-1 text-sm font-medium text-slate-700">Loại câu
          <select value={type} onChange={(event) => setFilter('type', event.target.value)} className={fieldClass}>
            <option value="">Tất cả loại câu</option>
            {QUESTION_TYPES.map((value) => <option key={value} value={value}>{questionTypeLabels[value]}</option>)}
            <option value="broken">Câu có lỗi dữ liệu</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">Mục trong cây kiến thức
          <select value={taxonomyNodeId} onChange={(event) => setFilter('node', event.target.value)} className={fieldClass}>
            <option value="">Tất cả mục</option>
            {nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
          </select>
        </label>
      </form>

      {brokenCount > 0 && type !== 'broken' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-1 text-sm text-amber-900">
          <p><strong>{brokenCount}</strong> câu có lỗi dữ liệu, thí sinh gặp các câu này sẽ không làm được.</p>
          <button type="button" onClick={() => setFilter('type', 'broken')} className={`inline-flex min-h-11 items-center rounded px-1 font-semibold underline ${focusRing}`}>Xem các câu lỗi</button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-slate-600" aria-live="polite">
          {workspace ? `Đang hiện ${visible.length} trên ${questions.length} câu` : ''}
          {hasFilter && workspace && (
            <button type="button" onClick={() => setParams({}, { replace: true })} className={`ml-2 ${linkClass}`}>Bỏ lọc</button>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void exportVisible()} disabled={visible.length === 0 || exporter.isPending} className={secondaryClass}>
            Xuất Excel ({visible.length} câu)
          </button>
          <Link to="import" className={secondaryClass}>Nhập từ Excel/ZIP</Link>
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
          <button type="button" onClick={() => setParams({}, { replace: true })} className={linkClass}>Bỏ lọc</button>
        </EmptyState>
      )}

      {visible.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-1 text-sm sm:px-4">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-medium text-slate-800">
            <input ref={selectAllRef} type="checkbox" checked={allSelected} onChange={toggleAll} className={`h-5 w-5 accent-indigo-700 ${focusRing}`} />
            Chọn tất cả câu đang hiện
          </label>
          <span className="text-slate-600" aria-live="polite">Đã chọn {count}</span>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 py-1">
            <label htmlFor={actionId} className="sr-only">Thao tác với các câu đã chọn</label>
            <select id={actionId} value={action} onChange={(event) => setAction(event.target.value as BulkAction | '')} className={`${fieldClass} sm:w-auto`}>
              <option value="">Chọn thao tác…</option>
              {bulkActions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <button type="button" onClick={() => setConfirming(true)} disabled={!action || count === 0 || pending} className={`${secondaryClass} font-semibold`}>
              Áp dụng
            </button>
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {visible.map((question) => {
            const issues = issuesById.get(question.id) ?? [];
            return (
              <li key={question.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1 px-2 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start sm:px-3">
                <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
                  <input type="checkbox" checked={selected.has(question.id)} onChange={() => toggle(question.id)} className={`h-5 w-5 accent-indigo-700 ${focusRing}`} />
                  <span className="sr-only">Chọn câu: {question.stem.slice(0, 80)}</span>
                </label>
                <div className="min-w-0 py-2">
                  <p className="text-sm leading-6 text-slate-900 line-clamp-3 break-words">{question.stem || 'Câu hỏi chưa có nội dung.'}</p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span>{questionTypeLabels[question.questionType] ?? question.questionType}</span>
                    <span>{question.points} điểm</span>
                    {question.taxonomyNodeId && <span>{nodeNames.get(question.taxonomyNodeId) ?? 'Mục đã xóa'}</span>}
                    {!question.taxonomyNodeId && question.topic && <span>{question.topic}</span>}
                    {(question.imageUrl || question.mediaUrl) && <span>Có hình hoặc video</span>}
                  </p>
                  {issues.length > 0 && (
                    <p className="mt-1 text-xs font-medium text-amber-900">
                      Lỗi: {issues[0].message}{issues.length > 1 ? ` (và ${issues.length - 1} lỗi khác)` : ''}
                    </p>
                  )}
                </div>
                <div className="col-start-2 flex items-center gap-3 sm:col-start-auto sm:justify-end sm:py-1">
                  <span className={`rounded-md px-2 py-1 text-xs font-medium ${questionStatusTone[question.status]}`}>{questionStatusLabels[question.status]}</span>
                  <Link to={question.id} state={returnState} className={`${linkClass} text-sm`}>Sửa</Link>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <ConfirmDialog
        open={confirming}
        title={action === 'delete' ? `Xóa ${count} câu?` : `Chuyển ${count} câu sang ${action ? questionStatusLabels[action] : ''}?`}
        confirmLabel={action === 'delete' ? 'Xóa' : 'Chuyển trạng thái'}
        tone={action === 'delete' ? 'danger' : 'primary'}
        pending={pending}
        onConfirm={() => void runAction()}
        onCancel={() => setConfirming(false)}
      >
        {action === 'delete' && <p>{deleteExplanation}</p>}
        {action === 'published' && <p>Các câu này sẽ được bốc vào đề thi của mô-đun.</p>}
        {action === 'published' && brokenSelected > 0 && (
          <p className="font-medium text-amber-900">{brokenSelected} câu đang có lỗi dữ liệu, thí sinh gặp các câu này sẽ không làm được.</p>
        )}
        {action !== 'published' && <p>{drawWarning}</p>}
      </ConfirmDialog>
    </div>
  );
}
