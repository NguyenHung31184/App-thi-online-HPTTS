import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/AuthContext';
import type { ImportProgress } from '../application/import-questions';
import type { QuestionPayload } from '../domain/question-draft';
import type { SkippedRow } from '../domain/question-import';
import { useImportTemplate, usePreviewQuestionImport, useRunQuestionImport } from '../queries/use-question-import';
import { saveFile } from './download';
import { useLibraryContext } from './library-context';
import { difficultyLabels, errorMessage, fieldClass, focusRing, questionTypeLabels } from './labels';
import { BackLink, ErrorState, LoadingState } from './states';

const READY_SHOWN = 100;
const secondaryButton = `inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${focusRing}`;

const answerRules = [
  ['Trắc nghiệm', 'một chữ A–J hoặc số 1–10.'],
  ['Nhiều đáp án', 'các đáp án đúng cách nhau bằng dấu chấm phẩy, ví dụ A;C.'],
  ['Kéo thả', 'thứ tự đúng của tất cả các nhãn, ví dụ B;A;D;C.'],
  ['Đúng/Sai', 'một giá trị cho mỗi phát biểu, ví dụ Đ;S;Đ;S (hoặc T;F;T;F).'],
  ['Nối đôi', 'A-1;B-2… và ghi nội dung cột phải ở cột Keys, cách nhau bằng dấu chấm phẩy.'],
  ['Tự luận', 'để trống; cột Keys ghi các ý chấm dạng ý|điểm;ý|điểm.'],
];

function parsed(value: string): unknown {
  try { return JSON.parse(value); } catch { return null; }
}

function answerSummary(payload: QuestionPayload): string {
  const key = parsed(payload.answer_key);
  const list = Array.isArray(key) ? key.map(String) : [];
  switch (payload.question_type) {
    case 'single_choice': return `Đáp án ${payload.answer_key}`;
    case 'multiple_choice': return `Đáp án ${list.join(', ')}`;
    case 'drag_drop': return `Thứ tự ${list.join(' → ')}`;
    case 'true_false_multi': return list.map((value, index) => `${payload.options[index]?.id ?? ''} ${value === 'T' ? 'Đúng' : 'Sai'}`).join(', ');
    case 'matching': return `${payload.options.length} cặp nối`;
    default: return list.length > 0 ? `${list.length} ý chấm` : 'Chấm tay, không có ý chấm';
  }
}

function progressLabel(progress: ImportProgress | null): string {
  if (progress?.step === 'images') return `Đang tải ảnh ${progress.done + 1}/${progress.total}…`;
  return 'Đang lưu câu hỏi…';
}

function SkippedList({ rows }: { rows: SkippedRow[] }) {
  return (
    <ul className="mt-2 space-y-2 text-sm">
      {rows.map((row) => (
        <li key={row.line} className="break-words">
          <span className="font-semibold">Dòng {row.line}</span>
          {row.stem && <span className="text-slate-700">: {row.stem.length > 90 ? `${row.stem.slice(0, 90)}…` : row.stem}</span>}
          <span className="block">{row.reason}</span>
        </li>
      ))}
    </ul>
  );
}

