import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ConfirmationModal from '../../../shared/ui/ConfirmationModal';
import EmptyState from '../../../shared/ui/EmptyState';
import { classGroupStatus, groupWindowsByClass, windowStatus, UNKNOWN_CLASS, type WindowStatus } from '../domain/window-status';
import { useDeleteAllTrialAttempts, useDeleteExamWindow, useExams, useExamWindows, useTtdtClasses } from '../queries/use-exam-management';

function StatusBadge({ startAt, endAt, now }: { startAt: number; endAt: number; now: number }) {
  const status = windowStatus(startAt, endAt, now);
  const config = {
    active: { label: 'Đang diễn ra', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    upcoming: { label: 'Sắp tới', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    ended: { label: 'Đã kết thúc', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  }[status];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${config.cls}`}>
      {status === 'active' && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
      )}
      {config.label}
    </span>
  );
}

function ClassGroupBadge({ status }: { status: WindowStatus }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      Đang thi
    </span>
  );
  if (status === 'upcoming') return (
    <span className="inline-flex items-center text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 rounded-full px-2 py-0.5">
      Sắp thi
    </span>
  );
  return (
    <span className="inline-flex items-center text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
      Đã kết thúc
    </span>
  );
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function WindowsPage() {
  const windowsQuery = useExamWindows();
  const examsQuery = useExams();
  const classesQuery = useTtdtClasses();
  const removeWindow = useDeleteExamWindow();
  const removeTrialAttempts = useDeleteAllTrialAttempts();
  // Window status is read against the time the page opened, as the list is not refreshed every minute.
  const [now] = useState(() => Date.now());
  const windows = useMemo(() => windowsQuery.data ?? [], [windowsQuery.data]);
  const exams = useMemo(() => Object.fromEntries((examsQuery.data ?? []).map((e) => [e.id, e.title])), [examsQuery.data]);
  const classes = useMemo(() => Object.fromEntries((classesQuery.data ?? []).map((c) => [c.id, c.name])), [classesQuery.data]);
  const loading = windowsQuery.isPending || examsQuery.isPending || classesQuery.isPending;
  const [actionError, setActionError] = useState('');
  const loadFailure = windowsQuery.error ?? examsQuery.error;
  const error = actionError || (loadFailure ? (loadFailure instanceof Error ? loadFailure.message : 'Lỗi tải danh sách kỳ thi.') : '');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const deleting = removeWindow.isPending;
  const [confirmDeleteTrialReports, setConfirmDeleteTrialReports] = useState(false);
  const deletingTrialReports = removeTrialAttempts.isPending;
  const [trialDeleteResult, setTrialDeleteResult] = useState<string | null>(null);

  const doDeleteTrialReports = async () => {
    try {
      const count = await removeTrialAttempts.mutateAsync();
      setTrialDeleteResult(`Đã xóa ${count} báo cáo thi thử.`);
      setConfirmDeleteTrialReports(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Lỗi xóa báo cáo thi thử.');
    }
  };

  const doDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await removeWindow.mutateAsync(confirmDeleteId);
      setConfirmDeleteId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Lỗi xóa.');
    }
  };

  // Grouped by class: running classes first, then upcoming, then ended.
  const groups = useMemo(() => groupWindowsByClass(windows, classes, now), [windows, classes, now]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Kỳ thi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Các kỳ thi được nhóm theo lớp học.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setTrialDeleteResult(null); setConfirmDeleteTrialReports(true); }}
            className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium"
            title="Xóa toàn bộ kết quả thi thử để giải phóng dung lượng DB"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Xóa báo cáo thi thử
          </button>
          <Link
            to="/admin/windows/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Thêm kỳ thi
          </Link>
        </div>
      </div>

      {loading && <p className="text-slate-500 text-sm">Đang tải...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!loading && !error && windows.length === 0 && (
        <EmptyState
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          title="Chưa có kỳ thi nào"
          description="Tạo kỳ thi để học viên có thể vào thi bằng mã truy cập."
          action={
            <Link to="/admin/windows/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
              Tạo kỳ thi đầu tiên
            </Link>
          }
        />
      )}

      <div className="space-y-8">
        {groups.map(([classId, list]) => {
          const className = classes[classId] ?? (classId === UNKNOWN_CLASS ? 'Chưa rõ lớp' : classId);
          const groupStatus = classGroupStatus(list, now);
          return (
            <div key={classId}>
              {/* Class section header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h2 className="text-sm font-semibold text-slate-700 truncate">{className}</h2>
                </div>
                <ClassGroupBadge status={groupStatus} />
                <span className="text-xs text-slate-400">{list.length} bài thi</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              {/* Cards in a responsive grid */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map((w) => (
                  <div key={w.id} className="rounded-xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="flex-1 px-3 pt-2.5 pb-2">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        {w.is_trial && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-slate-100 text-slate-700 border-slate-200">
                            Thử
                          </span>
                        )}
                        <StatusBadge startAt={w.start_at} endAt={w.end_at} now={now} />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
                        {exams[w.exam_id] ?? 'Kỳ thi'}
                      </h3>
                      <div className="mt-2 space-y-1 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{formatTime(w.start_at)} – {formatTime(w.end_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                          Mã: <strong className="text-slate-700 font-mono">{w.access_code}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Footer actions */}
                    <div className="px-3 pb-2.5 flex items-center justify-end gap-1 border-t border-slate-100 pt-2">
                      <Link
                        to={`/admin/windows/${w.id}`}
                        title="Sửa kỳ thi"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(w.id)}
                        title="Xóa kỳ thi"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmationModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={doDelete}
        title="Xóa kỳ thi"
        isLoading={deleting}
        confirmText="Xóa"
      >
        Xóa kỳ thi này? Thí sinh sẽ không thể vào thi bằng mã này.
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={confirmDeleteTrialReports}
        onClose={() => setConfirmDeleteTrialReports(false)}
        onConfirm={doDeleteTrialReports}
        title="Xóa báo cáo thi thử"
        isLoading={deletingTrialReports}
        confirmText="Xóa tất cả"
      >
        <p>Xóa toàn bộ kết quả thi (attempts) của <strong>tất cả kỳ thi thử</strong>?</p>
        <p className="mt-2 text-slate-500 text-sm">Các cửa sổ thi thử vẫn được giữ lại. Chỉ xóa dữ liệu kết quả/báo cáo để giải phóng dung lượng DB. Không thể hoàn tác.</p>
      </ConfirmationModal>

      {trialDeleteResult && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm flex items-center gap-2 z-50">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {trialDeleteResult}
          <button type="button" onClick={() => setTrialDeleteResult(null)} className="ml-2 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
    </div>
  );
}
