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
}

export interface DetectionWindowState {
  samples: boolean[];
  armed: boolean;
  recoveryCount: number;
}

export interface DetectionWindowResult {
  state: DetectionWindowState;
  confirmed: boolean;
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
 * for a moment does not restart the count.
 */
export const AI_DETECTION_RULES: Record<AiViolationKind, DetectionRule> = {
  ai_no_face: { windowScans: 5, requiredHits: 4, recoveryScans: 3 },
  ai_multiple_face: { windowScans: 3, requiredHits: 3, recoveryScans: 3 },
  ai_cell_phone: { windowScans: 5, requiredHits: 3, recoveryScans: 3 },
  ai_prohibited_object: { windowScans: 6, requiredHits: 4, recoveryScans: 3 },
};

/** A covered lens is unambiguous, so three face scans in a row are enough. Recorded as ai_no_face. */
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

/** Confirms one incident, then disarms until enough clean scans occur. */
export function advanceDetectionWindow(
  current: DetectionWindowState,
  detected: boolean,
  rule: DetectionRule,
): DetectionWindowResult {
  if (!current.armed) {
    const recoveryCount = detected ? 0 : current.recoveryCount + 1;
    const recovered = recoveryCount >= rule.recoveryScans;
    return {
      confirmed: false,
      state: recovered
        ? createDetectionWindowState()
        : { samples: [], armed: false, recoveryCount },
    };
  }

  const samples = [...current.samples, detected].slice(-rule.windowScans);
  const hits = samples.reduce((count, hit) => count + (hit ? 1 : 0), 0);
  const confirmed = samples.length === rule.windowScans && hits >= rule.requiredHits;
  return {
    confirmed,
    state: confirmed
      ? { samples: [], armed: false, recoveryCount: 0 }
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
