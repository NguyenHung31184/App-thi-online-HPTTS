import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listExamWindows, deleteExamWindow } from '../../services/examWindowService';
import { listExams } from '../../services/examService';
import { listClasses } from '../../services/ttdtDataService';
import type { ExamWindow } from '../../types';
import ConfirmationModal from '../../components/ConfirmationModal';
import EmptyState from '../../components/EmptyState';

type WindowStatus = 'active' | 'upcoming' | 'ended';

function getWindowStatus(startAt: number, endAt: number): WindowStatus {
  const now = Date.now();
  if (now < startAt) return 'upcoming';
  if (now > endAt) return 'ended';
  return 'active';
}

function classGroupStatus(windows: ExamWindow[]): WindowStatus {
  const statuses = windows.map((w) => getWindowStatus(w.start_at, w.end_at));
  if (statuses.includes('active')) return 'active';
  if (statuses.includes('upcoming')) return 'upcoming';
  return 'ended';
}

function StatusBadge({ startAt, endAt }: { startAt: number; endAt: number }) {
  const status = getWindowStatus(startAt, endAt);
  const config = {
    active: { label: 'Đang diễn ra', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    upcoming: { label: 'Sắp tới', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
    ended: { label: 'Đã kết thúc', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  }[status];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${config.cls}`}>
      {status === 'active' && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}

function ClassGroupBadge({ status }: { status: WindowStatus }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
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

const STATUS_ORDER: Record<WindowStatus, number> = { active: 0, upcoming: 1, ended: 2 };

export default function AdminWindowsPage() {
  const [windows, setWindows] = useState<ExamWindow[]>([]);
  const [exams, setExams] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [winList, examList, classList] = await Promise.all([
        listExamWindows(),
        listExams(),
        listClasses(),
      ]);
      setWindows(winList);
      setExams(Object.fromEntries(examList.map((e) => [e.id, e.title])));
      setClasses(Object.fromEntries(classList.map((c) => [c.id, c.name])));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải danh sách kỳ thi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const doDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      setDeleting(true);
      await deleteExamWindow(confirmDeleteId);
      setWindows((prev) => prev.filter((w) => w.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa.');
    } finally {
      setDeleting(false);
    }
  };

  // Nhóm kỳ thi theo lớp, sắp xếp nhóm: đang thi → sắp thi → đã kết thúc
  const groups = useMemo(() => {
    const map = new Map<string, ExamWindow[]>();
    for (const w of windows) {
      const key = w.class_id ?? '__unknown__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(w);
    }
    // Trong mỗi nhóm: sắp xếp active → upcoming → ended, cùng status thì mới nhất lên đầu
    for (const [, list] of map) {
      list.sort((a, b) => {
        const sa = STATUS_ORDER[getWindowStatus(a.start_at, a.end_at)];
        const sb = STATUS_ORDER[getWindowStatus(b.start_at, b.end_at)];
        if (sa !== sb) return sa - sb;
        return b.start_at - a.start_at;
      });
    }
    // Sắp xếp nhóm: đang thi → sắp thi → đã kết thúc, cùng status thì theo tên lớp
    return [...map.entries()].sort(([aId, aList], [bId, bList]) => {
      const sa = STATUS_ORDER[classGroupStatus(aList)];
      const sb = STATUS_ORDER[classGroupStatus(bList)];
      if (sa !== sb) return sa - sb;
      const nameA = classes[aId] ?? '';
      const nameB = classes[bId] ?? '';
      return nameA.localeCompare(nameB, 'vi');
    });
  }, [windows, classes]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Kỳ thi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Các kỳ thi được nhóm theo lớp học.
          </p>
        </div>
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
          const className = classes[classId] ?? (classId === '__unknown__' ? 'Chưa rõ lớp' : classId);
          const groupStatus = classGroupStatus(list);
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
                  <div key={w.id} className="rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                    {/* Card header strip */}
                    <div className="h-12 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500 relative overflow-hidden flex items-start justify-end p-2">
                      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#ffffff_0,_transparent_55%)]" />
                      <div className="relative z-10">
                        <StatusBadge startAt={w.start_at} endAt={w.end_at} />
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 px-3 pt-2.5 pb-2">
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
    </div>
  );
}
