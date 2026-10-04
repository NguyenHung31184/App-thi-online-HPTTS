import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PracticalExamSession } from '../../../types';
import { listClasses, listModulesWithCourses } from '../../integrations/public';
import { deletePracticalPhoto, getPracticalAttempt, listPracticalPhotos, submitPracticalAttempt, uploadPracticalPhoto } from '../application/attempts';
import { loadAttemptResult, loadSessionResults } from '../application/results';
import {
  createPracticalSession, deletePracticalSession, describeSessions, getPracticalSession, getPracticalSessionWithTemplate, listPracticalSessions,
  updatePracticalSession,
} from '../application/sessions';
import {
  addDefaultCriterion, createPracticalTemplate, deletePracticalCriteria, deletePracticalTemplate, getPracticalTemplate, listCriteriaByTemplate,
  listPracticalTemplates, updatePracticalCriteria, updatePracticalTemplate,
} from '../application/templates';
import { buildExcelTemplate, createTemplateFromDraft, readTemplateFile, type TemplateDraft } from '../application/import-template';
import type { CreatePracticalSessionInput, CreatePracticalTemplateInput, PhotoOptions, UpdateCriteriaInput, UpdatePracticalSessionInput, UpdatePracticalTemplateInput } from '../domain/inputs';

export const practicalKeys = {
  all: ['practical-exams'] as const,
  templates: () => [...practicalKeys.all, 'templates'] as const,
  template: (id: string) => [...practicalKeys.all, 'template', id] as const,
  criteria: (templateId: string) => [...practicalKeys.all, 'criteria', templateId] as const,
  sessions: () => [...practicalKeys.all, 'sessions'] as const,
  session: (id: string) => [...practicalKeys.all, 'session', id] as const,
  sessionWithTemplate: (id: string) => [...practicalKeys.all, 'session-with-template', id] as const,
  sessionNames: (ids: string) => [...practicalKeys.all, 'session-names', ids] as const,
  attempts: (sessionId: string) => [...practicalKeys.all, 'attempts', sessionId] as const,
  attempt: (id: string) => [...practicalKeys.all, 'attempt', id] as const,
  photos: (attemptId: string) => [...practicalKeys.all, 'photos', attemptId] as const,
  scores: (attemptId: string) => [...practicalKeys.all, 'scores', attemptId] as const,
  classes: () => [...practicalKeys.all, 'classes'] as const,
  modules: () => [...practicalKeys.all, 'ttdt-modules'] as const,
};

function useInvalidate() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: practicalKeys.all });
}

// Templates and criteria

/** TTDT modules grouped by course, for the template's grade target. */
export function useTtdtModules() {
  return useQuery({ queryKey: practicalKeys.modules(), queryFn: listModulesWithCourses, staleTime: 5 * 60_000 });
}

export function usePracticalTemplates() {
  return useQuery({ queryKey: practicalKeys.templates(), queryFn: listPracticalTemplates });
}

export function usePracticalTemplate(id: string | undefined) {
  return useQuery({ queryKey: practicalKeys.template(id ?? ''), queryFn: () => getPracticalTemplate(id as string), enabled: Boolean(id) });
}

export function useCriteria(templateId: string | undefined) {
  return useQuery({ queryKey: practicalKeys.criteria(templateId ?? ''), queryFn: () => listCriteriaByTemplate(templateId as string), enabled: Boolean(templateId) });
}

export function useSaveTemplate() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CreatePracticalTemplateInput | UpdatePracticalTemplateInput }) =>
      id ? updatePracticalTemplate(id, input) : createPracticalTemplate(input as CreatePracticalTemplateInput),
    onSuccess: invalidate,
  });
}

export function useDeleteTemplate() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: deletePracticalTemplate, onSuccess: invalidate });
}

export function useAddCriterion() {
  return useMutation({ mutationFn: ({ templateId, count }: { templateId: string; count: number }) => addDefaultCriterion(templateId, count) });
}

/** Saved on every keystroke, as before; the form keeps its own copy of the list. */
export function useUpdateCriterion() {
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateCriteriaInput }) => updatePracticalCriteria(id, input) });
}

