import type { AuditEvent } from '../../../types';

export interface AttemptReportRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  exam_id: string;
  exam_title: string;
  window_id: string;
  class_id: string;
  class_name: string;
  score: number | null;
  raw_score: number | null;
  passed: boolean;
  disqualified: boolean;
  completed_at: string | null;
  synced_to_ttdt_at: string | null;
}

export interface EvidenceFrame {
  phase: string;
  publicUrl: string;
}

export type ReviewStatus = 'pending' | 'confirmed' | 'rejected' | 'unreviewed' | '';

export interface ViolationReportRow {
  id: string;
  attempt_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  exam_id: string;
  exam_title: string;
  window_id: string;
  class_id: string;
  class_name: string;
  event: AuditEvent;
  created_at: string;
  metadata: Record<string, unknown> | null;
  risk_points: number;
  review_status: ReviewStatus;
  evidence_url: string;
  evidence: EvidenceFrame[];
}

/** An exam includes the windows that list it among several exams, so either id narrows the report. */
export interface ReportFilters {
  exam_id?: string;
  window_id?: string;
}

/** Signals of one attempt counted per kind; the AI score skips incidents reviewed as false detections. */
export interface ViolationSummaryRow {
  id: string;
  attempt_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  focusLostCount: number;
  visibilityHiddenCount: number;
  fullscreenExitedCount: number;
  copyPasteBlockedCount: number;
  photoTakenCount: number;
  aiNoFaceCount: number;
  aiMultipleFaceCount: number;
  aiCellPhoneCount: number;
  aiProhibitedObjectCount: number;
  aiRiskScore: number;
}

export interface ProfileInfo {
  name: string;
  email: string;
  student_id?: string;
}

export interface StudentInfo {
  name: string;
  code?: string;
}

/** Name lookups for the people and classes of a report. */
export interface ReportDirectory {
  profiles: Map<string, ProfileInfo>;
  classNames: Map<string, string>;
  studentsById: Map<string, StudentInfo>;
  studentsByExamEmail: Map<string, StudentInfo>;
}

export const DEFAULT_PASS_THRESHOLD = 0.7;

/** Only machine-confirmed AI signals carry risk points. */
export function aiRiskPoints(event: string, metadata: Record<string, unknown> | null | undefined): number {
  if (metadata?.machine_confirmed !== true && metadata?.machine_confirmed !== 'true') return 0;
  if (event === 'ai_no_face') return 1;
  if (event === 'ai_multiple_face') return 2;
  if (event === 'ai_cell_phone') return 3;
  if (event === 'ai_prohibited_object') return 2;
  return 0;
}

export function isPassed(score: number | null, disqualified: boolean | null | undefined, threshold: number): boolean {
  return score != null && !disqualified && score >= threshold;
}

/** Student ids and exam emails to look up for the given profiles. */
export function studentKeysOf(profiles: Map<string, ProfileInfo>): { studentIds: string[]; emails: string[] } {
  const all = Array.from(profiles.values());
  return {
    studentIds: [...new Set(all.map((p) => p.student_id).filter(Boolean))] as string[],
    emails: [...new Set(all.map((p) => p.email).filter(Boolean))] as string[],
  };
}

/** TTDT student name by student id, then by exam email, then the profile. */
export function studentDisplayName(profile: ProfileInfo | undefined, directory: ReportDirectory): string {
  const byId = profile?.student_id ? directory.studentsById.get(profile.student_id) : undefined;
  const byEmail = profile?.email ? directory.studentsByExamEmail.get(profile.email) : undefined;
  return byId?.name || byEmail?.name || profile?.name || profile?.email || '';
}

export function classNameOf(classId: string, directory: ReportDirectory): string {
  return (directory.classNames.get(classId) ?? classId) || '';
}

/** Storage paths of the evidence images an audit log refers to. */
export function evidencePathsOf(metadata: Record<string, unknown> | null | undefined): string[] {
  const paths: string[] = [];
  if (typeof metadata?.evidence_path === 'string') paths.push(metadata.evidence_path);
  if (Array.isArray(metadata?.evidence)) {
    for (const item of metadata.evidence) {
      if (!item || typeof item !== 'object') continue;
      const path = (item as Record<string, unknown>).path;
      if (typeof path === 'string') paths.push(path);
    }
  }
  return paths;
}

/** The single evidence image: a fresh signed URL for a stored path, else the URL saved in the log. */
export function evidenceUrlOf(metadata: Record<string, unknown> | null | undefined, signed: Map<string, string>): string {
  if (typeof metadata?.evidence_path === 'string') return signed.get(metadata.evidence_path) ?? '';
  return typeof metadata?.evidence_url === 'string' ? metadata.evidence_url : '';
}

