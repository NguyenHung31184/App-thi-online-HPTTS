import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/AuthContext';
import type { ImportSourceKind } from '../domain/question-library';
import { useStageQuestionImport } from '../queries/use-question-library';
import { useLibraryContext } from './library-context';
import { errorMessage, focusRing, importJobLabels } from './labels';
import { EmptyState, ErrorState, LoadingState } from './states';

const sourceKinds: Record<string, ImportSourceKind> = {
  docx: 'docx', pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', webp: 'image',
};

const jobTone: Record<string, string> = {
  review_required: 'text-amber-900',
  failed: 'text-rose-800',
  completed: 'text-emerald-800',
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export default function QuestionLibraryImportsPage() {
  const { user } = useAuth();
  const { library, workspace, workspaceLoading, workspaceError, refetchWorkspace } = useLibraryContext();
  const stageImport = useStageQuestionImport(library.id);
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const documentImportEnabled = import.meta.env.VITE_DOCUMENT_IMPORT_ENABLED === '1';
  const jobs = workspace?.jobs ?? [];

  const submitImport = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !user || !documentImportEnabled) return;
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const sourceKind = sourceKinds[extension];
    if (!sourceKind) { toast.error('Chỉ nhận DOCX, PDF hoặc ảnh PNG, JPG, WEBP.'); return; }
    try {
      await stageImport.mutateAsync({ libraryId: library.id, requestedBy: user.id, file, sourceKind });
      setFile(null);
      setInputKey((key) => key + 1);
      toast.success('Đã tạo phiếu nhập. Bản nháp sẽ hiện ở đây khi worker xử lý xong.');
    } catch (reason) {
      toast.error(errorMessage(reason, 'Không thể tải tài liệu lên.'));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.5fr)]">
      <section aria-labelledby="upload-heading" className="h-fit rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="upload-heading" className="font-semibold text-slate-900">Tải tài liệu lên</h2>
        <p className="mt-1 text-sm text-slate-600">DOCX, PDF và ảnh được worker tách thành câu hỏi nháp để xem lại. Bản nháp không tự vào ngân hàng hay đề thi. File Excel/ZIP vẫn nhập ở kho câu hỏi cũ.</p>
        {!documentImportEnabled && (
          <p role="status" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Môi trường này chưa bật worker tách tài liệu, nên chưa tạo được phiếu nhập.</p>
        )}
        <form className="mt-4 space-y-3" onSubmit={submitImport}>
          <label className="block text-sm font-medium text-slate-700">Tài liệu
            <input
              key={inputKey}
              type="file"
              accept=".docx,.pdf,.png,.jpg,.jpeg,.webp"
              disabled={!documentImportEnabled}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className={`mt-1 block w-full text-sm text-slate-700 file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-medium file:text-indigo-800 hover:file:bg-indigo-100 disabled:opacity-60 ${focusRing}`}
            />
          </label>
          <button disabled={!file || stageImport.isPending || !documentImportEnabled} className={`min-h-11 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}>
            {stageImport.isPending ? 'Đang tải lên…' : 'Tạo phiếu nhập'}
          </button>
        </form>
      </section>

      <section aria-labelledby="jobs-heading" className="min-w-0">
        <h2 id="jobs-heading" className="mb-3 font-semibold text-slate-900">Phiếu nhập</h2>
        {workspaceLoading && <LoadingState>Đang tải phiếu nhập…</LoadingState>}
        {workspaceError != null && <ErrorState title="Không tải được phiếu nhập" detail={errorMessage(workspaceError, 'Kiểm tra kết nối mạng.')} onRetry={refetchWorkspace} />}
        {workspace && jobs.length === 0 && <EmptyState title="Chưa có phiếu nhập nào"><p>Phiếu nhập hiện ở đây sau khi bạn tải tài liệu lên.</p></EmptyState>}
        {jobs.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {jobs.map((job) => (
              <li key={job.id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0 break-all font-medium text-slate-900">{job.sourceFileName}</span>
                  <span className={`shrink-0 text-xs font-medium ${jobTone[job.status] ?? 'text-slate-600'}`}>{importJobLabels[job.status]}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {formatDate(job.createdAt)} · {job.totalDrafts} câu nháp
                </p>
                {job.errorMessage && <p className="mt-1 text-xs text-rose-800">{job.errorMessage}</p>}
                {job.totalDrafts > 0 && (
                  <Link to={job.id} className={`mt-2 inline-flex min-h-11 items-center rounded font-medium text-indigo-700 hover:text-indigo-900 ${focusRing}`}>
                    Xem bản nháp
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
