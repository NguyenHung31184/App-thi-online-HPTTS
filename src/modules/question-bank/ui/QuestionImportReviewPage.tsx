import { Link, useParams } from 'react-router-dom';
import { useQuestionImportDrafts } from '../queries/use-question-library';

export default function QuestionImportReviewPage() {
  const { jobId = '' } = useParams();
  const { data: drafts = [], isLoading, error } = useQuestionImportDrafts(jobId);

  if (isLoading) return <p className="text-slate-600">Dang tai ban nhap...</p>;
  if (error) return <p className="text-red-700">{error instanceof Error ? error.message : 'Khong the tai ban nhap.'}</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Nhap tai lieu</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Ra soat cau hoi nhap</h1>
          <p className="mt-1 text-sm text-slate-600">Ket qua tu tai lieu chua duoc dua vao de thi. Hoan thien dap an va noi dung truoc khi phat hanh.</p>
        </div>
        <Link to="/admin/question-libraries" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Quay lai ngan hang</Link>
      </header>

      {drafts.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <h2 className="font-semibold text-slate-800">Chua co ban nhap de ra soat</h2>
          <p className="mt-2 text-sm text-slate-600">Worker co the dang xu ly, hoac tai lieu khong tach duoc cau hoi.</p>
        </section>
      ) : (
        <ol className="space-y-4">
          {drafts.map((draft) => (
            <li key={draft.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="font-semibold text-slate-900">Cau {draft.sequenceNumber}</h2>
                <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">Can ra soat: {draft.status}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{draft.payload.stem || 'Khong nhan dien duoc noi dung cau hoi.'}</p>
              {Array.isArray(draft.payload.options) && draft.payload.options.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {draft.payload.options.map((option) => <li key={option.id} className="rounded-lg bg-slate-50 px-3 py-2"><strong>{option.id}.</strong> {option.text}</li>)}
                </ul>
              )}
              {draft.validationIssues.length > 0 && <p className="mt-3 text-sm text-amber-900">Can kiem tra: {draft.validationIssues.join(' ')}</p>}
              {draft.imagePaths.length > 0 && <p className="mt-2 text-sm text-slate-600">Da tach {draft.imagePaths.length} hinh; can gan dung hinh vao cau hoi khi bien tap.</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