export function useDeleteCriterion() {
  return useMutation({ mutationFn: deletePracticalCriteria });
}

// Sessions

export function usePracticalSessions() {
  return useQuery({ queryKey: practicalKeys.sessions(), queryFn: () => listPracticalSessions() });
}

export function usePracticalSession(id: string | undefined) {
  return useQuery({ queryKey: practicalKeys.session(id ?? ''), queryFn: () => getPracticalSession(id as string), enabled: Boolean(id) });
}

export function useSessionWithTemplate(id: string | undefined) {
  return useQuery({
    queryKey: practicalKeys.sessionWithTemplate(id ?? ''),
    queryFn: () => getPracticalSessionWithTemplate(id as string),
    enabled: Boolean(id),
  });
}

/** Template title and class name of each listed session. */
export function useSessionNames(sessions: PracticalExamSession[] | undefined) {
  const ids = (sessions ?? []).map((s) => s.id).join(',');
  return useQuery({
    queryKey: practicalKeys.sessionNames(ids),
    queryFn: () => describeSessions(sessions ?? []),
    enabled: sessions !== undefined,
  });
}

export function useSaveSession() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CreatePracticalSessionInput | UpdatePracticalSessionInput }) =>
      id ? updatePracticalSession(id, input) : createPracticalSession(input as CreatePracticalSessionInput),
    onSuccess: invalidate,
  });
}

export function useDeleteSession() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: deletePracticalSession, onSuccess: invalidate });
}

export function useTtdtClassOptions() {
  return useQuery({ queryKey: practicalKeys.classes(), queryFn: listClasses });
}

// Attempts and evidence (student upload)

export function usePracticalAttempt(id: string | undefined) {
  return useQuery({ queryKey: practicalKeys.attempt(id ?? ''), queryFn: () => getPracticalAttempt(id as string), enabled: Boolean(id), retry: false });
}

export function usePhotos(attemptId: string | undefined, enabled = true) {
  return useQuery({ queryKey: practicalKeys.photos(attemptId ?? ''), queryFn: () => listPracticalPhotos(attemptId as string), enabled: Boolean(attemptId) && enabled });
}

export function useUploadPhoto(attemptId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ file, options }: { file: File; options: PhotoOptions }) => uploadPracticalPhoto(attemptId, file, options),
    onSuccess: () => client.invalidateQueries({ queryKey: practicalKeys.photos(attemptId) }),
  });
}

export function useDeletePhoto(attemptId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deletePracticalPhoto,
    onSuccess: () => client.invalidateQueries({ queryKey: practicalKeys.photos(attemptId) }),
  });
}

export function useSubmitAttempt() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: submitPracticalAttempt, onSuccess: invalidate });
}

// Results of field grading (read only)

const RESULTS_REFRESH_MS = 10_000;

/** The session's students with the state of their result, refreshed every 10 s while the page is visible. */
export function useSessionResults(sessionId: string) {
  return useQuery({
    queryKey: [...practicalKeys.all, 'results', sessionId] as const,
    queryFn: () => loadSessionResults(sessionId),
    enabled: Boolean(sessionId),
    refetchInterval: RESULTS_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}

/** One student's result; refreshed like the list so a result being graded fills in. */
export function useAttemptResult(attemptId: string | undefined) {
  return useQuery({
    queryKey: [...practicalKeys.all, 'result', attemptId ?? ''] as const,
    queryFn: () => loadAttemptResult(attemptId as string),
    enabled: Boolean(attemptId),
    refetchInterval: RESULTS_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}

// Import from a file

/** Reads the chosen file into a draft (nothing saved). */
export function useReadTemplateFile() {
  return useMutation({ mutationFn: (file: File) => readTemplateFile(file) });
}

export function useCreateTemplateFromDraft() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (args: { draft: TemplateDraft; title: string; moduleId: string | null; passScore: number }) =>
      createTemplateFromDraft(args.draft, { ...args, createdBy: null }),
    onSuccess: invalidate,
  });
}

/** Saves the Excel template to fill in. */
export function downloadExcelTemplate(): void {
  const url = URL.createObjectURL(buildExcelTemplate());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mau-de-thi-thuc-hanh.xlsx';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
