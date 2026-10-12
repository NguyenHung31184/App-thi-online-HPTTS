export type EvidenceKind =
  | 'focus_lost'
  | 'visibility_hidden'
  | 'fullscreen_exited'
  | 'ai_cell_phone'
  | 'ai_prohibited_object'
  | 'ai_no_face'
  | 'ai_multiple_face';

export interface CaptureEvidenceResult {
  ok: boolean;
  path?: string;
  publicUrl?: string;
  evidence?: { phase: string; path?: string; publicUrl?: string }[];
  error?: string;
}

export interface ProctoringEvidenceCaptureRef {
  captureAndUpload: (kind: EvidenceKind, opts?: { toastOnceKey?: string }) => Promise<CaptureEvidenceResult>;
  captureSequenceAndUpload: (kind: EvidenceKind, opts?: { toastOnceKey?: string }) => Promise<CaptureEvidenceResult>;
  /** Trả về video element nội bộ để AiObjectProctorBurst tái dụng, tránh mở 2 luồng camera */
  getVideoElement: () => HTMLVideoElement | null;
}

export interface AiDetectionDetails {
  confidence?: number;
  bboxRatio?: number;
  observedScans: number;
  requiredHits: number;
  windowScans: number;
  durationMs: number;
}

