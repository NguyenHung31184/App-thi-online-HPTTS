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

/** Rules run every 2.5 seconds. They require persistence and a clean recovery before another incident. */
export const AI_DETECTION_RULES: Record<AiViolationKind, DetectionRule> = {
  ai_no_face: { windowScans: 6, requiredHits: 6, recoveryScans: 3 },
  ai_multiple_face: { windowScans: 2, requiredHits: 2, recoveryScans: 3 },
  ai_cell_phone: { windowScans: 5, requiredHits: 3, recoveryScans: 3 },
  ai_prohibited_object: { windowScans: 6, requiredHits: 4, recoveryScans: 3 },
};

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
