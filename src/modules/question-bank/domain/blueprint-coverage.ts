import { contentKey } from './question-import';

/** A question start_exam_attempt can draw: published (or no status), not deleted, in the exam's module. */
export interface DrawPoolQuestion {
  stem: string;
  options: unknown;
  topic: string | null;
  difficulty: string | null;
}

export type BlueprintCoverage =
  | { ok: true; questionsPerAttempt: number }
  | { ok: false; message: string };

// The draw rejects a rule whose count does not match this pattern.
const COUNT_PATTERN = /^[1-9][0-9]*$/;

function ruleText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function matches(wanted: string | null, value: string | null): boolean {
  return wanted === '*' || (wanted !== null && value === wanted);
}

function ruleLabel(topic: string | null, difficulty: string | null): string {
  const topicLabel = topic === '*' ? 'tất cả chủ đề' : `chủ đề "${topic ?? ''}"`;
  const difficultyLabel = difficulty === '*' ? 'mọi độ khó' : `độ khó "${difficulty ?? ''}"`;
  return `${topicLabel}, ${difficultyLabel}`;
}

/**
 * The draw takes the rules in order; each picks `count` questions, distinct by contentKey, that earlier rules did not
 * pick. A rule passes only if it can be filled whatever the earlier rules happened to pick, so the check assumes they
 * took as many of its questions as they could.
 */
export function checkBlueprintCoverage(blueprint: unknown, pool: DrawPoolQuestion[]): BlueprintCoverage {
  if (!Array.isArray(blueprint) || blueprint.length === 0) {
    return { ok: false, message: 'Đề chưa có ma trận câu hỏi. Thêm ít nhất một nhóm câu hỏi rồi khóa lại.' };
  }
  const keys = pool.map((question) => contentKey(question.stem, question.options));
  const earlierKeys = new Set<string>();
  let earlierCount = 0;
  for (const rule of blueprint as Record<string, unknown>[]) {
    const topic = ruleText(rule?.topic);
    const difficulty = ruleText(rule?.difficulty);
    const label = ruleLabel(topic, difficulty);
    const countText = String(rule?.count ?? '');
    if (!COUNT_PATTERN.test(countText)) {
      return { ok: false, message: `Nhóm ${label}: số câu "${countText}" không hợp lệ.` };
    }
    const count = Number(countText);
    const ruleKeys = new Set(keys.filter((_, index) => matches(topic, pool[index].topic) && matches(difficulty, pool[index].difficulty)));
    const shared = [...ruleKeys].filter((key) => earlierKeys.has(key)).length;
    const taken = Math.min(earlierCount, shared);
    const available = ruleKeys.size - taken;
    if (available < count) {
      return {
        ok: false,
        message: taken > 0
          ? `Thiếu câu: ${label} cần ${count}. Ngân hàng có ${ruleKeys.size} câu, nhưng các nhóm trước có thể đã lấy ${taken} câu trong số đó.`
          : `Thiếu câu: ${label} cần ${count}, ngân hàng của mô-đun chỉ có ${ruleKeys.size} câu (câu trùng nội dung tính một lần).`,
      };
    }
    ruleKeys.forEach((key) => earlierKeys.add(key));
    earlierCount += count;
  }
  return { ok: true, questionsPerAttempt: earlierCount };
}
