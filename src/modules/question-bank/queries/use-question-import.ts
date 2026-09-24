import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buildImportTemplate, previewQuestionImport, runQuestionImport, type RunImportInput } from '../application/import-questions';
import { questionBankKeys } from './keys';

export function useImportTemplate() {
  return useMutation({ mutationFn: (kind: 'spreadsheet' | 'zip') => buildImportTemplate(kind) });
}

/** Reading a file is a user action with no cache to share, so it is a mutation rather than a query. */
export function usePreviewQuestionImport(libraryId: string) {
  return useMutation({ mutationFn: (file: File) => previewQuestionImport(libraryId, file) });
}

export function useRunQuestionImport(libraryId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RunImportInput) => runQuestionImport(input),
    onSuccess: () => client.invalidateQueries({ queryKey: questionBankKeys.workspace(libraryId) }),
  });
}
