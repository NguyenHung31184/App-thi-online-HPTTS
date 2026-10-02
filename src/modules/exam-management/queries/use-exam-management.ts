import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listClasses, listModulesWithCourses } from '../../integrations/public';
import { countDrawableQuestions } from '../../question-bank/public';
import { getQuestionDrawFrequency, listQuestionsByModule } from '../application/bank-check';
import { createExam, deleteExam, getExam, listExams, lockExam, unlockExam, updateExam } from '../application/manage-exams';
import {
  countAttemptsForWindow, createExamWindow, deleteAllTrialAttempts, deleteExamWindow, getExamWindow, listExamWindows, updateExamWindow,
} from '../application/manage-windows';
import type { CreateExamInput, CreateExamWindowInput, UpdateExamInput, UpdateExamWindowInput } from '../domain/exam-inputs';

export const examManagementKeys = {
  all: ['exam-management'] as const,
  exams: () => [...examManagementKeys.all, 'exams'] as const,
  exam: (id: string) => [...examManagementKeys.all, 'exam', id] as const,
  drawable: (moduleId: string) => [...examManagementKeys.all, 'drawable', moduleId] as const,
  windows: () => [...examManagementKeys.all, 'windows'] as const,
  window: (id: string) => [...examManagementKeys.all, 'window', id] as const,
  windowAttempts: (id: string) => [...examManagementKeys.all, 'window-attempts', id] as const,
  moduleQuestions: (moduleId: string) => [...examManagementKeys.all, 'module-questions', moduleId] as const,
  drawFrequency: (examId: string) => [...examManagementKeys.all, 'draw-frequency', examId] as const,
  classes: () => [...examManagementKeys.all, 'classes'] as const,
  modules: () => [...examManagementKeys.all, 'modules'] as const,
};

// Exams

export function useExams() {
  return useQuery({ queryKey: examManagementKeys.exams(), queryFn: listExams });
}

export function useExam(id: string | undefined) {
  return useQuery({ queryKey: examManagementKeys.exam(id ?? ''), queryFn: () => getExam(id as string), enabled: Boolean(id) });
}

/** Loads an exam on demand (forms that copy it into their own state), through the query cache. */
export function useFetchExam() {
  const client = useQueryClient();
  return (id: string) => client.fetchQuery({ queryKey: examManagementKeys.exam(id), queryFn: () => getExam(id) });
}

/** Loads a window on demand (the window form copies it into its own state), through the query cache. */
export function useFetchExamWindow() {
  const client = useQueryClient();
  return (id: string) => client.fetchQuery({ queryKey: examManagementKeys.window(id), queryFn: () => getExamWindow(id) });
}

/** Questions the exam's module can draw (same pool as start_exam_attempt). */
export function useDrawableQuestionCount(moduleId: string | null | undefined) {
  return useQuery({
    queryKey: examManagementKeys.drawable(moduleId ?? ''),
    queryFn: () => countDrawableQuestions(moduleId as string),
    enabled: Boolean(moduleId),
  });
}

function useInvalidateExams() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: examManagementKeys.all });
}

export function useCreateExam() {
  const invalidate = useInvalidateExams();
  return useMutation({ mutationFn: (input: CreateExamInput) => createExam(input), onSuccess: invalidate });
}

export function useUpdateExam() {
  const invalidate = useInvalidateExams();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateExamInput }) => updateExam(id, input), onSuccess: invalidate });
}

export function useDeleteExam() {
  const invalidate = useInvalidateExams();
  return useMutation({ mutationFn: (id: string) => deleteExam(id), onSuccess: invalidate });
}

export function useLockExam() {
  const invalidate = useInvalidateExams();
  return useMutation({ mutationFn: (id: string) => lockExam(id), onSuccess: invalidate });
}

export function useUnlockExam() {
  const invalidate = useInvalidateExams();
  return useMutation({ mutationFn: (id: string) => unlockExam(id), onSuccess: invalidate });
}

// Windows

export function useExamWindows() {
  return useQuery({ queryKey: examManagementKeys.windows(), queryFn: () => listExamWindows() });
}

export function useExamWindow(id: string | undefined) {
  return useQuery({ queryKey: examManagementKeys.window(id ?? ''), queryFn: () => getExamWindow(id as string), enabled: Boolean(id) });
}

export function useWindowAttemptCount(id: string | undefined) {
  return useQuery({ queryKey: examManagementKeys.windowAttempts(id ?? ''), queryFn: () => countAttemptsForWindow(id as string), enabled: Boolean(id) });
}

export function useCreateExamWindow() {
  const invalidate = useInvalidateExams();
  return useMutation({ mutationFn: (input: CreateExamWindowInput) => createExamWindow(input), onSuccess: invalidate });
}

export function useUpdateExamWindow() {
  const invalidate = useInvalidateExams();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: UpdateExamWindowInput }) => updateExamWindow(id, input), onSuccess: invalidate });
}

export function useDeleteExamWindow() {
  const invalidate = useInvalidateExams();
  return useMutation({ mutationFn: (id: string) => deleteExamWindow(id), onSuccess: invalidate });
}

export function useDeleteAllTrialAttempts() {
  const invalidate = useInvalidateExams();
  return useMutation({ mutationFn: () => deleteAllTrialAttempts(), onSuccess: invalidate });
}

// Bank check page

export function useModuleQuestions(moduleId: string | null | undefined) {
  return useQuery({
    queryKey: examManagementKeys.moduleQuestions(moduleId ?? ''),
    queryFn: () => listQuestionsByModule(moduleId as string),
    enabled: Boolean(moduleId),
  });
}

export function useDrawFrequency(examId: string | undefined) {
  return useQuery({ queryKey: examManagementKeys.drawFrequency(examId ?? ''), queryFn: () => getQuestionDrawFrequency(examId as string), enabled: Boolean(examId) });
}

// TTDT directory used by the forms

export function useTtdtClasses() {
  return useQuery({ queryKey: examManagementKeys.classes(), queryFn: listClasses });
}

export function useTtdtModulesWithCourses() {
  return useQuery({ queryKey: examManagementKeys.modules(), queryFn: listModulesWithCourses });
}
