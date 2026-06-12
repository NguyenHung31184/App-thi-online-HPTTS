import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getMyModulesWithLessons,
  getModulesWithLessonsByClassIds,
  getBlocksMeta,
  getMyProgress,
  type ModuleWithLessons,
} from '../services/elearningStudyService';
import { listClasses } from '../services/ttdtDataService';
import type { ClassItem, ElearningLessonBlock, ElearningProgress } from '../types';

/**
 * Trang Học trực tuyến — danh sách bài học theo mô-đun của lớp học viên.
 * Học tuần tự: bài sau chỉ mở khi bài trước hoàn thành (mọi khối completed).
 *
 * Admin/Giáo viên: chế độ XEM TRƯỚC — chọn lớp bất kỳ, mọi bài mở khóa,
 * không ghi tiến độ (LessonPlayerPage cũng tự nhận biết theo role).
 */
export default function StudentLearnPage() {
  const { user, studentSession } = useAuth();
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [blocksMeta, setBlocksMeta] = useState<Pick<ElearningLessonBlock, 'id' | 'lesson_id'>[]>([]);
  const [progress, setProgress] = useState<ElearningProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Chế độ xem trước cho staff
  const isStaffPreview = user?.role === 'admin' || user?.role === 'teacher';
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [previewClassId, setPreviewClassId] = useState('');

  const studentId = user?.student_id ?? studentSession?.student_id ?? null;

  // Staff: tải danh sách lớp cho dropdown xem trước
  useEffect(() => {
    if (!isStaffPreview) return;
    listClasses()
      .then(setClasses)
      .catch(() => setError('Không tải được danh sách lớp.'));
  }, [isStaffPreview]);

  useEffect(() => {
    let cancelled = false;

    // Staff chưa chọn lớp / học viên chưa xác định danh tính → không tải gì
    if (isStaffPreview ? !previewClassId : !studentId) {
      setModules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const mods = isStaffPreview
          ? await getModulesWithLessonsByClassIds([previewClassId])
          : await getMyModulesWithLessons(studentId!);
        if (cancelled) return;
        setModules(mods);
        const lessonIds = mods.flatMap((m) => m.lessons.map((l) => l.id));
        const [meta, prog] = await Promise.all([
          getBlocksMeta(lessonIds),
          isStaffPreview ? Promise.resolve([]) : getMyProgress(lessonIds),
        ]);
        if (cancelled) return;
        setBlocksMeta(meta);
        setProgress(prog);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi tải bài học.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, isStaffPreview, previewClassId]);

  /** lesson_id → { tổng khối, khối đã xong } */
  const lessonStats = useMemo(() => {
    const total: Record<string, number> = {};
    blocksMeta.forEach((b) => {
      total[b.lesson_id] = (total[b.lesson_id] ?? 0) + 1;
    });
    const doneBlocks = new Set(progress.filter((p) => p.status === 'completed').map((p) => p.block_id));
    const done: Record<string, number> = {};
    blocksMeta.forEach((b) => {
      if (doneBlocks.has(b.id)) done[b.lesson_id] = (done[b.lesson_id] ?? 0) + 1;
    });
    return { total, done };
  }, [blocksMeta, progress]);

  const isLessonDone = (lessonId: string) => {
    const t = lessonStats.total[lessonId] ?? 0;
    return t > 0 && (lessonStats.done[lessonId] ?? 0) >= t;
  };

  if (!isStaffPreview && !studentId) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-slate-600 mb-2">Cần xác định bạn là học viên nào trước khi vào học.</p>
        <p className="text-sm text-slate-500">
          Đăng nhập tài khoản thi (đã liên kết hồ sơ) hoặc xác thực CCCD ở menu STUDENT.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-1">Học trực tuyến</h2>

      {isStaffPreview ? (
        <>
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-amber-800 mb-2">
              👁 Chế độ xem trước ({user?.role === 'admin' ? 'Admin' : 'Giáo viên'}) — tiến độ KHÔNG được ghi, mọi bài đều mở khóa
            </p>
            <select
              value={previewClassId}
              onChange={(e) => setPreviewClassId(e.target.value)}
              title="Chọn lớp để xem bài học hiển thị với học viên lớp đó"
              className="w-full sm:w-80 border border-amber-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <option value="">— Chọn lớp để xem bài học —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.code ? ` (${c.code})` : ''}
                </option>
              ))}
            </select>
          </div>
          {!previewClassId && !loading && (
            <p className="text-sm text-slate-500">Chọn một lớp ở trên để xem bài học của lớp đó.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-600 mb-5">
          Bài giảng theo mô-đun của lớp bạn đang học. Hoàn thành bài trước để mở bài tiếp theo.
        </p>
      )}

      {loading && <p className="text-slate-500">Đang tải bài học...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && modules.length === 0 && (isStaffPreview ? !!previewClassId : true) && (
        <p className="text-slate-500">
          {isStaffPreview
            ? 'Lớp này chưa có bài học e-learning nào được xuất bản (kiểm tra khóa học của lớp có mô-đun chứa bài đã Xuất bản chưa).'
            : 'Chưa có bài học nào cho lớp của bạn. Nội dung sẽ xuất hiện khi trung tâm xuất bản bài giảng.'}
        </p>
      )}

      <div className="space-y-6">
        {modules.map((mod) => (
          <section key={mod.module_id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 mb-3">
              {mod.module_name}
              {mod.module_code && <span className="ml-2 text-xs font-normal text-slate-400">{mod.module_code}</span>}
            </h3>
            <ol className="space-y-2">
              {mod.lessons.map((lesson, idx) => {
                const totalBlocks = lessonStats.total[lesson.id] ?? 0;
                const doneBlocks = lessonStats.done[lesson.id] ?? 0;
                const percent = totalBlocks > 0 ? Math.round((doneBlocks / totalBlocks) * 100) : 0;
                const prevDone = idx === 0 || isLessonDone(mod.lessons[idx - 1].id);
                const locked = !isStaffPreview && !prevDone; // xem trước: mở hết
                const completed = isLessonDone(lesson.id);
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => navigate(`/student/learn/${lesson.id}`)}
                      className={`w-full flex items-center gap-3 text-left border rounded-xl px-4 py-3 transition-colors ${
                        locked
                          ? 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60'
                          : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          completed
                            ? 'bg-green-100 text-green-700'
                            : locked
                            ? 'bg-slate-200 text-slate-400'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {completed ? '✓' : locked ? '🔒' : idx + 1}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-slate-800 truncate">{lesson.title}</span>
                        {lesson.description && (
                          <span className="block text-xs text-slate-500 truncate">{lesson.description}</span>
                        )}
                        {!isStaffPreview && (
                          <span className="mt-1.5 flex items-center gap-2">
                            <span className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <span
                                className={`block h-full rounded-full transition-all ${completed ? 'bg-green-500' : 'bg-indigo-500'}`}
                                style={{ width: `${percent}%` }}
                              />
                            </span>
                            <span className="text-[11px] text-slate-400 tabular-nums flex-shrink-0">
                              {doneBlocks}/{totalBlocks} mục · {percent}%
                            </span>
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
