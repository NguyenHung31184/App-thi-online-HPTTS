import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buildImportTemplate, planWordImport, previewQuestionImport, runQuestionImport, type ImportPreview, type MarkingChoice, type RunImportInput } from '../application/import-questions';
import type { QuestionDraft } from '../domain/question-draft';
import { questionBankKeys } from './keys';

export function useImportTemplate() {
  return useMutation({ mutationFn: (kind: 'spreadsheet' | 'zip') => buildImportTemplate(kind) });
}

/** Reading a file is a user action with no cache to share, so it is a mutation rather than a query. */
export function usePreviewQuestionImport(libraryId: string) {
  return useMutation({
    mutationFn: ({ file, marking }: { file: File; marking?: MarkingChoice }) => previewQuestionImport(libraryId, file, marking),
  });
}

export function useRunQuestionImport(libraryId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RunImportInput) => runQuestionImport(input),
    onSuccess: () => client.invalidateQueries({ queryKey: questionBankKeys.workspace(libraryId) }),
  });
}

/** The import plan after the preview's edits; a Word preview is planned again on every edit, other files as read. */
export function useImportPlan(preview: ImportPreview | undefined, edits: ReadonlyMap<number, QuestionDraft>) {
  return useMemo(() => {
    if (!preview) return undefined;
    return preview.word ? planWordImport(preview, edits) : preview.plan;
  }, [edits, preview]);
}
