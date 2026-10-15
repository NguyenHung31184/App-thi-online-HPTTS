import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadAssignedLearning, recordLearningProgress, submitQuiz, watchLearningToken, flushAssignedProgress } from '../application/assigned-learning';
import type { RecordLearningInput } from '../domain/assigned-learning';

export const assignedLearningKey = (userId: string) => ['assigned-learning',userId] as const;
export function useAssignedLearning(userId: string, enabled=true) {
  return useQuery({queryKey:assignedLearningKey(userId),queryFn:loadAssignedLearning,enabled:Boolean(userId)&&enabled});
}
export function useRecordAssignedProgress(userId: string) {
  const client = useQueryClient();
  return useMutation({mutationFn:recordLearningProgress,onSuccess:(receipt,input) => {
    // Completion changes sequencing; resume-only updates should not refetch the entire catalog every two seconds.
    if (receipt.status==='completed' || input.confirmRead) void client.invalidateQueries({queryKey:assignedLearningKey(userId)});
  }});
}
export { watchLearningToken, flushAssignedProgress };
export type { RecordLearningInput };

/** Nộp quiz rồi tải lại danh sách: lượt làm, tiến độ và điều kiện mở bài sau đều có thể đổi. */
export function useSubmitQuiz(userId: string) {
  const client = useQueryClient();
  return useMutation({ mutationFn: submitQuiz, onSettled: () => client.invalidateQueries({ queryKey: assignedLearningKey(userId) }) });
}
