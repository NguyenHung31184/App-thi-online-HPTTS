import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadQuestionDraft, saveQuestion, type SaveQuestionInput } from '../application/edit-question';
import { questionBankKeys } from './keys';

export function useQuestionDraft(libraryId: string, questionId: string | null) {
  return useQuery({
    queryKey: questionBankKeys.question(questionId ?? ''),
    queryFn: () => loadQuestionDraft(libraryId, questionId ?? ''),
    enabled: Boolean(libraryId && questionId),
    // The form copies the draft into local state once; a background refetch must not overwrite edits.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useSaveQuestion(libraryId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveQuestionInput) => saveQuestion(input),
    onSuccess: (questionId) => {
      client.invalidateQueries({ queryKey: questionBankKeys.workspace(libraryId) });
      client.removeQueries({ queryKey: questionBankKeys.question(questionId) });
    },
  });
}
