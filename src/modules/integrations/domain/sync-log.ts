export type SyncStatus = 'success' | 'failed';

export interface ExamSyncLogEntry {
  id: string;
  attempt_id: string;
  enrollment_id: string | null;
  module_id: string | null;
  payload: unknown;
  status: SyncStatus;
  response: string | null;
  created_at: string;
  // Snapshot taken when the log was written, so no join through RLS is needed.
  exam_title?: string | null;
  window_id?: string | null;
  class_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  /** Looked up after reading. */
  class_name?: string;
}

export interface PracticalSyncLogEntry {
  id: string;
  practical_attempt_id: string;
  enrollment_id: string | null;
  module_id: string | null;
  payload: unknown;
  status: SyncStatus;
  response: string | null;
  created_at: string;
}

/** Adds the class name, or the class id when the name is unknown. */
export function withClassNames(logs: ExamSyncLogEntry[], names: Map<string, string>): ExamSyncLogEntry[] {
  return logs.map((l) => ({ ...l, class_name: l.class_id ? (names.get(l.class_id) ?? l.class_id) : '' }));
}

export function failedCounts(theory: { status: SyncStatus }[], practical: { status: SyncStatus }[]) {
  return {
    theoryTotal: theory.length,
    theoryFailed: theory.filter((x) => x.status === 'failed').length,
    practicalTotal: practical.length,
    practicalFailed: practical.filter((x) => x.status === 'failed').length,
  };
}
