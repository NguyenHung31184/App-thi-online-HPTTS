import { useParams } from 'react-router-dom';
import { useQuestionImportDrafts } from '../queries/use-question-library';
import type { QuestionImportDraft } from '../domain/question-library';
import { errorMessage } from './labels';
import { BackLink, EmptyState, ErrorState, LoadingState } from './states';

const draftStatusLabels: Record<QuestionImportDraft['status'], string> = {
  pending: 'Chờ rà soát',
  accepted: 'Đã chấp nhận',
  rejected: 'Đã loại',
  imported: 'Đã đưa vào ngân hàng',
};

export default function QuestionImportReviewPage() {
  const { jobId = '', libraryId } = useParams();
  const { data: drafts = [], isLoading, error, refetch } = useQuestionImportDrafts(jobId);
  const Heading = libraryId ? 'h2' : 'h1';
  // Reached either inside a library (nested route) or through the pre-Phase C URL that has no library id.
  const backTo = libraryId ? `/admin/question-libraries/${libraryId}/imports` : '/admin/question-libraries';

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Heading className="text-xl font-semibold tracking-tight text-slate-900">Bản nháp tách từ tài liệu</Heading>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Màn này chỉ để xem kết quả tách. Chưa có chức năng sửa, chấp nhận hay đưa bản nháp vào ngân hàng, nên không câu nào dưới đây có trong đề thi.</p>
        </div>
        <BackLink to={backTo}>{libraryId ? 'Về phiếu nhập' : 'Về danh sách ngân hàng'}</BackLink>
      </header>

      {isLoading && <LoadingState>Đang tải bản nháp…</LoadingState>}
      {error && <ErrorState title="Không tải được bản nháp" detail={errorMessage(error, 'Kiểm tra kết nối mạng.')} onRetry={() => void refetch()} />}
      {!isLoading && !error && drafts.length === 0 && (
        <EmptyState title="Chưa có bản nháp">
          <p>Worker có thể vẫn đang xử lý, hoặc không tách được câu hỏi nào từ tài liệu này.</p>
        </EmptyState>
      )}

      {drafts.length > 0 && (
        <ol className="space-y-4">
          {drafts.map((draft) => (
            <li key={draft.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="font-semibold text-slate-900">
                  Câu {draft.sequenceNumber}
                  {draft.sourcePage != null && <span className="ml-2 text-sm font-normal text-slate-600">trang {draft.sourcePage}</span>}
                </h3>
                <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">{draftStatusLabels[draft.status]}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{draft.payload.stem || 'Không nhận diện được nội dung câu hỏi.'}</p>
              {Array.isArray(draft.payload.options) && draft.payload.options.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {draft.payload.options.map((option) => <li key={option.id} className="rounded-lg bg-slate-50 px-3 py-2 break-words"><strong>{option.id}.</strong> {option.text}</li>)}
                </ul>
              )}
              {draft.validationIssues.length > 0 && (
                <div className="mt-3 text-sm text-amber-900">
                  <p className="font-medium">Cần kiểm tra:</p>
                  <ul className="mt-1 list-disc pl-5">{draft.validationIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
                </div>
              )}
              {draft.imagePaths.length > 0 && <p className="mt-2 text-sm text-slate-600">Đã tách {draft.imagePaths.length} hình. Cần gắn đúng hình vào câu hỏi khi biên tập.</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
