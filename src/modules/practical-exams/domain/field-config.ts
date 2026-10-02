/**
 * Field grading set-up of a practical template (stored in practical_exam_templates.config) and the scoring rules
 * that Sổ chuyên cần applies at the site: deductions from the maximum, three time bands, disqualification.
 */

export interface FieldStep {
  key: string;
  name: string;
  /** A lift–move–lower cycle the examiner repeats and times. */
  cycle: boolean;
  /** What to photograph in this step (after each cycle for a cycle step); empty for none. */
  photo: string;
}

export type TimeAggregate = 'average' | 'fastest' | 'last';

export interface TimeRule {
  /** Upper bounds in seconds of the three bands, increasing. Over the last one scores 0. */
  limits: [number, number, number];
  points: [number, number, number];
  aggregate: TimeAggregate;
}

export interface FieldConfig {
  ppe: string[];
  disqualifyReasons: string[];
  steps: FieldStep[];
  time: TimeRule | null;
}

export interface Deduction {
  label: string;
  points: number;
}

export const DEFAULT_PPE = ['Mũ bảo hộ', 'Giày bảo hộ', 'Áo phản quang', 'Găng tay'];

/** Section V of the 2026 end-of-module practical test: disqualifying faults. */
export const DEFAULT_DISQUALIFY_REASONS = [
  'Thiếu trang bị bảo hộ lao động',
  'Điều khiển khi chưa được phép của giám khảo',
  'Không dừng thiết bị khi phát hiện sự cố nguy hiểm',
  'Dùng điện thoại, hút thuốc, làm việc riêng',
  'Không kiểm tra an toàn ban đầu',
  'Điều khiển giật cục, container đu đưa mạnh hoặc va chạm',
  'Hạ container sai vị trí, gây đổ, trượt',
  'Gài khóa spreader sai, container rơi, lỏng hoặc lắc mạnh',
  'Container nghiêng, va đập xe mooc hoặc hàng hóa khác',
  'Lời nói, hành động thiếu chuẩn mực',
];

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => String(v ?? '').trim()).filter(Boolean) : [];

/** Three equal bands up to `standardSeconds`, e.g. 6 minutes → under 2:00, 2:00–4:00, 4:00–6:00. */
export function equalBands(standardSeconds: number): [number, number, number] {
  const third = Math.round(standardSeconds / 3);
  return [third, third * 2, Math.round(standardSeconds)];
}

function readTime(value: unknown): TimeRule | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { limits?: unknown; points?: unknown; aggregate?: unknown };
  const limits = Array.isArray(raw.limits) ? raw.limits.map(Number) : [];
  const points = Array.isArray(raw.points) ? raw.points.map(Number) : [];
  if (limits.length !== 3 || points.length !== 3 || [...limits, ...points].some((n) => !Number.isFinite(n))) return null;
  const aggregate: TimeAggregate = raw.aggregate === 'fastest' || raw.aggregate === 'last' ? raw.aggregate : 'average';
  return { limits: limits as TimeRule['limits'], points: points as TimeRule['points'], aggregate };
}

/** Reads a stored config; missing parts take the defaults, malformed ones are dropped. */
export function readFieldConfig(value: unknown): FieldConfig {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const steps = Array.isArray(raw.steps)
    ? raw.steps.flatMap((s, index): FieldStep[] => {
        if (!s || typeof s !== 'object') return [];
        const step = s as Record<string, unknown>;
        const name = String(step.name ?? '').trim();
        if (!name) return [];
        return [{ key: String(step.key ?? '').trim() || `s${index + 1}`, name, cycle: step.cycle === true, photo: String(step.photo ?? '').trim() }];
      })
    : [];
  const ppe = asStrings(raw.ppe);
  const reasons = asStrings(raw.disqualify_reasons);
  return {
    ppe: ppe.length ? ppe : DEFAULT_PPE,
    disqualifyReasons: reasons.length ? reasons : DEFAULT_DISQUALIFY_REASONS,
    steps,
    time: readTime(raw.time),
  };
}

/** The stored form of a config (snake_case keys as in the database). */
export function fieldConfigRow(config: FieldConfig): Record<string, unknown> {
  return {
    ppe: config.ppe,
    disqualify_reasons: config.disqualifyReasons,
    steps: config.steps,
    ...(config.time ? { time: config.time } : {}),
  };
}

/** Problems that would make the grading screen misbehave; empty when the config can be saved. */
export function fieldConfigProblems(config: FieldConfig): string[] {
  const problems: string[] = [];
  const keys = config.steps.map((s) => s.key);
  if (new Set(keys).size !== keys.length) problems.push('Hai bước trùng mã.');
  if (config.time) {
    const [a, b, c] = config.time.limits;
    if (!(a > 0 && a < b && b < c)) problems.push('Mốc thời gian phải tăng dần và lớn hơn 0.');
    if (config.time.points.some((p) => p < 0)) problems.push('Điểm khung thời gian không được âm.');
  }
  return problems;
}

/** Time score of one duration under the rule: band 1, 2, 3, or 0 when over the last limit. */
export function timeScore(seconds: number, rule: TimeRule): number {
  const index = rule.limits.findIndex((limit) => seconds < limit);
  return index === -1 ? 0 : rule.points[index];
}

/** The duration that counts for the time criterion, from the timed cycles. */
export function countedSeconds(cycles: number[], aggregate: TimeAggregate): number | null {
  const valid = cycles.filter((s) => Number.isFinite(s) && s > 0);
  if (valid.length === 0) return null;
  if (aggregate === 'fastest') return Math.min(...valid);
  if (aggregate === 'last') return valid[valid.length - 1];
  return Math.round(valid.reduce((sum, s) => sum + s, 0) / valid.length);
}

/** A criterion's score: its maximum less the deductions, never below 0. */
export function scoreAfterDeductions(max: number, deductions: Deduction[]): number {
  const taken = deductions.reduce((sum, d) => sum + Math.max(0, d.points), 0);
  return Math.max(0, Math.round((max - taken) * 10) / 10);
}

/** Quick deductions of a criterion as stored; malformed entries are dropped. */
export function readDeductions(value: unknown): Deduction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((d): Deduction[] => {
    if (!d || typeof d !== 'object') return [];
    const label = String((d as { label?: unknown }).label ?? '').trim();
    const points = Number((d as { points?: unknown }).points);
    return label && Number.isFinite(points) && points > 0 ? [{ label, points }] : [];
  });
}

/** "Rung lắc khi di chuyển | 2" per line ↔ deductions, for the template editor. */
export function deductionsFromText(text: string): Deduction[] {
  return readDeductions(
    text.split('\n').map((line) => {
      const [label, points] = line.split('|');
      return { label: label?.trim(), points: Number(points?.trim()) };
    }),
  );
}

export const deductionsToText = (deductions: Deduction[]): string => deductions.map((d) => `${d.label} | ${d.points}`).join('\n');

/** Total on 100 and on 10 for TTDT (rounded as `server/exam-sync.ts` does); a disqualified attempt is 0. */
export function fieldTotals(scores: number[], disqualified: boolean, passScore: number): { total: number; outOf10: number; passed: boolean } {
  const total = disqualified ? 0 : Math.round(scores.reduce((sum, s) => sum + s, 0) * 10) / 10;
  return { total, outOf10: Number((total / 10).toFixed(1)), passed: !disqualified && total >= passScore };
}
