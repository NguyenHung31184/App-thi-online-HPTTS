import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadAssignedLearning, recordLearningProgress, watchLearningToken, flushAssignedProgress } from '../application/assigned-learning';
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
