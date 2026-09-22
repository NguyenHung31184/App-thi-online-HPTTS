import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addQuestionLibrary, addTaxonomyNode, getImportDrafts, getQuestionLibraries, getQuestionLibraryWorkspace, stageQuestionImport } from '../application/manage-question-library';
import { questionBankKeys } from './keys';

export function useQuestionLibraries() {
  return useQuery({ queryKey: questionBankKeys.libraries(), queryFn: getQuestionLibraries });
}

export function useQuestionLibraryWorkspace(libraryId: string) {
  return useQuery({ queryKey: questionBankKeys.workspace(libraryId), queryFn: () => getQuestionLibraryWorkspace(libraryId), enabled: Boolean(libraryId) });
}

export function useCreateQuestionLibrary() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: addQuestionLibrary,
    onSuccess: () => client.invalidateQueries({ queryKey: questionBankKeys.libraries() }),
  });
}

export function useCreateTaxonomyNode(libraryId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: addTaxonomyNode,
    onSuccess: () => client.invalidateQueries({ queryKey: questionBankKeys.workspace(libraryId) }),
  });
}

export function useStageQuestionImport(libraryId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: stageQuestionImport,
    onSuccess: () => client.invalidateQueries({ queryKey: questionBankKeys.workspace(libraryId) }),
  });
}

export function useQuestionImportDrafts(jobId: string) {
  return useQuery({ queryKey: questionBankKeys.drafts(jobId), queryFn: () => getImportDrafts(jobId), enabled: Boolean(jobId) });
}
