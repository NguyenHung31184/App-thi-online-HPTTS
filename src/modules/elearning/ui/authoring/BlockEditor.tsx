import { useState } from 'react';
import { ArrowDown, ArrowUp, FileText, Newspaper, Pencil, Plus, Trash2, Video } from 'lucide-react';
import IconAction from '../../../../shared/ui/IconAction';
import {
  AUTHORABLE_BLOCK_TYPES, BLOCK_LABELS, PROVIDER_LABELS, authoringErrorMessage, blockFormFromRow, durationLabel, emptyBlockForm,
  guessProvider,
  sortByOrder, type BlockForm, type BlockType, type LessonBlockRow, type StorageProvider,
} from '../../domain/lesson-authoring';
import { useMoveBlock, useRemoveBlock, useSaveBlock } from '../../queries/use-lesson-authoring';

const ICONS: Record<BlockType, typeof Video> = { video: Video, pdf: FileText, article: Newspaper, quiz: FileText };
const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

function blockSummary(block: LessonBlockRow): string {
  const parts = [BLOCK_LABELS[block.block_type]];
  if (block.storage_provider) parts.push(PROVIDER_LABELS[block.storage_provider as StorageProvider] ?? block.storage_provider);
  if (block.duration_seconds) parts.push(durationLabel(block.duration_seconds));
  return parts.join(' · ');
}

/** The draft's blocks in order, with the form that adds a block or rewrites the one being edited. */
export function BlockEditor({ lessonId, blocks }: { lessonId: string; blocks: LessonBlockRow[] }) {
  const [form, setForm] = useState<BlockForm>(emptyBlockForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const saveBlock = useSaveBlock(lessonId);
  const removeBlock = useRemoveBlock();
  const moveBlock = useMoveBlock();
  const sorted = sortByOrder(blocks);
  const isLink = form.blockType !== 'article';

  const fail = (reason: unknown) => setError(authoringErrorMessage(reason));
  const resetForm = (blockType: BlockType = form.blockType) => { setForm(emptyBlockForm(blockType)); setEditingId(null); };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await saveBlock.mutateAsync({ form, blocks, editingId });
      resetForm();
    } catch (reason) {
      fail(reason);
    }
  };

  const startEdit = (block: LessonBlockRow) => {
    setError('');
    setEditingId(block.id);
    setForm(blockFormFromRow(block));
  };

  const handleRemove = (block: LessonBlockRow) => {
    setError('');
    if (editingId === block.id) resetForm();
    removeBlock.mutate(block.id, { onError: fail });
  };

  return (
    <section aria-labelledby="blocks-title" className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 id="blocks-title" className="text-base font-semibold text-slate-900">Nội dung ({sorted.length} khối)</h2>
      <p className="mt-1 text-sm text-slate-600">
        Học viên học lần lượt từ khối trên xuống. Slide PowerPoint: xuất ra PDF hoặc video MP4, tải lên nơi lưu của trung tâm rồi dán đường dẫn vào đây.
      </p>

      {sorted.length > 0 && (
        <ol className="mt-4 space-y-2">
          {sorted.map((block, index) => {
            const Icon = ICONS[block.block_type];
            return (
              <li
                key={block.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${editingId === block.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}
              >
                <Icon className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{index + 1}. {block.title || BLOCK_LABELS[block.block_type]}</p>
                  <p className="truncate text-xs text-slate-600">{blockSummary(block)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {index > 0 && (
                    <IconAction title="Chuyển lên" onClick={() => moveBlock.mutate({ blocks, blockId: block.id, direction: -1 }, { onError: fail })}>
                      <ArrowUp className="h-4 w-4" />
                    </IconAction>
                  )}
                  {index < sorted.length - 1 && (
                    <IconAction title="Chuyển xuống" onClick={() => moveBlock.mutate({ blocks, blockId: block.id, direction: 1 }, { onError: fail })}>
                      <ArrowDown className="h-4 w-4" />
                    </IconAction>
                  )}
                  <IconAction title="Sửa khối" tone="indigo" onClick={() => startEdit(block)}><Pencil className="h-4 w-4" /></IconAction>
                  <IconAction title="Xóa khối" tone="red" onClick={() => handleRemove(block)}><Trash2 className="h-4 w-4" /></IconAction>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">{editingId ? 'Sửa khối đang chọn' : 'Thêm khối mới'}</p>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Loại khối">
          {AUTHORABLE_BLOCK_TYPES.map((type) => {
            const Icon = ICONS[type];
            return (
              <button
                key={type}
                type="button"
                aria-pressed={form.blockType === type}
                disabled={editingId !== null}
                onClick={() => setForm((current) => ({ ...current, blockType: type }))}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
                  form.blockType === type ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden /> {BLOCK_LABELS[type]}
              </button>
            );
          })}
        </div>

        <div>
          <label htmlFor="block-title" className="mb-1 block text-sm font-medium text-slate-700">Tiêu đề khối</label>
          <input
            id="block-title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="Không bắt buộc"
            className={field}
          />
        </div>

        {isLink ? (
          <>
            <div>
              <label htmlFor="block-url" className="mb-1 block text-sm font-medium text-slate-700">Đường dẫn *</label>
              <input
                id="block-url"
                value={form.url}
                onChange={(event) => {
                  const url = event.target.value;
                  setForm((current) => ({ ...current, url, provider: url.trim() ? guessProvider(url.trim()) : current.provider }));
                }}
                placeholder={form.blockType === 'video' ? 'https://... (YouTube, Drive, máy chủ của trung tâm)' : 'https://... (file PDF)'}
                className={field}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="block-provider" className="mb-1 block text-sm font-medium text-slate-700">Nơi lưu</label>
                <select
                  id="block-provider"
                  value={form.provider}
                  onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value as StorageProvider }))}
                  className={`${field} bg-white`}
                >
                  {(Object.keys(PROVIDER_LABELS) as StorageProvider[]).map((provider) => (
                    <option key={provider} value={provider}>{PROVIDER_LABELS[provider]}</option>
                  ))}
                </select>
              </div>
              {form.blockType === 'video' && (
                <div>
                  <label htmlFor="block-minutes" className="mb-1 block text-sm font-medium text-slate-700">
                    Độ dài (phút){form.provider !== 'youtube' && ' *'}
                  </label>
                  <input
                    id="block-minutes"
                    inputMode="decimal"
                    value={form.minutes}
                    onChange={(event) => setForm((current) => ({ ...current, minutes: event.target.value.replace(/[^\d.]/g, '') }))}
                    placeholder="Ví dụ: 12"
                    className={field}
                  />
                </div>
              )}
            </div>
            {form.blockType === 'video' && (
              <p className="text-xs text-slate-600">
                {form.provider === 'youtube'
                  ? 'Video YouTube: hệ thống không đo được thời gian xem, học viên tự bấm "Đã học xong".'
                  : 'Video này được tính hoàn thành khi học viên xem đủ 90% độ dài, tua đi không được tính.'}
              </p>
            )}
          </>
        ) : (
          <div>
            <label htmlFor="block-body" className="mb-1 block text-sm font-medium text-slate-700">Nội dung bài viết *</label>
            <textarea
              id="block-body"
              rows={8}
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              className={`${field} resize-y`}
            />
          </div>
        )}

        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saveBlock.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {!editingId && <Plus className="h-4 w-4" aria-hidden />}
            {saveBlock.isPending ? 'Đang lưu...' : editingId ? 'Lưu khối' : 'Thêm khối'}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setError(''); resetForm(); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Bỏ sửa
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
