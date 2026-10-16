import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { loadAccessFailures, unlockStudentAccess } from '../application/access-locks';

const REFRESH_MS = 15_000;
const accessLockKey = ['exam-monitoring', 'access-locks'] as const;

/** Students entering wrong access codes, refreshed with the live board every 15 s while the page is visible. */
export function useAccessFailures() {
  return useQuery({ queryKey: accessLockKey, queryFn: loadAccessFailures, refetchInterval: REFRESH_MS, refetchIntervalInBackground: false });
}

export function useUnlockAccess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { windowId: string; userId: string }) => unlockStudentAccess(input.windowId, input.userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accessLockKey }),
  });
}
