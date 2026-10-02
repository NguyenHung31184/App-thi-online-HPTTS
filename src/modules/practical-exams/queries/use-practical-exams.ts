import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PracticalAttempt, PracticalExamCriteria, PracticalExamSession } from '../../../types';
import { listClasses, listModulesWithCourses } from '../../integrations/public';
import {
  deletePracticalPhoto, getPracticalAttempt, gradePracticalAttempt, listPracticalAttemptsBySession, listPracticalPhotos, listPracticalScores,
  submitPracticalAttempt, syncGradeToTtdt, ttdtSyncEnabled, uploadPracticalPhoto,
} from '../application/attempts';
import {
  createPracticalSession, deletePracticalSession, describeSessions, getPracticalSession, getPracticalSessionWithTemplate, listPracticalSessions,
  updatePracticalSession,
} from '../application/sessions';
import {
  addDefaultCriterion, createPracticalTemplate, deletePracticalCriteria, deletePracticalTemplate, getPracticalTemplate, listCriteriaByTemplate,
  listPracticalTemplates, updatePracticalCriteria, updatePracticalTemplate,
} from '../application/templates';
import type { CreatePracticalSessionInput, CreatePracticalTemplateInput, PhotoOptions, UpdateCriteriaInput, UpdatePracticalSessionInput, UpdatePracticalTemplateInput } from '../domain/inputs';
import type { PracticalSessionWithTemplate } from '../domain/sessions';

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

// Attempts, evidence and grading

export function useSessionAttempts(sessionId: string) {
  return useQuery({ queryKey: practicalKeys.attempts(sessionId), queryFn: () => listPracticalAttemptsBySession(sessionId), enabled: Boolean(sessionId) });
}

export function usePracticalAttempt(id: string | undefined) {
  return useQuery({ queryKey: practicalKeys.attempt(id ?? ''), queryFn: () => getPracticalAttempt(id as string), enabled: Boolean(id), retry: false });
}

export function usePhotos(attemptId: string | undefined, enabled = true) {
  return useQuery({ queryKey: practicalKeys.photos(attemptId ?? ''), queryFn: () => listPracticalPhotos(attemptId as string), enabled: Boolean(attemptId) && enabled });
}

export function useScores(attemptId: string | undefined) {
  return useQuery({ queryKey: practicalKeys.scores(attemptId ?? ''), queryFn: () => listPracticalScores(attemptId as string), enabled: Boolean(attemptId) });
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

export function useGradeAttempt() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (args: { attemptId: string; criteria: PracticalExamCriteria[]; scores: Record<string, number>; comments: Record<string, string>; gradedBy: string }) =>
      gradePracticalAttempt(args.attemptId, args.criteria, args.scores, args.comments, args.gradedBy),
    onSuccess: invalidate,
  });
}

export function useSyncGrade() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ attempt, session }: { attempt: PracticalAttempt; session: PracticalSessionWithTemplate }) => syncGradeToTtdt(attempt, session),
    onSuccess: (result) => { if (result.success) void invalidate(); },
  });
}

export const useTtdtSyncEnabled = (): boolean => ttdtSyncEnabled();
