import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { authoringErrorMessage, type LessonRow } from '../../domain/lesson-authoring';
import { useLessonDraft, useSaveLessonDetails } from '../../queries/use-lesson-authoring';
import { AssignmentPanel } from './AssignmentPanel';
import { BlockEditor } from './BlockEditor';
import { PublishPanel } from './PublishPanel';

function DetailsForm({ lesson }: { lesson: LessonRow }) {
  const [title, setTitle] = useState(lesson.title);
  const [description, setDescription] = useState(lesson.description ?? '');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const save = useSaveLessonDetails(lesson.id);
  const dirty = title !== lesson.title || description !== (lesson.description ?? '');

  // Another tab, or a refetch after saving, may bring newer stored values.
  useEffect(() => { setTitle(lesson.title); setDescription(lesson.description ?? ''); }, [lesson.title, lesson.description]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      await save.mutateAsync({ title, description });
      setMessage({ kind: 'ok', text: 'Đã lưu tên và mô tả.' });
    } catch (reason) {
      setMessage({ kind: 'error', text: authoringErrorMessage(reason) });
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <label htmlFor="lesson-title" className="mb-1 block text-sm font-medium text-slate-700">Tên bài học *</label>
        <input id="lesson-title" value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
      </div>
      <div>
        <label htmlFor="lesson-description" className="mb-1 block text-sm font-medium text-slate-700">Mô tả ngắn</label>
        <textarea
          id="lesson-description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Học viên học được gì trong bài này"
          className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-red-700' : 'text-green-800'}`}>
          {message.text}
        </p>
      )}
      <button
        type="submit"
        disabled={!dirty || save.isPending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {save.isPending ? 'Đang lưu...' : 'Lưu tên và mô tả'}
      </button>
    </form>
  );
}

/** One lesson: details, blocks, preview and publication, assignment to classes. */
export default function LessonEditorPage() {
  const { lessonId = '' } = useParams<{ lessonId: string }>();
  const draft = useLessonDraft(lessonId);

  if (draft.isPending) return <p role="status" className="text-sm text-slate-500">Đang tải bài học...</p>;
  if (draft.isError) {
    return (
      <div role="alert" className="text-sm text-red-700">
        Không tải được bài học: {authoringErrorMessage(draft.error)}{' '}
        <button type="button" onClick={() => void draft.refetch()} className="underline">Tải lại</button>
      </div>
    );
  }
  if (!draft.data) {
    return (
      <div className="text-sm text-slate-700">
        <p>Không tìm thấy bài học. Bài có thể đã bị xóa.</p>
        <Link to="/admin/lessons" className="mt-2 inline-block text-indigo-700 underline">Về danh sách bài học</Link>
      </div>
    );
  }

  const { lesson, blocks, versions } = draft.data;
  return (
    <div className="space-y-5">
      <div>
        <Link to={`/admin/lessons?module=${encodeURIComponent(lesson.module_id)}`} className="text-sm text-indigo-700 hover:underline">
          ← Danh sách bài học
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-900">{lesson.title}</h1>
      </div>
      <DetailsForm lesson={lesson} />
      <BlockEditor lessonId={lesson.id} blocks={blocks} />
      <PublishPanel lesson={lesson} blocks={blocks} versions={versions} />
      <AssignmentPanel lesson={lesson} versions={versions} />
    </div>
  );
}
