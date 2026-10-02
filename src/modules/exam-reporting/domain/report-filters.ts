import type { ExamWindow } from '../../../types';

export type TrialFilter = 'all' | 'real' | 'trial';

export interface ClassLabelInfo {
  name: string;
  code?: string;
}

/** Classes that have at least one window, labelled "name (code)" and sorted in Vietnamese order. */
export function classesWithWindows(windows: ExamWindow[], classNames: Record<string, ClassLabelInfo>): { id: string; label: string }[] {
  const seen = new Set<string>();
  const result: { id: string; label: string }[] = [];
  for (const w of windows) {
    if (!w.class_id || seen.has(w.class_id)) continue;
    seen.add(w.class_id);
    const info = classNames[w.class_id];
    result.push({ id: w.class_id, label: info ? (info.code ? `${info.name} (${info.code})` : info.name) : w.class_id });
  }
  return result.sort((a, b) => a.label.localeCompare(b.label, 'vi'));
}

export function windowsForClassAndTrial(windows: ExamWindow[], classId: string, trial: TrialFilter): ExamWindow[] {
  return windows
    .filter((w) => !classId || w.class_id === classId)
    .filter((w) => (trial === 'all' ? true : trial === 'trial' ? (w.is_trial ?? false) : !(w.is_trial ?? false)));
}

/** Exams that are the displayed exam of one of the windows. */
export function examsOfWindows<T extends { id: string }>(exams: T[], windows: ExamWindow[]): T[] {
  const ids = new Set(windows.map((w) => w.exam_id));
  return exams.filter((e) => ids.has(e.id));
}

export function windowsForExam(windows: ExamWindow[], examId: string): ExamWindow[] {
  return windows.filter((w) => !examId || w.exam_id === examId);
}

/** A chosen window narrows more than a chosen exam; nothing chosen means no report. */
export function reportFiltersFor(examId: string, windowId: string): { exam_id?: string; window_id?: string } {
  if (windowId) return { window_id: windowId };
  if (examId) return { exam_id: examId };
  return {};
}

/** "[Thử] 02/10/2026 – TD30 • FL-K103" */
export function windowOptionLabel(w: ExamWindow, classNames: Record<string, ClassLabelInfo>): string {
  const trial = w.is_trial ? '[Thử] ' : '';
  const klass = w.class_id ? ` • ${classNames[w.class_id]?.code || classNames[w.class_id]?.name || w.class_id}` : '';
  return `${trial}${new Date(w.start_at).toLocaleDateString('vi-VN')} – ${w.access_code}${klass}`;
}
