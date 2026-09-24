import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { QUESTION_TYPES, emptyDraft, type QuestionDraft } from '../../domain/question-draft';
import type { QuestionLibrary, QuestionStatus } from '../../domain/question-library';
import { useRemoveQuestions } from '../../queries/use-question-actions';
import { useQuestionDraft, useSaveQuestion } from '../../queries/use-question-editor';
import { ConfirmDialog } from '../confirm-dialog';
import { useLibraryContext } from '../library-context';
import { deleteExplanation, difficultyLabels, drawWarning, errorMessage, fieldClass, focusRing, questionStatusLabels, questionTypeLabels, removeResultMessage } from '../labels';
import { BackLink, ErrorState, LoadingState } from '../states';
import { ChoiceOptionsField, DragDropField, EssayField, MatchingField, TrueFalseField, type DraftUpdate } from './question-fields';

const statuses: QuestionStatus[] = ['published', 'review', 'draft', 'retired'];

function useReturnTo(libraryId: string) {
  const location = useLocation();
  return (location.state as { returnTo?: string } | null)?.returnTo ?? `/admin/question-libraries/${libraryId}/questions`;
}

export default function QuestionEditorPage() {
  const { questionId } = useParams();
  const { library } = useLibraryContext();
  const returnTo = useReturnTo(library.id);
  const { data, isLoading, error, refetch } = useQuestionDraft(library.id, questionId ?? null);

  if (!questionId) return <QuestionEditorForm key="new" library={library} questionId={null} initialDraft={emptyDraft()} returnTo={returnTo} />;
  if (isLoading) return <LoadingState>Đang tải câu hỏi…</LoadingState>;
  if (error || !data) {
    return (
      <ErrorState
        title="Không mở được câu hỏi"
        detail={errorMessage(error, 'Kiểm tra kết nối mạng.')}
        onRetry={() => void refetch()}
        action={<BackLink to={returnTo}>Về danh sách câu hỏi</BackLink>}
      />
    );
  }
  return <QuestionEditorForm key={questionId} library={library} questionId={questionId} initialDraft={data} returnTo={returnTo} />;
}

interface FormProps {
  library: QuestionLibrary;
  questionId: string | null;
  initialDraft: QuestionDraft;
  returnTo: string;
}

