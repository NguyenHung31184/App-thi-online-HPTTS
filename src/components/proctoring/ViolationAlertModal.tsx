/**
 * ViolationAlertModal — Hiển thị cảnh báo vi phạm cho học viên trong lúc làm bài.
 * - Tự đóng sau vài giây để không chặn bài làm quá lâu.
 * - Chỉ tín hiệu rời trang mới hiển thị số lần còn lại trước khi tự nộp.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { aiRiskPoints, type AiViolationKind, type ProctoringMode } from '../../modules/exam-taking/public';
import type { EvidenceKind } from './ProctoringEvidenceCapture';

interface ViolationConfig {
  title: string;
  subtitle: string;
  countsTowardAutoSubmit: boolean;
}

const VIOLATION_CONFIG: Record<EvidenceKind, ViolationConfig> = {
  ai_cell_phone:        { title: 'Phát hiện điện thoại',  subtitle: 'Tín hiệu đã được lưu để giám thị kiểm tra lại.', countsTowardAutoSubmit: false },
  ai_prohibited_object: { title: 'Phát hiện vật cấm',     subtitle: 'Tín hiệu đã được lưu để giám thị kiểm tra lại.', countsTowardAutoSubmit: false },
  ai_no_face:           { title: 'Không thấy khuôn mặt',  subtitle: 'Hãy điều chỉnh camera. Tín hiệu đã được lưu để giám thị kiểm tra lại.', countsTowardAutoSubmit: false },
  ai_multiple_face:     { title: 'Phát hiện nhiều người', subtitle: 'Hãy bảo đảm chỉ một người trong khung hình. Giám thị sẽ kiểm tra lại tín hiệu này.', countsTowardAutoSubmit: false },
  visibility_hidden:    { title: 'Rời khỏi trang thi',    subtitle: 'Hành động đã được ghi lại.', countsTowardAutoSubmit: true },
  focus_lost:           { title: 'Rời khỏi cửa sổ thi',   subtitle: 'Hành động đã được ghi lại.', countsTowardAutoSubmit: true },
  fullscreen_exited:    { title: 'Thoát toàn màn hình',   subtitle: 'Hành động đã được ghi lại.', countsTowardAutoSubmit: true },
};

/** Thời gian tự đóng modal (giây). */
const AUTO_CLOSE_SECONDS = 5;

interface ViolationAlertModalProps {
  kind: EvidenceKind | null;
  violationCount?: number;
  maxViolations?: number;
  aiRiskScore?: number;
  aiRiskThreshold?: number;
  proctoringMode?: ProctoringMode;
  onClose: () => void;
}

export function ViolationAlertModal({
  kind,
  violationCount,
  maxViolations,
  aiRiskScore = 0,
  aiRiskThreshold = 6,
  proctoringMode = 'standard',
  onClose,
}: ViolationAlertModalProps) {
  const [countdown, setCountdown] = useState(AUTO_CLOSE_SECONDS);
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Reset + khởi động đồng hồ mỗi khi xuất hiện vi phạm mới
  useEffect(() => {
    if (!kind) return;
    setCountdown(AUTO_CLOSE_SECONDS);
    const id = window.setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          window.clearInterval(id);
          onCloseRef.current();
          return 0;
        }
        return n - 1;
      });
    }, 1_000);
    return () => window.clearInterval(id);
  }, [kind]);

  if (!kind) return null;

  const config = VIOLATION_CONFIG[kind];
  const isAiSignal = kind.startsWith('ai_');

  const remaining =
    config.countsTowardAutoSubmit && violationCount != null && maxViolations != null
      ? maxViolations - violationCount
      : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="violation-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-8 flex flex-col items-center text-center">
        {/* Icon vòng tròn đỏ với dấu X */}
        <div className="mb-5">
          <svg
            className="w-20 h-20 text-red-400"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="4" />
            <line x1="25" y1="25" x2="55" y2="55" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <line x1="55" y1="25" x2="25" y2="55" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
          </svg>
        </div>

        <h2
          id="violation-title"
          className="text-2xl font-bold text-slate-800 mb-2"
        >
          {config.title}
        </h2>

        <p className="text-slate-500 text-sm mb-1">{config.subtitle}</p>

        {isAiSignal && proctoringMode === 'strict' && (
          <p className="mt-2 text-sm font-medium text-amber-700">
            Sự việc được xác nhận sẽ cộng {aiRiskPoints(kind as AiViolationKind)} điểm. Điểm AI hiện tại: {aiRiskScore}/{aiRiskThreshold}.
          </p>
        )}
        {isAiSignal && proctoringMode === 'supervised' && (
          <p className="mt-2 text-sm font-medium text-slate-700">
            Bằng chứng đang được gửi để giám thị xác nhận.
          </p>
        )}
        {isAiSignal && proctoringMode === 'standard' && (
          <p className="mt-2 text-sm text-slate-600">
            Tín hiệu AI không tự động nộp bài trong chế độ này.
          </p>
        )}

        {/* Đếm lùi vi phạm — hiện cho tất cả loại */}
        {remaining != null && (
          <p className={`text-sm font-medium mt-2 ${remaining <= 1 ? 'text-red-600' : 'text-amber-600'}`}>
            {remaining <= 0
              ? 'Bài thi sẽ được nộp tự động!'
              : `Còn ${remaining} lần vi phạm trước khi bài thi tự động nộp.`}
          </p>
        )}

        {/* Nút OK + countdown tự đóng */}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 px-10 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
          autoFocus
        >
          OK ({countdown}s)
        </button>
      </div>
    </div>
  );
}
