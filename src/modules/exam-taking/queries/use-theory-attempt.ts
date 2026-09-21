import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAvailableTheoryWindows, startTheoryAttempt } from '../application/manage-theory-attempt';
import { examTakingKeys } from './keys';

export function useAvailableTheoryWindows() {
  return useQuery({ queryKey: examTakingKeys.availableWindows(), queryFn: listAvailableTheoryWindows });
}

export function useStartTheoryAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ windowId, accessCode }: { windowId: string; accessCode: string }) =>
      startTheoryAttempt(windowId, accessCode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: examTakingKeys.availableWindows() }),
  });
}
