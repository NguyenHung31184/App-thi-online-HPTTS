import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Ban, CheckCircle2, PenLine, WifiOff, type LucideIcon } from 'lucide-react';
import { useLiveExamMonitor } from '../queries/use-live-monitor';
import {
  formatSecondsAgo,
  LIVE_STATUS_LABELS,
  LIVE_STATUS_ORDER,
  VIOLATION_LABELS,
  type LiveClassGroup,
  type LiveStatus,
  type LiveStudent,
} from '../domain/live-status';

// Operator, 2026-09-28: 5–10 students per class; the rest behind "Xem cả lớp".
const VISIBLE_PER_CLASS = 8;

const STATUS_STYLE: Record<LiveStatus, { icon: LucideIcon; text: string }> = {
  disconnected: { icon: WifiOff, text: 'text-red-700' },
  violation: { icon: AlertTriangle, text: 'text-amber-700' },
  working: { icon: PenLine, text: 'text-green-700' },
  disqualified: { icon: Ban, text: 'text-red-700' },
  submitted: { icon: CheckCircle2, text: 'text-slate-500' },
};

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function StatusCell({ status }: { status: LiveStatus }) {
  const { icon: Icon, text } = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${text}`}>
      <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      {LIVE_STATUS_LABELS[status]}
    </span>
  );
}

function StudentRow({ student }: { student: LiveStudent }) {
  const inProgress = student.liveStatus === 'disconnected' || student.liveStatus === 'violation' || student.liveStatus === 'working';
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1.5 pr-3">
        <p className="font-medium text-slate-900 truncate max-w-[14rem]" title={student.studentName ?? undefined}>
          {student.studentName ?? 'Chưa rõ tên'}
        </p>
        <p className="text-xs text-slate-500">{student.studentCode ?? '—'}</p>
      </td>
      <td className="py-1.5 pr-3 whitespace-nowrap">
        <StatusCell status={student.liveStatus} />
      </td>
      <td className="py-1.5 pr-3 whitespace-nowrap text-slate-700">
        {student.answered}/{student.totalQuestions || '—'} câu
      </td>
      <td className="py-1.5 pr-3 text-slate-700">
        {student.violations > 0 ? (
          <span>
            <strong className="text-amber-800">{student.violations}</strong>
            {student.lastViolation && (
              <span className="text-slate-500">
                {' '}· {VIOLATION_LABELS[student.lastViolation] ?? student.lastViolation}
                {student.secondsSinceViolation != null && `, ${formatSecondsAgo(student.secondsSinceViolation)}`}
              </span>
            )}
          </span>
        ) : (
          <span className="text-slate-400">0</span>
        )}
      </td>
      <td className="py-1.5 whitespace-nowrap text-slate-500">
        {inProgress ? (
          formatSecondsAgo(student.secondsSinceSeen)
        ) : (
          <Link to={`/admin/attempts/${student.attemptId}/result`} className="text-brand-600 hover:text-brand-700 font-medium">
            Xem bài
          </Link>
        )}
      </td>
    </tr>
  );
}

function ClassBlock({ group }: { group: LiveClassGroup }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? group.students : group.students.slice(0, VISIBLE_PER_CLASS);
  const hidden = group.students.length - visible.length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white" aria-label={group.className}>
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold text-brand-700">{group.className}</h4>
          {group.isTrial && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-slate-100 text-slate-700 border-slate-200">
              Thử
            </span>
          )}
          <span className="text-xs text-slate-500">
            {group.examTitles.join(', ')} · kết thúc {formatClock(group.endsAt)}
          </span>
        </div>
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {LIVE_STATUS_ORDER.filter((status) => group.counts[status] > 0).map((status) => (
            <span key={status} className={STATUS_STYLE[status].text}>
              {LIVE_STATUS_LABELS[status]}: <strong>{group.counts[status]}</strong>
            </span>
          ))}
          <span className="text-slate-500">
            Chưa vào thi: <strong>{group.notStarted}</strong>
          </span>
        </p>
      </div>
      <div className="overflow-x-auto px-4 pb-2">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Học viên</th>
              <th className="py-2 pr-3 font-medium">Trạng thái</th>
              <th className="py-2 pr-3 font-medium">Đã trả lời</th>
              <th className="py-2 pr-3 font-medium">Vi phạm</th>
              <th className="py-2 font-medium">Tín hiệu cuối</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((student) => (
              <StudentRow key={student.attemptId} student={student} />
            ))}
          </tbody>
        </table>
        {group.students.length > VISIBLE_PER_CLASS && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mt-1 mb-1 min-h-11 px-2 text-sm font-medium text-brand-600 hover:text-brand-700 rounded-lg focus-visible:outline-2 focus-visible:outline-brand-700"
          >
            {expanded ? 'Thu gọn' : `Xem cả lớp (thêm ${hidden} học viên)`}
          </button>
        )}
      </div>
    </section>
  );
}

/** Live view of every window open now (or closed under 30 minutes ago), one block per class. */
export default function LiveExamMonitor() {
  const { data: groups, isPending, error, dataUpdatedAt, refetch, isFetching } = useLiveExamMonitor();

  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm mb-6">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Giám sát thi trực tuyến</p>
          <p className="text-xs text-slate-500">
            Tự làm mới mỗi 15 giây
            {dataUpdatedAt > 0 && ` · cập nhật lúc ${new Date(dataUpdatedAt).toLocaleTimeString('vi-VN')}`}. Mất kết nối =
            quá 60 giây không nhận tín hiệu từ máy học viên.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="min-h-11 px-3 text-sm font-medium text-brand-600 hover:bg-brand-50 rounded-lg disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand-700"
        >
          {isFetching ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>

      {isPending && <p className="text-sm text-slate-500">Đang tải danh sách học viên đang thi…</p>}
      {error && (
        <p className="text-sm text-red-700" role="alert">
          Không tải được bảng giám sát: {error.message}. Bấm “Làm mới” để thử lại.
        </p>
      )}
      {groups && groups.length === 0 && (
        <p className="text-sm text-slate-500">
          Không có kỳ thi nào đang mở. Học viên sẽ hiện ở đây ngay khi vào thi một kỳ thi trong mục{' '}
          <Link to="/admin/windows" className="text-brand-600 hover:text-brand-700 font-medium">
            Kỳ thi
          </Link>
          .
        </p>
      )}
      {groups && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((group) => (
            <ClassBlock key={group.classId} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}
