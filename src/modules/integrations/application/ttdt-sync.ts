import type { Attempt } from '../../../types';
import {
  countWaitingSyncJobs, practicalAttemptExists, selectClassNamesById, selectExamSyncLog, selectPracticalSyncLog, selectTheoryAttemptRef,
} from '../data/sync-log-repository';
import { requestSync, syncEnabled, type SyncResult } from '../data/ttdt-sync-client';
import { withClassNames, type ExamSyncLogEntry, type PracticalSyncLogEntry, type SyncStatus } from '../domain/sync-log';

export type { SyncResult };

export const isTtdtSyncConfigured = (): boolean => syncEnabled();

/** Sends a theory attempt's grade to TTDT. Only the attempt id is sent; the server looks up exam, class and student. */
export async function syncAttemptToTtdt(attempt: Pick<Attempt, 'id'>, _exam?: unknown, _options?: Record<string, unknown>): Promise<SyncResult> {
  void _exam;
  void _options;
  if (!syncEnabled()) return { success: false, message: 'Chưa bật đồng bộ TTDT.' };
  return requestSync({ source: 'theory', attempt_id: attempt.id });
}

/** Sends a practical attempt's grade to TTDT (attempt id only, as for theory). */
export async function syncPracticalAttemptToTtdt(practicalAttemptId: string, _totalScore?: number, _options?: Record<string, unknown>): Promise<SyncResult> {
  void _totalScore;
  void _options;
  if (!syncEnabled()) return { success: false, message: 'Chưa bật đồng bộ TTDT.' };
  return requestSync({ source: 'practical', attempt_id: practicalAttemptId });
}

/** Latest 500 theory sync logs, newest first, with class names. */
export async function listExamSyncLog(filters?: { status?: SyncStatus }): Promise<ExamSyncLogEntry[]> {
  const logs = await selectExamSyncLog(filters?.status);
  if (logs.length === 0) return logs;
  const classIds = [...new Set(logs.map((l) => l.class_id).filter((id): id is string => Boolean(id)))];
  return withClassNames(logs, await selectClassNamesById(classIds));
}

export function listPracticalSyncLog(filters?: { status?: SyncStatus }): Promise<PracticalSyncLogEntry[]> {
  return selectPracticalSyncLog(filters?.status);
}

/** Retries a theory sync from the log page; returns the message to show. */
export async function retryTheorySync(attemptId: string): Promise<{ success: boolean; message: string }> {
  const ref = await selectTheoryAttemptRef(attemptId);
  if (!ref.attempt) return { success: false, message: 'Không tìm thấy bài làm.' };
  if (!ref.exam) return { success: false, message: 'Không tìm thấy đề thi.' };
  const result = await syncAttemptToTtdt({ id: attemptId });
  return result.success ? { success: true, message: 'Đồng bộ thành công.' } : { success: false, message: result.message ?? 'Đồng bộ thất bại.' };
}

export async function retryPracticalSync(practicalAttemptId: string): Promise<{ success: boolean; message: string }> {
  if (!(await practicalAttemptExists(practicalAttemptId))) return { success: false, message: 'Không tìm thấy bài làm thực hành.' };
  const result = await syncPracticalAttemptToTtdt(practicalAttemptId);
  return result.success ? { success: true, message: 'Đồng bộ thành công.' } : { success: false, message: result.message ?? 'Đồng bộ thất bại.' };
}

export const waitingSyncCount = (): Promise<number> => countWaitingSyncJobs();
