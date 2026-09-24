import { useQuery } from '@tanstack/react-query';
import { resolveLegacyQuestionBankPath, type LegacyTarget } from '../application/legacy-links';
import { questionBankKeys } from './keys';

export function useLegacyQuestionBankPath(target: LegacyTarget, moduleId: string | null, questionId: string | null) {
  return useQuery({
    queryKey: questionBankKeys.legacyLink(target, moduleId ?? '', questionId ?? ''),
    queryFn: () => resolveLegacyQuestionBankPath({ target, moduleId, questionId }),
    retry: false,
  });
}