function QuestionEditorForm({ library, questionId, initialDraft, returnTo }: FormProps) {
  const navigate = useNavigate();
  const save = useSaveQuestion(library.id);
  const remove = useRemoveQuestions(library.id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState(initialDraft);
  const [initialJson] = useState(() => JSON.stringify(initialDraft));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  const isNew = questionId === null;

  const previewUrl = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const imageSrc = previewUrl ?? draft.imageUrl;
  const dirty = imageFile !== null || JSON.stringify(draft) !== initialJson;

  // Warns before closing or reloading the tab with unsaved edits. In-app links are covered by the cancel button's confirm.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update: DraftUpdate = (patch) => setDraft((current) => ({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) }));

  const leave = () => {
    if (dirty && !window.confirm('Bỏ các thay đổi chưa lưu?')) return;
    navigate(returnTo);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    try {
      await save.mutateAsync({ library, questionId, draft, imageFile });
      toast.success(isNew ? 'Đã thêm câu hỏi.' : 'Đã lưu câu hỏi.');
      navigate(returnTo);
    } catch (reason) {
      setFormError(errorMessage(reason, 'Không lưu được câu hỏi.'));
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  };

  const deleteQuestion = async () => {
    if (!questionId) return;
    try {
      toast.success(removeResultMessage(await remove.mutateAsync([questionId])));
      navigate(returnTo);
    } catch (reason) {
      setConfirmingDelete(false);
      toast.error(errorMessage(reason, 'Không xóa được câu hỏi.'));
    }
  };

  const imageSection = (
    <div>
      <label className="block text-sm font-medium text-slate-800">Ảnh minh họa
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
          className={`mt-1 block w-full text-sm text-slate-700 file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:font-medium file:text-indigo-800 hover:file:bg-indigo-100 ${focusRing}`}
        />
      </label>
      {imageSrc && (
        <div className="mt-2 flex flex-wrap items-start gap-3">
          <img src={imageSrc} alt="Ảnh minh họa của câu hỏi" className="max-h-60 max-w-full rounded-lg border border-slate-200" />
          <button
            type="button"
            onClick={() => { setImageFile(null); update({ imageUrl: null }); }}
            className={`inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 ${focusRing}`}
          >
            Bỏ ảnh
          </button>
        </div>
      )}
    </div>
  );

  const type = draft.questionType;
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">{isNew ? 'Thêm câu hỏi' : 'Sửa câu hỏi'}</h2>
          <p className="mt-1 text-sm text-slate-600">{questionTypeLabels[type]}</p>
        </div>
        <button type="button" onClick={leave} className={`inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 ${focusRing}`}>
          Về danh sách câu hỏi
        </button>
      </header>

      <form onSubmit={submit} className="max-w-3xl space-y-5" noValidate>
        {formError && (
          <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {formError}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-800">Loại câu hỏi
            <select value={type} onChange={(event) => update({ questionType: event.target.value as QuestionDraft['questionType'] })} className={`${fieldClass} mt-1`}>
              {QUESTION_TYPES.map((value) => <option key={value} value={value}>{questionTypeLabels[value]}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-800">Trạng thái
            <select value={draft.status} onChange={(event) => update({ status: event.target.value as QuestionStatus })} className={`${fieldClass} mt-1`}>
              {statuses.map((value) => <option key={value} value={value}>{questionStatusLabels[value]}</option>)}
            </select>
            {draft.status !== 'published' && <span className="mt-1 block text-xs font-normal text-slate-600">Chỉ câu "Đã phát hành" được bốc vào đề thi.</span>}
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-800">Nội dung câu hỏi
          <textarea value={draft.stem} onChange={(event) => update({ stem: event.target.value })} rows={3} required className={`${fieldClass} mt-1`} />
        </label>

        {(type === 'single_choice' || type === 'multiple_choice') && <ChoiceOptionsField draft={draft} update={update} />}
        {type === 'true_false_multi' && <TrueFalseField draft={draft} update={update} />}
        {type === 'matching' && <MatchingField draft={draft} update={update} />}
        {(type === 'video_paragraph' || type === 'main_idea') && <EssayField draft={draft} update={update} />}
        {type === 'drag_drop' && (
          <>
            {imageSection}
            <DragDropField draft={draft} update={update} imageSrc={imageSrc} />
          </>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-medium text-slate-800">Điểm
            <input type="number" min={1} step={1} value={draft.points} onChange={(event) => update({ points: Number(event.target.value) })} className={`${fieldClass} mt-1`} />
          </label>
          <label className="block text-sm font-medium text-slate-800">Độ khó
            <select value={draft.difficulty} onChange={(event) => update({ difficulty: event.target.value })} className={`${fieldClass} mt-1`}>
              {Object.entries(difficultyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              {!(draft.difficulty in difficultyLabels) && <option value={draft.difficulty}>{draft.difficulty}</option>}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-800">Chủ đề
            <input value={draft.topic} onChange={(event) => update({ topic: event.target.value })} className={`${fieldClass} mt-1`} />
            <span className="mt-1 block text-xs font-normal text-slate-600">Ma trận đề lọc câu theo đúng chữ ở đây.</span>
          </label>
        </div>

        {type !== 'drag_drop' && imageSection}

        <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
          <button disabled={save.isPending} className={`min-h-11 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}>
            {save.isPending ? 'Đang lưu…' : isNew ? 'Thêm câu hỏi' : 'Lưu thay đổi'}
          </button>
          <button type="button" onClick={leave} className={`min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 ${focusRing}`}>
            Hủy
          </button>
          {!isNew && (
            <button type="button" onClick={() => setConfirmingDelete(true)} className={`min-h-11 rounded-lg border border-rose-300 bg-white px-4 text-sm font-medium text-rose-800 hover:bg-rose-50 sm:ml-auto ${focusRing}`}>
              Xóa câu hỏi
            </button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirmingDelete}
        title="Xóa câu hỏi này?"
        confirmLabel="Xóa"
        tone="danger"
        pending={remove.isPending}
        onConfirm={() => void deleteQuestion()}
        onCancel={() => setConfirmingDelete(false)}
      >
        <p>{deleteExplanation}</p>
        <p>{drawWarning}</p>
      </ConfirmDialog>
    </div>
  );
}
