import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import ConfirmationModal from '../../../../shared/ui/ConfirmationModal';
import EmptyState from '../../../../shared/ui/EmptyState';
import IconAction from '../../../../shared/ui/IconAction';
import { authoringErrorMessage } from '../../domain/lesson-authoring';
import {
  useCreateLesson, useLearningModules, useLessonCatalog, useMoveLesson, useRemoveLesson,
} from '../../queries/use-lesson-authoring';

/** Lessons of one module: add, reorder, open the editor, move to the trash. */
export default function LessonsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const moduleId = params.get('module') ?? '';
  const [newTitle, setNewTitle] = useState('');
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const modulesQuery = useLearningModules();
  const catalogQuery = useLessonCatalog(moduleId);
  const createLesson = useCreateLesson(moduleId);
  const removeLesson = useRemoveLesson();
  const moveLesson = useMoveLesson();

  // A module shared by several courses is listed once, with every course that teaches it.
  const modules = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; code?: string; courses: string[] }>();
    for (const item of modulesQuery.data ?? []) {
      const entry = byId.get(item.id) ?? { id: item.id, name: item.name, code: item.code, courses: [] };
      if (item.course_name && !entry.courses.includes(item.course_name)) entry.courses.push(item.course_name);
      byId.set(item.id, entry);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [modulesQuery.data]);

  const entries = catalogQuery.data ?? [];
  const lessons = entries.map((entry) => entry.lesson);
  const deleting = entries.find((entry) => entry.lesson.id === deleteId) ?? null;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const lesson = await createLesson.mutateAsync({ title: newTitle, siblings: lessons });
      setNewTitle('');
      navigate(`/admin/lessons/${lesson.id}`);
    } catch (reason) {
      setError(authoringErrorMessage(reason));
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setError('');
    try {
      await removeLesson.mutateAsync(deleteId);
    } catch (reason) {
      setError(authoringErrorMessage(reason));
    } finally {
      setDeleteId(null);
    }
  };

  const handleMove = (lessonId: string, direction: -1 | 1) => {
    setError('');
    moveLesson.mutate({ lessons, lessonId, direction }, { onError: (reason) => setError(authoringErrorMessage(reason)) });
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Bài học</h1>
        <p className="mt-1 text-sm text-slate-600">
          Soạn bài theo mô-đun, xuất bản rồi giao cho lớp. Học viên học trong mục "Học trực tuyến" của tài khoản thi.
        </p>
      </div>

      <label htmlFor="lesson-module" className="mb-1 block text-sm font-medium text-slate-700">Mô-đun</label>
      <select
        id="lesson-module"
        value={moduleId}
        onChange={(event) => setParams(event.target.value ? { module: event.target.value } : {}, { replace: true })}
        className="mb-5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
      >
        <option value="">— Chọn mô-đun —</option>
        {modules.map((item) => (
          <option key={item.id} value={item.id}>
            {item.code ? `${item.code} · ` : ''}{item.name}{item.courses.length > 0 ? ` (${item.courses.join(', ')})` : ''}
          </option>
        ))}
      </select>
      {modulesQuery.isError && <p role="alert" className="mb-4 text-sm text-red-600">Không tải được danh sách mô-đun.</p>}

      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!moduleId && <p className="text-sm text-slate-600">Chọn một mô-đun để xem và soạn bài học của mô-đun đó.</p>}

      {moduleId && (
        <>
          <form onSubmit={handleCreate} className="mb-5 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="new-lesson-title" className="sr-only">Tên bài học mới</label>
            <input
              id="new-lesson-title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Tên bài học mới, ví dụ: Bài 1. An toàn khi làm việc trên cần trục"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
            />
            <button
              type="submit"
              disabled={createLesson.isPending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> {createLesson.isPending ? 'Đang tạo...' : 'Thêm bài học'}
            </button>
          </form>

          {catalogQuery.isPending && <p role="status" className="text-sm text-slate-500">Đang tải bài học...</p>}
          {catalogQuery.isError && (
            <div role="alert" className="text-sm text-red-600">
              Không tải được bài học: {authoringErrorMessage(catalogQuery.error)}{' '}
              <button type="button" onClick={() => void catalogQuery.refetch()} className="underline">Tải lại</button>
            </div>
          )}

          {catalogQuery.isSuccess && entries.length === 0 && (
            <EmptyState
              icon={<BookOpen className="h-7 w-7" />}
              title="Mô-đun này chưa có bài học"
              description="Nhập tên bài ở ô phía trên rồi bấm Thêm bài học."
            />
          )}

          <ol className="space-y-2">
            {entries.map((entry, index) => (
              <li key={entry.lesson.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <span className="w-6 shrink-0 text-center text-sm font-semibold text-slate-500">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/lessons/${entry.lesson.id}`} className="block truncate font-medium text-slate-900 hover:text-indigo-700">
                    {entry.lesson.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {entry.blockCount} khối nội dung
                    {' · '}
                    {entry.latestVersion > 0 ? `Đã xuất bản, phiên bản ${entry.latestVersion}` : 'Chưa xuất bản'}
                    {' · '}
                    {entry.assignedClassCount > 0 ? `Đang giao cho ${entry.assignedClassCount} lớp` : 'Chưa giao cho lớp nào'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {index > 0 && (
                    <IconAction title="Chuyển lên" onClick={() => handleMove(entry.lesson.id, -1)}><ArrowUp className="h-4 w-4" /></IconAction>
                  )}
                  {index < entries.length - 1 && (
                    <IconAction title="Chuyển xuống" onClick={() => handleMove(entry.lesson.id, 1)}><ArrowDown className="h-4 w-4" /></IconAction>
                  )}
                  <IconAction title="Soạn bài" tone="indigo" to={`/admin/lessons/${entry.lesson.id}`}><Pencil className="h-4 w-4" /></IconAction>
                  <IconAction title="Xóa bài học" tone="red" onClick={() => setDeleteId(entry.lesson.id)}><Trash2 className="h-4 w-4" /></IconAction>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      <ConfirmationModal
        isOpen={deleting !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => { void handleDelete(); }}
        title="Xóa bài học?"
        confirmText="Xóa bài học"
        isLoading={removeLesson.isPending}
      >
        "{deleting?.lesson.title}" sẽ không còn trong danh sách soạn. Các phiên bản đã xuất bản và tiến độ học cũ vẫn được giữ.
      </ConfirmationModal>
    </div>
  );
}
