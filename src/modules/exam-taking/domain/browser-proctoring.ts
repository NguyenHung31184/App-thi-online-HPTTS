export type BrowserViolationKind = 'focus_lost' | 'visibility_hidden' | 'fullscreen_exited';
export interface BrowserProctoringState {
  violation_count: number;
  violation_limit: number;
  should_auto_submit: boolean;
  attempt_completed: boolean;
}
export interface BrowserViolationResult extends BrowserProctoringState {
  audit_id: string | null;
  accepted: boolean;
}