/** Before, during and after frames of an AI incident, each with a fresh signed URL when the path is known. */
export function evidenceFramesOf(metadata: Record<string, unknown> | null | undefined, signed: Map<string, string>): EvidenceFrame[] {
  if (!Array.isArray(metadata?.evidence)) return [];
  return metadata.evidence.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const frame = item as Record<string, unknown>;
    const path = typeof frame.path === 'string' ? frame.path : '';
    const publicUrl = (path ? signed.get(path) : undefined) ?? (typeof frame.publicUrl === 'string' ? frame.publicUrl : '');
    if (!publicUrl) return [];
    return [{ phase: typeof frame.phase === 'string' ? frame.phase : 'frame', publicUrl }];
  });
}

export function reviewStatusOf(metadata: Record<string, unknown> | null | undefined): ReviewStatus {
  return typeof metadata?.review_status === 'string' ? (metadata.review_status as ReviewStatus) : '';
}

const COUNTERS: Partial<Record<string, keyof ViolationSummaryRow>> = {
  focus_lost: 'focusLostCount',
  visibility_hidden: 'visibilityHiddenCount',
  fullscreen_exited: 'fullscreenExitedCount',
  copy_paste_blocked: 'copyPasteBlockedCount',
  photo_taken: 'photoTakenCount',
  ai_no_face: 'aiNoFaceCount',
  ai_multiple_face: 'aiMultipleFaceCount',
  ai_cell_phone: 'aiCellPhoneCount',
  ai_prohibited_object: 'aiProhibitedObjectCount',
};

/** One row per attempt, in the order the attempts first appear. */
export function summarizeViolations(rows: ViolationReportRow[]): ViolationSummaryRow[] {
  const byAttempt = new Map<string, ViolationSummaryRow>();
  for (const r of rows) {
    const key = r.attempt_id;
    if (!key) continue;
    let row = byAttempt.get(key);
    if (!row) {
      row = {
        id: key, attempt_id: r.attempt_id, user_id: r.user_id, user_name: r.user_name, user_email: r.user_email,
        focusLostCount: 0, visibilityHiddenCount: 0, fullscreenExitedCount: 0, copyPasteBlockedCount: 0, photoTakenCount: 0,
        aiNoFaceCount: 0, aiMultipleFaceCount: 0, aiCellPhoneCount: 0, aiProhibitedObjectCount: 0, aiRiskScore: 0,
      };
      byAttempt.set(key, row);
    }
    const counter = COUNTERS[r.event];
    if (counter) (row[counter] as number) += 1;
    if (r.event.startsWith('ai_') && r.review_status !== 'rejected') row.aiRiskScore += r.risk_points;
  }
  return Array.from(byAttempt.values());
}

const includesQuery = (value: string | null | undefined, query: string) => (value?.toLowerCase() ?? '').includes(query);

export function searchViolationSummaries(rows: ViolationSummaryRow[], search: string): ViolationSummaryRow[] {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((row) => includesQuery(row.user_name, query) || includesQuery(row.user_email, query));
}

export function searchResultRows(rows: AttemptReportRow[], search: string): AttemptReportRow[] {
  const query = search.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter((r) =>
    includesQuery(r.user_name, query) ||
    includesQuery(r.user_email, query) ||
    includesQuery(r.exam_title, query) ||
    (r.class_name || r.class_id || '').toLowerCase().includes(query) ||
    r.id.toLowerCase().includes(query),
  );
}

export type SheetCell = string | number;

/** "Kết quả thi" sheet: header row then one row per attempt. */
export function resultSheetRows(rows: AttemptReportRow[]): SheetCell[][] {
  return [
    ['Mã bài làm', 'Họ tên', 'Email', 'Đề thi', 'Kỳ / Lớp', 'Điểm', 'Đạt', 'Hoàn thành', 'Đồng bộ TTDT'],
    ...rows.map((r) => [
      r.id,
      r.user_name,
      r.user_email,
      r.exam_title,
      `${r.window_id} / ${r.class_name || r.class_id}`,
      r.score != null ? `${(r.score * 100).toFixed(1)}%${r.raw_score != null ? ` (${r.raw_score})` : ''}` : '',
      r.disqualified ? 'Loại' : r.passed ? 'Đạt' : 'Chưa đạt',
      r.completed_at ?? '',
      r.synced_to_ttdt_at ? 'Có' : 'Chưa',
    ]),
  ];
}

/** "Vi pham" sheet: header row then one row per attempt. */
export function violationSheetRows(rows: ViolationSummaryRow[]): SheetCell[][] {
  return [
    [
      'Lượt thi', 'Họ tên', 'Email', 'Mất focus', 'Ẩn tab / thu nhỏ', 'Thoát fullscreen', 'Copy/Paste bị chặn',
      'Ảnh webcam', 'Không thấy mặt', 'Nhiều khuôn mặt', 'Điện thoại', 'Sách / vật cấm', 'Điểm AI',
    ],
    ...rows.map((r) => [
      r.attempt_id, r.user_name, r.user_email, r.focusLostCount, r.visibilityHiddenCount, r.fullscreenExitedCount,
      r.copyPasteBlockedCount, r.photoTakenCount, r.aiNoFaceCount, r.aiMultipleFaceCount, r.aiCellPhoneCount,
      r.aiProhibitedObjectCount, r.aiRiskScore,
    ]),
  ];
}
