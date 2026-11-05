import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmRegulationRead, getMyRegulationStatus } from '../application/manage-regulation';
import { regulationKeys } from './keys';

export function useMyRegulationStatus(enabled: boolean) {
  return useQuery({
    queryKey: regulationKeys.myStatus(),
    queryFn: getMyRegulationStatus,
    enabled,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useAcknowledgeRegulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (version: string) => confirmRegulationRead(version),
    onSettled: () => queryClient.invalidateQueries({ queryKey: regulationKeys.myStatus() }),
  });
}