export default function QuestionSpreadsheetImportPage() {
  const { library } = useLibraryContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const preview = usePreviewQuestionImport(library.id);
  const run = useRunQuestionImport(library.id);
  const template = useImportTemplate();
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const listUrl = `/admin/question-libraries/${library.id}/questions`;
  const plan = preview.data?.plan;

  const chooseFile = (input: HTMLInputElement) => {
    const file = input.files?.[0];
    // Cleared so that picking the same file again, after fixing it, reads it again.
    input.value = '';
    if (!file) return;
    run.reset();
    preview.mutate(file);
  };

  const downloadTemplate = async (kind: 'spreadsheet' | 'zip') => {
    try {
      saveFile(await template.mutateAsync(kind));
    } catch {
      toast.error('Không tạo được file mẫu.');
    }
  };

  const submit = async () => {
    if (!preview.data) return;
    try {
      const count = await run.mutateAsync({ library, preview: preview.data, status, createdBy: user?.id ?? null, onProgress: setProgress });
      toast.success(`Đã nhập ${count} câu vào ngân hàng.`);
      navigate(status === 'draft' ? `${listUrl}?status=draft` : listUrl);
    } catch {
      // Shown from run.error below.
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Nhập câu hỏi từ Excel hoặc ZIP</h2>
          <p className="mt-1 text-sm text-slate-600">Câu hỏi vào thẳng ngân hàng này, không cần chọn nghề.</p>
        </div>
        <BackLink to={listUrl}>Về danh sách câu hỏi</BackLink>
      </header>

      <section aria-labelledby="import-file-heading" className="max-w-3xl space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h3 id="import-file-heading" className="font-semibold text-slate-900">Chọn file</h3>
        <p className="text-sm text-slate-700">
          Mỗi dòng ở trang tính đầu tiên là một câu. Muốn kèm ảnh, để ảnh trong thư mục <code className="rounded bg-slate-100 px-1">images/</code>, ghi tên ảnh ở cột "Tên file ảnh", rồi nén cả thư mục và file Excel thành một file ZIP.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void downloadTemplate('spreadsheet')} disabled={template.isPending} className={secondaryButton}>Tải file mẫu Excel</button>
          <button type="button" onClick={() => void downloadTemplate('zip')} disabled={template.isPending} className={secondaryButton}>Tải file mẫu ZIP</button>
        </div>
        <details className="text-sm text-slate-700">
          <summary className={`inline-flex min-h-11 cursor-pointer items-center rounded font-medium text-indigo-700 hover:text-indigo-900 ${focusRing}`}>Cách ghi cột "Đáp án đúng" theo loại câu</summary>
          <ul className="mt-1 space-y-1">
            {answerRules.map(([type, rule]) => <li key={type}><span className="font-medium text-slate-900">{type}:</span> {rule}</li>)}
          </ul>
          <p className="mt-2">Cột "Loại câu hỏi" để trống thì có đáp án là Trắc nghiệm, không có đáp án mà có Keys là Tự luận. Độ khó để trống là Trung bình; điểm để trống là 2.</p>
        </details>
        <label className="block text-sm font-medium text-slate-800">File câu hỏi (.xlsx, .xls, .csv hoặc .zip)
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.zip"
            disabled={preview.isPending || run.isPending}
            onChange={(event) => chooseFile(event.target)}
            className={`mt-1 block w-full text-sm text-slate-700 file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:font-medium file:text-indigo-800 hover:file:bg-indigo-100 disabled:opacity-60 ${focusRing}`}
          />
        </label>
      </section>

      {preview.isPending && <LoadingState>Đang đọc file…</LoadingState>}
      {preview.isError && <ErrorState title="Không đọc được file" detail={errorMessage(preview.error, 'Chọn lại file.')} />}

      {plan && preview.data && (
        <section aria-labelledby="import-result-heading" className="max-w-3xl space-y-4">
          <div>
            <h3 id="import-result-heading" className="font-semibold text-slate-900">Kết quả đọc file {preview.data.fileName}</h3>
            <p className="mt-1 text-sm text-slate-700" aria-live="polite">
              <span className="font-semibold text-emerald-800">{plan.ready.length} câu sẵn sàng</span>
              {' · '}<span className={plan.errors.length > 0 ? 'font-semibold text-rose-800' : ''}>{plan.errors.length} dòng lỗi</span>
              {' · '}{plan.duplicates.length} dòng trùng
            </p>
          </div>

          {plan.notices.map((notice) => (
            <p key={notice} role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>
          ))}

          {plan.errors.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
              <h4 className="font-semibold">Dòng lỗi, sẽ không được nhập</h4>
              <p className="mt-1 text-sm">Sửa trong file rồi chọn lại file để nhập cả những dòng này.</p>
              <SkippedList rows={plan.errors} />
            </div>
          )}

          {plan.duplicates.length > 0 && (
            <details className="rounded-xl border border-slate-200 bg-white px-4 py-1 text-slate-800">
              <summary className={`inline-flex min-h-11 cursor-pointer items-center rounded font-medium ${focusRing}`}>
                {plan.duplicates.length} dòng trùng câu đã có, sẽ bỏ qua
              </summary>
              <div className="pb-3"><SkippedList rows={plan.duplicates} /></div>
            </details>
          )}

          {plan.ready.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white">
              <h4 className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">Câu sẽ nhập</h4>
              <ol className="divide-y divide-slate-100">
                {plan.ready.slice(0, READY_SHOWN).map((row) => (
                  <li key={row.line} className="px-4 py-3 text-sm">
                    <p className="line-clamp-2 break-words text-slate-900"><span className="font-semibold">Dòng {row.line}.</span> {row.payload.stem}</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span>{questionTypeLabels[row.payload.question_type]}</span>
                      <span>{answerSummary(row.payload)}</span>
                      <span>{row.payload.points} điểm</span>
                      <span>{difficultyLabels[row.payload.difficulty] ?? row.payload.difficulty}</span>
                      {row.payload.topic && <span>{row.payload.topic}</span>}
                      {row.imageName && <span>Ảnh {row.imageName}</span>}
                    </p>
                    {row.note && <p className="mt-1 text-xs text-amber-900">{row.note}</p>}
                  </li>
                ))}
              </ol>
              {plan.ready.length > READY_SHOWN && (
                <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">Còn {plan.ready.length - READY_SHOWN} câu nữa, cũng sẵn sàng nhập.</p>
              )}
            </div>
          )}

          {run.isError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{errorMessage(run.error, 'Không nhập được câu hỏi.')}</p>
          )}

          {plan.ready.length > 0 && (
            <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
              <label className="block min-w-60 flex-1 text-sm font-medium text-slate-800">Trạng thái sau khi nhập
                <select value={status} onChange={(event) => setStatus(event.target.value as 'published' | 'draft')} disabled={run.isPending} className={`${fieldClass} mt-1`}>
                  <option value="published">Đã phát hành: được bốc vào đề thi ngay</option>
                  <option value="draft">Bản nháp: xem lại trước khi dùng</option>
                </select>
              </label>
              <button type="button" onClick={() => void submit()} disabled={run.isPending} className={`min-h-11 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}>
                {run.isPending ? progressLabel(progress) : `Nhập ${plan.ready.length} câu vào ngân hàng`}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
