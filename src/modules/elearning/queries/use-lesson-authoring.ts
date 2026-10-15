import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listModulesWithCourses } from '../../integrations/public';
import {
  createLesson, loadLessonAssignments, loadLessonCatalog, loadLessonDraft, moveBlock, moveLesson, publishLesson, removeBlock,
  removeLesson, saveBlock, saveLessonDetails, submitAssignment, withdrawAssignment,
  addQuizQuestion, removeQuizItem, searchBankQuestions,
} from '../application/manage-lessons';
import type { QuizItemRow } from '../domain/quiz';
import type { AssignmentForm, BlockForm, LessonBlockRow, LessonRow, LessonVersion } from '../domain/lesson-authoring';

const root = ['elearning-authoring'] as const;
export const authoringKeys = {
  root,
  modules: () => [...root, 'modules'] as const,
  catalog: (moduleId: string) => [...root, 'catalog', moduleId] as const,
  draft: (lessonId: string) => [...root, 'draft', lessonId] as const,
  assignments: (lessonId: string) => [...root, 'assignments', lessonId] as const,
};

export function useLearningModules() {
  return useQuery({ queryKey: authoringKeys.modules(), queryFn: listModulesWithCourses });
}

export function useLessonCatalog(moduleId: string) {
  return useQuery({ queryKey: authoringKeys.catalog(moduleId), queryFn: () => loadLessonCatalog(moduleId), enabled: Boolean(moduleId) });
}

export function useLessonDraft(lessonId: string) {
  return useQuery({ queryKey: authoringKeys.draft(lessonId), queryFn: () => loadLessonDraft(lessonId), enabled: Boolean(lessonId) });
}

export function useLessonAssignments(lesson: LessonRow | null, versions: LessonVersion[]) {
  return useQuery({
    // Versions are part of the key: a new publication changes which version an entry can name.
    queryKey: [...authoringKeys.assignments(lesson?.id ?? ''), versions.length],
    queryFn: () => loadLessonAssignments(lesson!, versions),
    enabled: Boolean(lesson),
  });
}

/** Every change to a lesson can alter its list row, its draft and its assignments, so all three are refreshed. */
function useRefresh() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: authoringKeys.root });
}

export function useCreateLesson(moduleId: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ title, siblings }: { title: string; siblings: LessonRow[] }) => createLesson(moduleId, title, siblings),
    onSuccess: refresh,
  });
}

export function useRemoveLesson() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: removeLesson, onSuccess: refresh });
}

export function useMoveLesson() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ lessons, lessonId, direction }: { lessons: LessonRow[]; lessonId: string; direction: -1 | 1 }) =>
      moveLesson(lessons, lessonId, direction),
    onSuccess: refresh,
  });
}

export function useSaveLessonDetails(lessonId: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ title, description }: { title: string; description: string }) => saveLessonDetails(lessonId, title, description),
    onSuccess: refresh,
  });
}

export function useSaveBlock(lessonId: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ form, blocks, editingId }: { form: BlockForm; blocks: LessonBlockRow[]; editingId: string | null }) =>
      saveBlock(lessonId, form, blocks, editingId),
    onSuccess: refresh,
  });
}

export function useRemoveBlock() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: removeBlock, onSuccess: refresh });
}

export function useMoveBlock() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ blocks, blockId, direction }: { blocks: LessonBlockRow[]; blockId: string; direction: -1 | 1 }) =>
      moveBlock(blocks, blockId, direction),
    onSuccess: refresh,
  });
}

export function usePublishLesson() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: publishLesson, onSuccess: refresh });
}

export function useSubmitAssignment() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (form: AssignmentForm) => submitAssignment(form), onSuccess: refresh });
}

export function useWithdrawAssignment() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: withdrawAssignment, onSuccess: refresh });
}

export function useBankQuestionSearch(moduleId: string, text: string) {
  return useQuery({
    queryKey: [...root, 'bank-search', moduleId, text.trim()],
    queryFn: () => searchBankQuestions(moduleId, text),
    enabled: Boolean(moduleId),
    staleTime: 30_000,
  });
}

export function useAddQuizQuestion() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ blockId, questionId, items }: { blockId: string; questionId: string; items: QuizItemRow[] }) => addQuizQuestion(blockId, questionId, items),
    onSuccess: refresh,
  });
}

export function useRemoveQuizQuestion() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: removeQuizItem, onSuccess: refresh });
}
