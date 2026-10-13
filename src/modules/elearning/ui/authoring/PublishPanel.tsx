import { useState } from 'react';
import { Eye, EyeOff, Send } from 'lucide-react';
import type { AssignedBlock } from '../../domain/assigned-learning';
import {
  BLOCK_LABELS, authoringErrorMessage, draftDiffersFromVersion, publishBlocker, sortByOrder,
  type LessonBlockRow, type LessonRow, type LessonVersion,
} from '../../domain/lesson-authoring';
import { usePublishLesson } from '../../queries/use-lesson-authoring';
import { BlockContent } from '../BlockContent';

function Preview({ blocks }: { blocks: AssignedBlock[] }) {
  return (
    <div className="mt-3 space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      {sortByOrder(blocks).map((block, index) => (
        <div key={block.id}>
          <p className="mb-2 text-sm font-semibold text-slate-800">{index + 1}. {block.title || BLOCK_LABELS[block.block_type]}</p>
          <BlockContent block={block} />
        </div>
      ))}
    </div>
  );
}

interface PublishPanelProps {
  lesson: LessonRow;
  blocks: LessonBlockRow[];
  versions: LessonVersion[];
}

/** Preview of the draft, the publish button, and the published versions. */
export function PublishPanel({ lesson, blocks, versions }: PublishPanelProps) {
  const [showDraft, setShowDraft] = useState(false);
  const [openVersionId, setOpenVersionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const publish = usePublishLesson();
  const latest = versions[0] ?? null;
  const blocker = publishBlocker(blocks);
  const changed = draftDiffersFromVersion(lesson, blocks, latest);

  const handlePublish = async () => {
    setError('');
    try {
      await publish.mutateAsync(lesson.id);
    } catch (reason) {
      setError(authoringErrorMessage(reason));
    }
  };

  const status = !latest
    ? 'Bài chưa xuất bản. Học viên chưa thấy bài này.'
    : changed
      ? `Bản nháp đã khác phiên bản ${latest.version}. Xuất bản để tạo phiên bản ${latest.version + 1}.`
      : `Bản nháp trùng với phiên bản ${latest.version}, không có gì mới để xuất bản.`;

  return (
    <section aria-labelledby="publish-title" className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 id="publish-title" className="text-base font-semibold text-slate-900">Xem trước và xuất bản</h2>
      <p className="mt-1 text-sm text-slate-600">
        Mỗi lần xuất bản tạo một phiên bản cố định. Lớp đã được giao vẫn học phiên bản cũ cho tới khi bạn giao lại phiên bản mới.
      </p>

      <p className="mt-3 text-sm font-medium text-slate-800">{status}</p>
      {blocker && <p className="mt-1 text-sm text-amber-800">{blocker}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowDraft((shown) => !shown)}
          disabled={blocks.length === 0}
          aria-expanded={showDraft}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {showDraft ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          {showDraft ? 'Ẩn bản nháp' : 'Xem trước bản nháp'}
        </button>
        <button
          type="button"
          onClick={() => { void handlePublish(); }}
          disabled={publish.isPending || blocker !== null || !changed}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden />
          {publish.isPending ? 'Đang xuất bản...' : latest ? `Xuất bản phiên bản ${latest.version + 1}` : 'Xuất bản'}
        </button>
      </div>
      {showDraft && blocks.length > 0 && <Preview blocks={blocks} />}

      {versions.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-800">Phiên bản đã xuất bản</h3>
          <ul className="mt-2 space-y-2">
            {versions.map((version) => (
              <li key={version.id} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold">Phiên bản {version.version}</span>
                    {' · '}{version.blocks.length} khối · {new Date(version.published_at).toLocaleString('vi-VN')}
                  </p>
                  <button
                    type="button"
                    aria-expanded={openVersionId === version.id}
                    onClick={() => setOpenVersionId((current) => (current === version.id ? null : version.id))}
                    className="text-sm font-medium text-indigo-700 hover:underline"
                  >
                    {openVersionId === version.id ? 'Ẩn nội dung' : 'Xem nội dung'}
                  </button>
                </div>
                {openVersionId === version.id && <Preview blocks={version.blocks} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
