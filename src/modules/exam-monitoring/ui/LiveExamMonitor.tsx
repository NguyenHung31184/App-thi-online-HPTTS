import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Ban, CheckCircle2, PenLine, WifiOff, type LucideIcon } from 'lucide-react';
import { useLiveExamMonitor } from '../queries/use-live-monitor';
import {
  formatDuration,
  formatSecondsAgo,
  initials,
  LIVE_STATUS_LABELS,
  LIVE_STATUS_ORDER,
  scoreOutOf10,
  tabCounter,
  VIOLATION_LABELS,
  type LiveClassGroup,
  type LiveStatus,
  type LiveStudent,
} from '../domain/live-status';

// Operator, 2026-09-28: 6 cards per class tab (two rows of three); the rest behind "Xem cả lớp".
const VISIBLE_PER_CLASS = 6;

const STATUS_STYLE: Record<LiveStatus, { icon: LucideIcon; text: string; border: string }> = {
  disconnected: { icon: WifiOff, text: 'text-red-700', border: 'border-red-300' },
  violation: { icon: AlertTriangle, text: 'text-amber-700', border: 'border-amber-300' },
  working: { icon: PenLine, text: 'text-green-700', border: 'border-slate-200' },
  disqualified: { icon: Ban, text: 'text-red-700', border: 'border-red-300' },
  submitted: { icon: CheckCircle2, text: 'text-slate-500', border: 'border-slate-200' },
};

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CardRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{children}</dd>
    </div>
  );
}

/** `now` is the time of the last refresh; running durations are for display only, status comes from the server clock. */
function StudentCard({ student, now }: { student: LiveStudent; now: number }) {
  const style = STATUS_STYLE[student.liveStatus];
  const Icon = style.icon;
  const finished = student.liveStatus === 'submitted' || student.liveStatus === 'disqualified';
  const score = scoreOutOf10(student.score);
  const endedAt = student.completedAt ?? now;

  return (
    <article className={`rounded-xl border bg-white ${style.border}`}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <div
          className="w-11 h-11 rounded-full bg-slate-100 text-slate-700 font-semibold flex items-center justify-center flex-shrink-0"
          aria-hidden="true"
        >
          {initials(student.studentName)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate" title={student.studentName ?? undefined}>
            {student.studentName ?? 'Chưa rõ tên'}
          </p>
          <p className={`inline-flex items-center gap-1 text-xs font-medium ${style.text}`}>
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {LIVE_STATUS_LABELS[student.liveStatus]}
          </p>
          <p className="text-sm text-slate-600">
            {finished && score != null ? (
              <>
                Điểm: <strong className="text-slate-900">{score}</strong>
              </>
            ) : (
              <>
                Đã trả lời <strong className="text-slate-900">{student.answered}/{student.totalQuestions || '—'}</strong> câu
              </>
            )}{' '}
            (Lần thi: {student.attemptNumber})
          </p>
        </div>
      </div>
      <dl className="border-t border-slate-100 px-4 py-2 text-sm">
        <CardRow label="Thời gian làm bài">{formatDuration(endedAt - student.startedAt)}</CardRow>
        <CardRow label="Thời gian nộp bài">{student.completedAt ? formatDateTime(student.completedAt) : '—'}</CardRow>
        <CardRow label="Vi phạm">
          {student.violations > 0 ? (
            <span className="text-amber-800">
              {student.violations}
              {student.lastViolation && ` · ${VIOLATION_LABELS[student.lastViolation] ?? student.lastViolation}`}
            </span>
          ) : (
            <span className="text-slate-400">0</span>
          )}
        </CardRow>
        {finished ? (
          <CardRow label="Bài làm">
            <Link to={`/admin/attempts/${student.attemptId}/result`} className="text-brand-600 hover:text-brand-700">
              Xem bài
            </Link>
          </CardRow>
        ) : (
          <CardRow label="Tín hiệu cuối">
            <span className={student.liveStatus === 'disconnected' ? 'text-red-700' : undefined}>
              {formatSecondsAgo(student.secondsSinceSeen)}
            </span>
          </CardRow>
        )}
      </dl>
    </article>
  );
}

function ClassPanel({ group, now }: { group: LiveClassGroup; now: number }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? group.students : group.students.slice(0, VISIBLE_PER_CLASS);
  const hidden = group.students.length - visible.length;

  return (
    <div>
      <div className="mb-3 text-xs">
        <p className="text-slate-600">
          {group.isTrial && (
            <span className="mr-2 px-2 py-0.5 rounded-full font-semibold border bg-slate-100 text-slate-700 border-slate-200">
              Thử
            </span>
          )}
          {group.examTitles.join(', ')} · kết thúc {formatClock(group.endsAt)}
        </p>
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((student) => (
          <StudentCard key={student.attemptId} student={student} now={now} />
        ))}
      </div>
      {group.students.length > VISIBLE_PER_CLASS && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-2 min-h-11 px-2 text-sm font-medium text-brand-600 hover:text-brand-700 rounded-lg focus-visible:outline-2 focus-visible:outline-brand-700"
        >
          {expanded ? 'Thu gọn' : `Xem cả lớp (thêm ${hidden} học viên)`}
        </button>
      )}
    </div>
  );
}

/** Live view of every window open now (or closed under 30 minutes ago): one tab per class, one card per student. */
export default function LiveExamMonitor() {
  const { data: groups, isPending, error, dataUpdatedAt, refetch, isFetching } = useLiveExamMonitor();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = groups?.find((group) => group.classId === selectedId) ?? groups?.[0];

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!groups || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + groups.length) % groups.length;
    setSelectedId(groups[next].classId);
    document.getElementById(`live-tab-${groups[next].classId}`)?.focus();
  };

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
      {groups && selected && (
        <>
          <div role="tablist" aria-label="Lớp đang thi" className="flex gap-1 overflow-x-auto border-b border-slate-200 mb-4">
            {groups.map((group, index) => {
              const isSelected = group.classId === selected.classId;
              const attention = group.counts.disconnected + group.counts.violation;
              return (
                <button
                  key={group.classId}
                  id={`live-tab-${group.classId}`}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls="live-tab-panel"
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setSelectedId(group.classId)}
                  onKeyDown={(event) => onTabKey(event, index)}
                  className={`min-h-11 px-4 -mb-px border-b-2 whitespace-nowrap text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand-700 ${
                    isSelected ? 'border-brand-700 text-brand-700 font-semibold' : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {group.className} ({tabCounter(group)})
                  {attention > 0 && <span className="ml-1.5 text-amber-700 font-semibold">· {attention} cần chú ý</span>}
                </button>
              );
            })}
          </div>
          <div id="live-tab-panel" role="tabpanel" aria-labelledby={`live-tab-${selected.classId}`}>
            <ClassPanel key={selected.classId} group={selected} now={dataUpdatedAt} />
          </div>
        </>
      )}
    </div>
  );
}
