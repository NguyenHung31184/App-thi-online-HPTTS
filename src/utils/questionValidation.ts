/**
 * Validate câu hỏi theo từng question_type.
 * Dùng ở cả admin (hiển thị badge cảnh báo) và ExamTakePage (graceful error).
 */

export interface QuestionIssue {
  message: string;
  fix: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: QuestionIssue[];
}

type ValidatableQuestion = {
  question_type: string;
  stem: string;
  options: unknown;
  answer_key: string;
  points: number;
};

const VALID_TYPES = [
  'single_choice', 'multiple_choice', 'drag_drop',
  'video_paragraph', 'main_idea', 'true_false_multi', 'matching',
] as const;

function getOpts(options: unknown): { id: string; text: string }[] {
  if (!Array.isArray(options)) return [];
  return (options as { id?: string; text?: string }[])
    .filter((o) => typeof o.id === 'string' && typeof o.text === 'string' && o.text.trim() !== '')
    .map((o) => ({ id: o.id as string, text: o.text as string }));
}

export function validateQuestion(q: ValidatableQuestion): ValidationResult {
  const issues: QuestionIssue[] = [];

  // ─── Kiểm tra chung ───────────────────────────────────────────────────────
  if (!q.stem?.trim()) {
    issues.push({ message: 'Thiếu nội dung câu hỏi (stem trống)', fix: 'Nhập nội dung câu hỏi trong form sửa' });
  }
  if (!q.points || q.points <= 0) {
    issues.push({ message: `Điểm không hợp lệ (${q.points})`, fix: 'Đặt số điểm >= 1 trong form sửa' });
  }
  if (!VALID_TYPES.includes(q.question_type as typeof VALID_TYPES[number])) {
    issues.push({ message: `Loại câu hỏi không nhận dạng được: "${q.question_type}"`, fix: 'Chọn loại câu hỏi hợp lệ trong form sửa' });
    return { ok: false, issues };
  }

  const opts = getOpts(q.options);

  // ─── single_choice ────────────────────────────────────────────────────────
  if (q.question_type === 'single_choice') {
    if (opts.length < 2) {
      issues.push({ message: `Chỉ có ${opts.length} đáp án (cần ≥ 2)`, fix: 'Thêm đáp án trong form sửa câu hỏi' });
    }
    const ak = (q.answer_key || '').trim();
    if (!opts.find((o) => o.id === ak)) {
      issues.push({
        message: `Đáp án đúng "${ak}" không khớp với bất kỳ đáp án nào`,
        fix: 'Chọn lại đáp án đúng trong form sửa câu hỏi',
      });
    }
  }

  // ─── multiple_choice ──────────────────────────────────────────────────────
  if (q.question_type === 'multiple_choice') {
    if (opts.length < 2) {
      issues.push({ message: `Chỉ có ${opts.length} đáp án (cần ≥ 2)`, fix: 'Thêm đáp án trong form sửa câu hỏi' });
    }
    try {
      const ak = JSON.parse(q.answer_key || '[]') as unknown;
      if (!Array.isArray(ak) || (ak as string[]).length === 0) {
        issues.push({ message: 'Chưa chọn đáp án đúng nào', fix: 'Tích chọn ít nhất 1 đáp án đúng trong form sửa' });
      } else {
        const optIds = opts.map((o) => o.id);
        const bad = (ak as string[]).filter((id) => !optIds.includes(id));
        if (bad.length) {
          issues.push({ message: `Đáp án đúng có ID không tồn tại: ${bad.join(', ')}`, fix: 'Chọn lại đáp án đúng trong form sửa câu hỏi' });
        }
      }
    } catch {
      issues.push({ message: 'answer_key không đúng định dạng JSON array', fix: 'Sửa lại câu hỏi — có thể do import lỗi' });
    }
  }

  // ─── drag_drop ────────────────────────────────────────────────────────────
  if (q.question_type === 'drag_drop') {
    if (opts.length < 2) {
      issues.push({ message: `Chỉ có ${opts.length} mục (cần ≥ 2 để sắp xếp)`, fix: 'Thêm mục trong form sửa câu hỏi' });
    }
    try {
      const ak = JSON.parse(q.answer_key || '[]') as unknown;
      if (!Array.isArray(ak) || (ak as string[]).length === 0) {
        issues.push({ message: 'Chưa thiết lập thứ tự đúng', fix: 'Chọn thứ tự đúng trong form sửa câu hỏi' });
      } else if ((ak as string[]).length !== opts.length) {
        issues.push({
          message: `Số mục thứ tự đúng (${(ak as string[]).length}) ≠ số đáp án (${opts.length})`,
          fix: 'Sửa lại thứ tự đúng trong form sửa để khớp số mục',
        });
      } else {
        const optIds = opts.map((o) => o.id);
        const bad = (ak as string[]).filter((id) => !optIds.includes(id));
        if (bad.length) {
          issues.push({ message: `Thứ tự đúng có ID không tồn tại: ${bad.join(', ')}`, fix: 'Sửa lại trong form sửa câu hỏi' });
        }
      }
    } catch {
      issues.push({ message: 'answer_key không đúng định dạng JSON array', fix: 'Sửa lại câu hỏi — có thể do import lỗi' });
    }
  }

  // ─── true_false_multi ─────────────────────────────────────────────────────
  if (q.question_type === 'true_false_multi') {
    if (opts.length < 2) {
      issues.push({ message: `Chỉ có ${opts.length} phát biểu (cần ≥ 2)`, fix: 'Thêm phát biểu trong form sửa câu hỏi' });
    }
    try {
      const ak = JSON.parse(q.answer_key || '[]') as unknown;
      if (!Array.isArray(ak)) {
        issues.push({ message: 'answer_key phải là JSON array ["T","F",...]', fix: 'Sửa lại trong form sửa câu hỏi' });
      } else {
        if ((ak as string[]).length !== opts.length) {
          issues.push({
            message: `Số phát biểu (${opts.length}) ≠ số đáp án T/F (${(ak as string[]).length})`,
            fix: 'Sửa lại để số T/F bằng số phát biểu trong form sửa',
          });
        }
        const bad = (ak as string[]).filter((v) => v !== 'T' && v !== 'F');
        if (bad.length) {
          issues.push({ message: `Đáp án T/F có giá trị không hợp lệ: ${bad.join(', ')} (chỉ chấp nhận "T" hoặc "F")`, fix: 'Sửa lại trong form sửa câu hỏi' });
        }
      }
    } catch {
      issues.push({ message: 'answer_key không đúng định dạng JSON array', fix: 'Sửa lại câu hỏi — có thể do import lỗi' });
    }
  }

  // ─── matching ─────────────────────────────────────────────────────────────
  if (q.question_type === 'matching') {
    if (opts.length < 2) {
      issues.push({ message: `Chỉ có ${opts.length} cặp (cần ≥ 2)`, fix: 'Thêm cặp nối trong form sửa câu hỏi' });
    }
    try {
      const ak = JSON.parse(q.answer_key || '{}') as { right?: unknown; map?: unknown };
      if (!Array.isArray(ak.right) || (ak.right as string[]).length === 0) {
        issues.push({ message: 'Thiếu cột phải (right) trong answer_key', fix: 'Nhập nội dung cột phải trong form sửa câu hỏi' });
      } else if ((ak.right as string[]).length !== opts.length) {
        issues.push({
          message: `Số mục cột trái (${opts.length}) ≠ cột phải (${(ak.right as string[]).length})`,
          fix: 'Sửa để 2 cột có số mục bằng nhau trong form sửa',
        });
      }
      if (!ak.map || typeof ak.map !== 'object' || Array.isArray(ak.map)) {
        issues.push({ message: 'Thiếu bảng ánh xạ (map) trong answer_key', fix: 'Sửa lại trong form sửa câu hỏi' });
      } else {
        const optIds = opts.map((o) => o.id);
        const badKeys = Object.keys(ak.map as object).filter((k) => !optIds.includes(k));
        if (badKeys.length) {
          issues.push({ message: `Map có key không khớp đáp án: ${badKeys.join(', ')}`, fix: 'Sửa lại trong form sửa câu hỏi' });
        }
        const rightLen = Array.isArray(ak.right) ? (ak.right as string[]).length : 0;
        const badVals = Object.values(ak.map as Record<string, string>)
          .filter((v) => isNaN(Number(v)) || Number(v) < 1 || Number(v) > rightLen);
        if (badVals.length) {
          issues.push({ message: `Map có giá trị ngoài phạm vi 1–${rightLen}: ${badVals.join(', ')}`, fix: 'Sửa lại mapping trong form sửa câu hỏi' });
        }
      }
    } catch {
      issues.push({ message: 'answer_key không đúng định dạng JSON object', fix: 'Sửa lại câu hỏi — có thể do import lỗi' });
    }
  }

  // ─── main_idea / video_paragraph ─────────────────────────────────────────
  if (q.question_type === 'main_idea' || q.question_type === 'video_paragraph') {
    const ak = (q.answer_key || '').trim();
    if (ak) {
      try {
        const parsed = JSON.parse(ak) as unknown;
        if (!Array.isArray(parsed)) {
          issues.push({ message: 'Keys chấm điểm không đúng định dạng JSON array', fix: 'Sửa lại keys chấm điểm trong form sửa câu hỏi' });
        } else {
          const bad = (parsed as { text?: unknown; points?: unknown }[]).filter(
            (k) => !k.text || typeof k.text !== 'string' || k.text.trim() === '' ||
                   typeof k.points !== 'number' || k.points <= 0
          );
          if (bad.length) {
            issues.push({ message: `${bad.length} key chấm điểm thiếu text hoặc điểm không hợp lệ`, fix: 'Sửa lại keys trong form sửa câu hỏi' });
          }
        }
      } catch {
        issues.push({ message: 'answer_key không đúng định dạng JSON', fix: 'Sửa lại keys chấm điểm trong form sửa câu hỏi' });
      }
    }
    // Không cảnh báo nếu answer_key trống — chấm tay vẫn hợp lệ
  }

  return { ok: issues.length === 0, issues };
}

/** Tiện ích: trả về label ngắn gọn cho từng loại câu hỏi */
export function questionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    single_choice: 'Trắc nghiệm',
    multiple_choice: 'Nhiều đáp án',
    drag_drop: 'Kéo thả',
    true_false_multi: 'Đúng/Sai',
    matching: 'Nối đôi',
    main_idea: 'Tự luận',
    video_paragraph: 'Clip + Tự luận',
  };
  return map[type] ?? type;
}
