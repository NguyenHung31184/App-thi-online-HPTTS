import { useState } from 'react';
import { fromDatetimeLocal } from '../../../../shared/lib/datetime-local';
import ConfirmationModal from '../../../../shared/ui/ConfirmationModal';
import {
  ASSIGNMENT_STATE_LABELS, assignmentState, authoringErrorMessage, type LessonRow, type LessonVersion,
} from '../../domain/lesson-authoring';
import { useLessonAssignments, useSubmitAssignment, useWithdrawAssignment } from '../../queries/use-lesson-authoring';

const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const dateTime = (value: string | null) => (value ? new Date(value).toLocaleString('vi-VN') : null);

/** Assigns the newest published version to a class, and lists the classes that have the lesson. */
export function AssignmentPanel({ lesson, versions }: { lesson: LessonRow; versions: LessonVersion[] }) {
  const latest = versions[0] ?? null;
  const [classId, setClassId] = useState('');
  const [orderIndex, setOrderIndex] = useState('0');
  const [opensAt, setOpensAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [required, setRequired] = useState(true);
  const [enforceSequence, setEnforceSequence] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [withdrawId, setWithdrawId] = useState<string | null>(null);

  const assignments = useLessonAssignments(lesson, versions);
  const submit = useSubmitAssignment();
  const withdraw = useWithdrawAssignment();
  const classes = assignments.data?.classes ?? [];
  const entries = assignments.data?.entries ?? [];
  const existing = entries.find((entry) => entry.assignment.class_id === classId) ?? null;
  const withdrawing = entries.find((entry) => entry.assignment.id === withdrawId) ?? null;
  const now = Date.now();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      await submit.mutateAsync({
        classId,
        versionId: latest?.id ?? '',
        orderIndex,
        required,
        enforceSequence,
        opensAt: opensAt ? fromDatetimeLocal(opensAt) : null,
        dueAt: dueAt ? fromDatetimeLocal(dueAt) : null,
      });
      const className = classes.find((item) => item.id === classId)?.name ?? 'lớp';
      setNotice(`Đã giao phiên bản ${latest?.version} cho ${className}.`);
      setClassId('');
    } catch (reason) {
      setError(authoringErrorMessage(reason));
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawId) return;
    setError('');
    setNotice('');
    try {
      await withdraw.mutateAsync(withdrawId);
      setNotice('Đã rút bài khỏi lớp. Tiến độ đã học vẫn được giữ.');
    } catch (reason) {
      setError(authoringErrorMessage(reason));
    } finally {
      setWithdrawId(null);
    }
  };

  return (
    <section aria-labelledby="assign-title" className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 id="assign-title" className="text-base font-semibold text-slate-900">Giao cho lớp</h2>
      <p className="mt-1 text-sm text-slate-600">
        Chỉ giao được cho lớp thuộc khóa có mô-đun này. Học viên của lớp thấy bài trong mục "Học trực tuyến" khi tới ngày mở.
      </p>

      {assignments.isError && (
        <p role="alert" className="mt-3 text-sm text-red-700">Không tải được danh sách giao bài: {authoringErrorMessage(assignments.error)}</p>
      )}

      {!latest ? (
        <p className="mt-3 text-sm text-amber-800">Xuất bản bài học trước, rồi mới giao được cho lớp.</p>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Giao phiên bản {latest.version}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="assign-class" className="mb-1 block text-sm font-medium text-slate-700">Lớp *</label>
              <select id="assign-class" value={classId} onChange={(event) => setClassId(event.target.value)} className={field}>
                <option value="">— Chọn lớp —</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>{item.code ? `${item.code} · ` : ''}{item.name}</option>
                ))}
              </select>
              {assignments.isSuccess && classes.length === 0 && (
                <p className="mt-1 text-xs text-amber-800">Chưa có lớp nào thuộc khóa dạy mô-đun này.</p>
              )}
              {existing && (
                <p className="mt-1 text-xs text-amber-800">
                  Lớp này đang học phiên bản {existing.version ?? '?'}. Giao lại sẽ thay bằng phiên bản {latest.version}; học viên học lại từ đầu trên phiên bản mới, tiến độ cũ vẫn lưu.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="assign-opens" className="mb-1 block text-sm font-medium text-slate-700">Ngày mở</label>
              <input id="assign-opens" type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} className={field} />
              <p className="mt-1 text-xs text-slate-600">Để trống: mở ngay.</p>
            </div>
            <div>
              <label htmlFor="assign-due" className="mb-1 block text-sm font-medium text-slate-700">Hạn học</label>
              <input id="assign-due" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className={field} />
              <p className="mt-1 text-xs text-slate-600">Để trống: không có hạn. Quá hạn, học viên không mở được bài.</p>
            </div>
            <div>
              <label htmlFor="assign-order" className="mb-1 block text-sm font-medium text-slate-700">Thứ tự trong lớp</label>
              <input
                id="assign-order"
                inputMode="numeric"
                value={orderIndex}
                onChange={(event) => setOrderIndex(event.target.value.replace(/[^\d]/g, ''))}
                className={field}
              />
              <p className="mt-1 text-xs text-slate-600">Số nhỏ học trước.</p>
            </div>
            <div className="space-y-2 pt-1 text-sm text-slate-800">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>Bài bắt buộc</span>
              </label>
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={enforceSequence} onChange={(event) => setEnforceSequence(event.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>Phải học xong các bài bắt buộc xếp trước thì mới mở bài này</span>
              </label>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={submit.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submit.isPending ? 'Đang giao...' : existing ? 'Giao lại cho lớp' : 'Giao cho lớp'}
          </button>
        </form>
      )}
      {!latest && error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-green-800">{notice}</p>}

      <h3 className="mt-5 text-sm font-semibold text-slate-800">Lớp đang được giao ({entries.length})</h3>
      {assignments.isPending && <p role="status" className="mt-2 text-sm text-slate-500">Đang tải...</p>}
      {assignments.isSuccess && entries.length === 0 && <p className="mt-2 text-sm text-slate-600">Chưa giao bài này cho lớp nào.</p>}
      <ul className="mt-2 space-y-2">
        {entries.map((entry) => {
          const state = assignmentState(entry.assignment, now);
          return (
            <li key={entry.assignment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{entry.classItem?.name ?? entry.assignment.class_id}</p>
                <p className="text-xs text-slate-600">
                  Phiên bản {entry.version ?? '?'}
                  {latest && entry.version !== null && entry.version < latest.version && ' (đã có bản mới hơn)'}
                  {' · '}{ASSIGNMENT_STATE_LABELS[state]}
                  {dateTime(entry.assignment.opens_at) && ` · Mở ${dateTime(entry.assignment.opens_at)}`}
                  {dateTime(entry.assignment.due_at) && ` · Hạn ${dateTime(entry.assignment.due_at)}`}
                  {' · '}{entry.assignment.required ? 'Bắt buộc' : 'Không bắt buộc'}
                </p>
                <p className="text-xs text-slate-600">
                  Học xong: {entry.completed}/{entry.classSize} học viên · Đã bắt đầu: {entry.started}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWithdrawId(entry.assignment.id)}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Rút bài
              </button>
            </li>
          );
        })}
      </ul>

      <ConfirmationModal
        isOpen={withdrawing !== null}
        onClose={() => setWithdrawId(null)}
        onConfirm={() => { void handleWithdraw(); }}
        title="Rút bài khỏi lớp?"
        confirmText="Rút bài"
        isLoading={withdraw.isPending}
      >
        Học viên lớp {withdrawing?.classItem?.name ?? ''} sẽ không còn thấy bài này. Tiến độ đã học vẫn được giữ trong hệ thống.
      </ConfirmationModal>
    </section>
  );
}
