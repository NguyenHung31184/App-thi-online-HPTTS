export type ProctoringMode = 'standard' | 'strict' | 'supervised';

export type AiViolationKind =
  | 'ai_no_face'
  | 'ai_multiple_face'
  | 'ai_cell_phone'
  | 'ai_prohibited_object';

export interface DetectionRule {
  windowScans: number;
  requiredHits: number;
  recoveryScans: number;
  /** While the violation goes on without a clean recovery, record it again each time this much time has passed. */
  repeatAfterMs?: number;
}

export interface DetectionWindowState {
  samples: boolean[];
  armed: boolean;
  recoveryCount: number;
  /** When the lock was taken or last repeated; set on the first locked scan after a reload. */
  lockedAt?: number;
}

export interface DetectionWindowResult {
  state: DetectionWindowState;
  confirmed: boolean;
  /** The confirmation is a repeat of an incident that never cleared, not a new window. */
  repeated?: boolean;
}

export const DEFAULT_AI_RISK_THRESHOLD = 6;

/** Only deliberate page-leave signals can automatically submit an attempt. */
export const MAX_MAIN_VIOLATIONS = 5;

/** Browsers often emit blur, visibility and fullscreen events for one physical action. */
export const LEAVE_EVENT_BUNDLE_MS = 3_000;

/** Faces are scanned every second; the heavier object model keeps its own, slower interval. */
export const FACE_SCAN_INTERVAL_MS = 1_000;

/**
 * Rules count scans: one second each for faces, 2.5 seconds each for objects. They require persistence and a clean
 * recovery before another incident. No-face allows one detected scan in five, so a hand that leaves a face visible
 * for a moment does not restart the count. The face rules recover slowly: a second person who is missed for a few
 * scans while still standing there, or a face that shows for a moment, is the same incident and not a new one.
 * A second person who simply stays is recorded again every 30 seconds, so ignoring the warning is not the cheaper choice.
 */
export const AI_DETECTION_RULES: Record<AiViolationKind, DetectionRule> = {
  ai_no_face: { windowScans: 5, requiredHits: 4, recoveryScans: 5 },
  ai_multiple_face: { windowScans: 3, requiredHits: 3, recoveryScans: 5, repeatAfterMs: 30_000 },
  ai_cell_phone: { windowScans: 5, requiredHits: 3, recoveryScans: 3 },
  ai_prohibited_object: { windowScans: 6, requiredHits: 4, recoveryScans: 3 },
};

/**
 * A covered lens is unambiguous, so three face scans in a row are enough. Recorded as ai_no_face and held by the
 * no-face lock: it cannot confirm again until a face has been seen for the no-face recovery scans.
 */
export const CAMERA_COVERED_RULE: DetectionRule = { windowScans: 3, requiredHits: 3, recoveryScans: 3 };

const COVERED_MAX_BRIGHTNESS = 35;
const COVERED_MAX_CONTRAST = 10;

/**
 * True when a frame is nearly black or nearly one flat colour: a hand, a finger or an object on the lens.
 * `rgba` is canvas pixel data (4 bytes per pixel) of a small copy of the frame.
 */
export function frameLooksCovered(rgba: ArrayLike<number>): boolean {
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return false;
  let sum = 0;
  let sumSquares = 0;
  for (let i = 0; i < pixels; i += 1) {
    const luma = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    sum += luma;
    sumSquares += luma * luma;
  }
  const mean = sum / pixels;
  const contrast = Math.sqrt(Math.max(0, sumSquares / pixels - mean * mean));
  return mean < COVERED_MAX_BRIGHTNESS || contrast < COVERED_MAX_CONTRAST;
}

export const AI_RISK_WEIGHTS: Record<AiViolationKind, number> = {
  ai_no_face: 1,
  ai_multiple_face: 2,
  ai_cell_phone: 3,
  ai_prohibited_object: 2,
};

export function createDetectionWindowState(): DetectionWindowState {
  return { samples: [], armed: true, recoveryCount: 0 };
}

/** The state right after an incident: nothing confirms until the rule's clean recovery scans have passed. */
export function lockedDetectionWindowState(): DetectionWindowState {
  return { samples: [], armed: false, recoveryCount: 0 };
}

export const AI_VIOLATION_KINDS: readonly AiViolationKind[] = [
  'ai_no_face', 'ai_multiple_face', 'ai_cell_phone', 'ai_prohibited_object',
];

/** Fresh windows for every kind, with the given kinds starting locked. */
export function createDetectionStates(
  locked: readonly AiViolationKind[] = [],
): Record<AiViolationKind, DetectionWindowState> {
  const states = {} as Record<AiViolationKind, DetectionWindowState>;
  for (const kind of AI_VIOLATION_KINDS) {
    states[kind] = locked.includes(kind) ? lockedDetectionWindowState() : createDetectionWindowState();
  }
  return states;
}

export function lockedDetectionKinds(states: Record<AiViolationKind, DetectionWindowState>): AiViolationKind[] {
  return AI_VIOLATION_KINDS.filter((kind) => !states[kind].armed);
}

/**
 * Confirms one incident, then disarms until enough clean scans occur. A rule with `repeatAfterMs` confirms again
 * while disarmed, each time that long has passed and the violation is still seen. `now` is in milliseconds.
 */
export function advanceDetectionWindow(
  current: DetectionWindowState,
  detected: boolean,
  rule: DetectionRule,
  now = 0,
): DetectionWindowResult {
  if (!current.armed) {
    const recoveryCount = detected ? 0 : current.recoveryCount + 1;
    if (recoveryCount >= rule.recoveryScans) return { confirmed: false, state: createDetectionWindowState() };
    const lockedAt = current.lockedAt ?? now;
    const repeated = detected && rule.repeatAfterMs !== undefined && now - lockedAt >= rule.repeatAfterMs;
    return {
      confirmed: repeated,
      repeated,
      state: { samples: [], armed: false, recoveryCount, lockedAt: repeated ? now : lockedAt },
    };
  }

  const samples = [...current.samples, detected].slice(-rule.windowScans);
  const hits = samples.reduce((count, hit) => count + (hit ? 1 : 0), 0);
  const confirmed = samples.length === rule.windowScans && hits >= rule.requiredHits;
  return {
    confirmed,
    state: confirmed
      ? { ...lockedDetectionWindowState(), lockedAt: now }
      : { samples, armed: true, recoveryCount: 0 },
  };
}

export function canRecordLeaveViolation(lastRecordedAt: number, now: number): boolean {
  return now - lastRecordedAt >= LEAVE_EVENT_BUNDLE_MS;
}

export function aiRiskPoints(kind: AiViolationKind): number {
  return AI_RISK_WEIGHTS[kind];
}

export function shouldAutoSubmitForAi(
  mode: ProctoringMode,
  riskScore: number,
  incidentCount: number,
  threshold = DEFAULT_AI_RISK_THRESHOLD,
): boolean {
  return mode === 'strict' && riskScore >= threshold && incidentCount >= 2;
}
