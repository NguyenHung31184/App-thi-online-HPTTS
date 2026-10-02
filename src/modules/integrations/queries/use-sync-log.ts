import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isTtdtSyncConfigured, listExamSyncLog, waitingSyncCount, listPracticalSyncLog, retryPracticalSync, retryTheorySync,
} from '../application/ttdt-sync';
import type { SyncStatus } from '../domain/sync-log';

export const syncLogKeys = {
  all: ['integrations', 'sync-log'] as const,
  theory: (status?: SyncStatus) => [...syncLogKeys.all, 'theory', status ?? 'all'] as const,
  practical: (status?: SyncStatus) => [...syncLogKeys.all, 'practical', status ?? 'all'] as const,
  waiting: () => [...syncLogKeys.all, 'waiting'] as const,
};

/** Grades still waiting for TTDT; checked every minute, like the worker runs. */
export function useWaitingSyncCount(enabled: boolean) {
  return useQuery({ queryKey: syncLogKeys.waiting(), queryFn: waitingSyncCount, enabled, refetchInterval: 60_000 });
}

export const useTtdtSyncConfigured = (): boolean => isTtdtSyncConfigured();

/** Logs of the open tab only, read fresh each time the tab or filter changes. */
export function useTheorySyncLog(status: SyncStatus | undefined, enabled: boolean) {
  return useQuery({ queryKey: syncLogKeys.theory(status), queryFn: () => listExamSyncLog(status ? { status } : undefined), enabled, staleTime: 0 });
}

export function usePracticalSyncLog(status: SyncStatus | undefined, enabled: boolean) {
  return useQuery({ queryKey: syncLogKeys.practical(status), queryFn: () => listPracticalSyncLog(status ? { status } : undefined), enabled, staleTime: 0 });
}

function useInvalidateLogs() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: syncLogKeys.all });
}

export function useRetrySync() {
  const invalidate = useInvalidateLogs();
  return useMutation({
    mutationFn: ({ source, attemptId }: { source: 'theory' | 'practical'; attemptId: string }) =>
      source === 'theory' ? retryTheorySync(attemptId) : retryPracticalSync(attemptId),
    onSuccess: (result) => { if (result.success) void invalidate(); },
  });
}
