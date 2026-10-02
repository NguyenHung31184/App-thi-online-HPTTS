import { fetchLiveAttempts } from '../data/live-monitor-repository';
import type { LiveAttemptRow } from '../domain/live-status';

/** Attempts of the windows open now or closed under 30 minutes ago (the RPC checks the exam role). */
export function loadLiveAttempts(): Promise<LiveAttemptRow[]> {
  return fetchLiveAttempts();
}
