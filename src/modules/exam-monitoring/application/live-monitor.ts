import { fetchLiveAttempts, fetchSignalEvents } from '../data/live-monitor-repository';
import { tallySignals, type LiveAttemptRow } from '../domain/live-status';

/**
 * Attempts of the windows open now or closed under 30 minutes ago (the RPC checks the exam role), with the signals
 * of each attempt counted per group. If the count cannot be loaded the rows keep the RPC total only.
 */
export async function loadLiveAttempts(): Promise<LiveAttemptRow[]> {
  const rows = await fetchLiveAttempts();
  const flagged = rows.filter((row) => row.violations > 0).map((row) => row.attemptId);
  if (flagged.length === 0) return rows;
  try {
    const tally = tallySignals(await fetchSignalEvents(flagged));
    return rows.map((row) => ({ ...row, signalCounts: tally.get(row.attemptId) ?? null }));
  } catch {
    return rows;
  }
}
