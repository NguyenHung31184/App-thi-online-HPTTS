import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LOCK_FAILURES, minutesLeft, sortFailures, type AccessFailure } from '../domain/access-locks';
import { useAccessFailures, useUnlockAccess } from '../queries/use-access-locks';

const studentLabel = (row: AccessFailure) => [row.studentName, row.studentCode].filter(Boolean).join(' · ') || 'Học viên';

/**
 * Học viên đang nhập sai mã truy cập ở kỳ thi đang mở. Người bị khóa chưa có lượt làm bài nên không hiện ở bảng giám
 * sát bên dưới; khối này cho giám thị thấy họ và mở khóa ngay. Không có ai nhập sai thì không hiện gì.
 */
export function AccessLockAlert() {
  const failures = useAccessFailures();
  const unlock = useUnlockAccess();
  const rows = sortFailures(failures.data ?? [], Date.now());

  if (failures.error) {
    return (
      <p className="mb-3 text-sm text-red-700" role="alert">
        Không tải được danh sách học viên nhập sai mã: {failures.error.message}.
      </p>
    );
  }
  if (rows.length === 0) return null;

  const onUnlock = (row: AccessFailure) => {
    unlock.mutate({ windowId: row.windowId, userId: row.userId }, {
      onSuccess: (done) => done
        ? toast.success(`Đã mở khóa cho ${studentLabel(row)}. Nhắc học viên nhập đúng mã của kỳ thi này.`)
        : toast.info('Học viên này không còn bị khóa.'),
      onError: (error) => toast.error(`Không mở khóa được: ${error.message}`),
    });
  };

  return (
    <section aria-label="Học viên nhập sai mã truy cập" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" />
        {rows.length} học viên đang nhập sai mã truy cập
      </p>
      <p className="mt-1 text-sm text-amber-900">
        Sai {ACCESS_LOCK_FAILURES} lần thì bị khóa 10 phút. Đọc lại mã của đúng kỳ thi (không phải mã thi thử) rồi mở khóa nếu cần.
      </p>
      <ul className="mt-2 divide-y divide-amber-200">
        {rows.map((row) => {
          const minutes = minutesLeft(row.lockedUntil, Date.now());
          const busy = unlock.isPending && unlock.variables?.userId === row.userId && unlock.variables?.windowId === row.windowId;
          return (
            <li key={`${row.windowId}:${row.userId}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-slate-900">{studentLabel(row)}</p>
                <p className="text-slate-700">
                  {[row.className, row.examTitle].filter(Boolean).join(' · ')}. Sai {row.failureCount} lần
                  {minutes > 0 ? <strong className="text-red-700">, đang bị khóa, còn {minutes} phút</strong> : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUnlock(row)}
                disabled={busy}
                className="min-h-11 rounded-lg border border-amber-400 bg-white px-3 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand-700"
              >
                {busy ? 'Đang mở khóa…' : minutes > 0 ? 'Mở khóa' : 'Xóa số lần sai'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
