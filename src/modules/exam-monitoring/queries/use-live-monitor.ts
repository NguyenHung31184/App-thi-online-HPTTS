import { useQuery } from '@tanstack/react-query';
import { fetchLiveAttempts } from '../data/live-monitor-repository';
import { groupByClass } from '../domain/live-status';

const REFRESH_MS = 15_000;

export const examMonitoringKeys = {
  live: ['exam-monitoring', 'live'] as const,
};

/** Live attempts grouped by class, refreshed every 15 s while the page is visible. */
export function useLiveExamMonitor() {
  return useQuery({
    queryKey: examMonitoringKeys.live,
    queryFn: fetchLiveAttempts,
    select: groupByClass,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}
