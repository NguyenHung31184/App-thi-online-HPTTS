import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buildQuestionExport, changeQuestionStatus, removeQuestions, type ChangeStatusInput } from '../application/manage-questions';
import type { LibraryQuestion } from '../domain/question-library';
import { questionBankKeys } from './keys';

function useRefreshLibrary(libraryId: string) {
  const client = useQueryClient();
  return (ids: string[]) => {
    client.invalidateQueries({ queryKey: questionBankKeys.workspace(libraryId) });
    for (const id of ids) client.removeQueries({ queryKey: questionBankKeys.question(id) });
  };
}

export function useChangeQuestionStatus(libraryId: string) {
  const refresh = useRefreshLibrary(libraryId);
  return useMutation({
    mutationFn: (input: Omit<ChangeStatusInput, 'libraryId'>) => changeQuestionStatus({ ...input, libraryId }),
    onSuccess: (_, input) => refresh(input.ids),
  });
}

export function useRemoveQuestions(libraryId: string) {
  const refresh = useRefreshLibrary(libraryId);
  return useMutation({
    mutationFn: (ids: string[]) => removeQuestions({ libraryId, ids }),
    onSuccess: (_, ids) => refresh(ids),
  });
}

export function useQuestionExport() {
  return useMutation({
    mutationFn: async ({ questions, libraryName }: { questions: LibraryQuestion[]; libraryName: string }) => buildQuestionExport(questions, libraryName),
  });
}
