import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import type { LegacyTarget } from '../application/legacy-links';
import { useLegacyQuestionBankPath } from '../queries/use-legacy-link';
import { LoadingState } from './states';

/** Old course-based URLs (/admin/questions/occupation/...) open the matching library screen. */
export default function LegacyQuestionBankRedirect({ target }: { target: LegacyTarget }) {
  const { qId } = useParams();
  const [params] = useSearchParams();
  const { data, isError } = useLegacyQuestionBankPath(target, params.get('moduleId'), qId ?? null);
  if (isError) return <Navigate to="/admin/question-libraries" replace />;
  if (!data) return <LoadingState>Đang mở ngân hàng câu hỏi…</LoadingState>;
  return <Navigate to={data} replace />;
}
