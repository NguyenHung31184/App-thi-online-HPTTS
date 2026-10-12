import { MAX_MAIN_VIOLATIONS } from './proctoring-policy';

export interface ExamRulesInput {
  durationMinutes?: number | null;
  totalQuestions?: number | null;
  /** 0–1 */
  passThreshold?: number | null;
  maxAttempts?: number | null;
  isTrial?: boolean;
}

export interface ExamRuleFact {
  label: string;
  value: string;
}

export interface ExamRuleSection {
  title: string;
  items: string[];
}

/** The figures shown at the top of the rules; a figure the exam does not define is left out. */
export function examRuleFacts(input: ExamRulesInput): ExamRuleFact[] {
  const facts: ExamRuleFact[] = [];
  if (input.totalQuestions) facts.push({ label: 'Số câu hỏi', value: `${input.totalQuestions} câu` });
  if (input.durationMinutes) facts.push({ label: 'Thời gian làm bài', value: `${input.durationMinutes} phút` });
  if (input.passThreshold != null) {
    facts.push({ label: 'Điểm đạt', value: `từ ${Math.round(input.passThreshold * 100)}/100` });
  }
  if (input.isTrial) facts.push({ label: 'Loại kỳ thi', value: 'Thi thử' });
  else if (input.maxAttempts) facts.push({ label: 'Số lượt thi', value: `tối đa ${input.maxAttempts} lượt` });
  return facts;
}

/** The rules a student agrees to before the clock starts. */
export function examRuleSections(input: ExamRulesInput): ExamRuleSection[] {
  const attempts = input.isTrial
    ? 'Đây là kỳ thi thử: điểm không ghi vào hồ sơ học tập.'
    : input.maxAttempts
      ? `Mỗi lần vào thi tính là một lượt. Kỳ thi này cho tối đa ${input.maxAttempts} lượt.`
      : 'Mỗi lần vào thi tính là một lượt.';
  return [
    {
      title: 'Trước khi bắt đầu',
      items: [
        'Đồng hồ chạy ngay khi bạn bấm "Đồng ý và vào thi" và không dừng lại, kể cả khi bạn rời trang hoặc mất mạng.',
        attempts,
        'Bạn phải cho phép dùng camera và chụp ảnh khuôn mặt thì mới thấy câu hỏi.',
        'Kiểm tra pin và mạng. Đóng các ứng dụng khác trên thiết bị.',
      ],
    },
    {
      title: 'Trong khi làm bài',
      items: [
        'Chỉ một mình bạn ngồi trước camera. Giữ khuôn mặt trong khung hình, không che ống kính.',
        'Không dùng điện thoại khác, sách, vở hay tài liệu.',
        `Không chuyển tab, thu nhỏ trình duyệt hay thoát toàn màn hình. Mỗi lần rời trang đều được ghi lại; đến lần thứ ${MAX_MAIN_VIOLATIONS} hệ thống tự nộp bài.`,
        'Khi có dấu hiệu vi phạm, camera chụp ảnh để giám thị xem lại.',
        'Không cho người khác biết mã truy cập. Không chép câu hỏi, đáp án ra ngoài.',
      ],
    },
    {
      title: 'Nộp bài và kết quả',
      items: [
        'Câu trả lời được lưu tự động. Hết giờ, hệ thống tự nộp bài với những câu đã trả lời.',
        'Điểm hiện ngay sau khi nộp. Bài bị phát hiện vi phạm có thể bị giám thị xem xét lại kết quả.',
      ],
    },
  ];
}
