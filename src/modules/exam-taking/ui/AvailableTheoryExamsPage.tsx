import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../identity-access/public';
import { ExamCard } from '../../../shared/ui/ExamCard';
import { useAvailableTheoryWindows, useExamForRules, useStartTheoryAttempt } from '../queries/use-theory-attempt';
import { ExamRules } from './intro/ExamRules';
import { preloadProctoring } from '../queries/session-actions';
import { currentInAppBrowser } from '../../../platform/browser/in-app-browser';
import { InAppBrowserNotice } from '../../../shared/ui/InAppBrowserNotice';

export default function AvailableTheoryExamsPage() {
  const { user, studentSession } = useAuth();
  const navigate = useNavigate();
  const [codeByWindow, setCodeByWindow] = useState<Record<string, string>>({});
  const [enterError, setEnterError] = useState('');
  const [rulesWindowId, setRulesWindowId] = useState<string | null>(null);
  const [rulesConfirmed, setRulesConfirmed] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const inApp = currentInAppBrowser();
  const windowsQuery = useAvailableTheoryWindows();
  const startAttempt = useStartTheoryAttempt();
  const windows = windowsQuery.data ?? [];
  const error = windowsQuery.error instanceof Error ? windowsQuery.error.message : '';
  const rulesWindow = windows.find((window) => window.id === rulesWindowId) ?? null;
  // A window that draws one of several exams has no single exam to describe before the attempt starts.
  const rulesExamId = rulesWindow && !(rulesWindow.exam_ids?.length) ? rulesWindow.exam_id : null;
  const rulesExam = useExamForRules(rulesExamId).data ?? null;

  // The student reads the rules while the monitoring models download, instead of waiting inside the exam.
  useEffect(() => { if (rulesWindowId) preloadProctoring(); }, [rulesWindowId]);

  /** Checks what can be checked without starting the clock, then shows the rules. */
  const handleEnter = (windowId: string) => {
    const accessCode = (codeByWindow[windowId] ?? '').trim();
    if (!accessCode) { setEnterError('Vui lòng nhập mã truy cập.'); return; }
    if (!user?.id) { setEnterError('Bạn chưa đăng nhập tài khoản thi. Vui lòng đăng nhập rồi thử lại.'); return; }
    if (!user.student_id && !studentSession?.student_id) {
      setEnterError('Vui lòng xác thực CCCD trước khi vào phòng thi.');
      return;
    }
    if (!windows.some((window) => window.id === windowId)) {
      setEnterError('Không tìm thấy kỳ thi.');
      return;
    }
    setEnterError('');
    // Stop here, before an attempt exists: the exam cannot take its photos in this browser.
    if (inApp?.blocksInlineCamera) { setCameraBlocked(true); return; }
    setRulesConfirmed(false);
    setRulesWindowId(windowId);
  };

  const handleStart = async () => {
    if (!rulesWindow || !rulesConfirmed) return;
    setEnterError('');
    try {
      const attempt = await startAttempt.mutateAsync({
        windowId: rulesWindow.id,
        accessCode: (codeByWindow[rulesWindow.id] ?? '').trim(),
      });
      navigate(`/exam/${attempt.id}`);
    } catch (reason) {
      setEnterError(reason instanceof Error ? reason.message : 'Lỗi tạo bài làm.');
    }
  };

  if (cameraBlocked && inApp) {
    return <InAppBrowserNotice browser={inApp} variant="block" onBack={() => setCameraBlocked(false)} />;
  }

  if (rulesWindow) {
    return (
      <ExamRules
        examTitle={rulesWindow.exam_title ?? 'Đề thi'}
        rules={{
          durationMinutes: rulesExam?.duration_minutes,
          totalQuestions: rulesExam?.total_questions,
          passThreshold: rulesExam?.pass_threshold,
          maxAttempts: rulesWindow.max_attempts,
          isTrial: rulesWindow.is_trial,
        }}
        confirmed={rulesConfirmed}
        onConfirmedChange={setRulesConfirmed}
        onStart={() => { void handleStart(); }}
        onBack={() => { setRulesWindowId(null); setEnterError(''); }}
        busy={startAttempt.isPending}
        error={enterError}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-2">Kỳ thi đang mở</h2>
      <p className="text-sm text-slate-600 mb-4">Nhập mã truy cập do giám thị cung cấp để vào phòng thi.</p>
      {windowsQuery.isLoading && <p className="text-slate-500">Đang tải...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {enterError && <p className="text-amber-600 mb-2">{enterError}</p>}
      {!windowsQuery.isLoading && !error && windows.length === 0 && (
        <p className="text-slate-500 mb-4">Hiện bạn không có kỳ thi nào trong thời gian làm bài.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {windows.map((window) => (
          <ExamCard
            key={window.id}
            title={window.exam_title ?? 'Đề thi'}
            subtitle={window.class_name ? `Lớp: ${window.class_name}` : undefined}
            meta="MCQ"
            footerLeft={<span>{new Date(window.start_at).toLocaleString('vi-VN')} – {new Date(window.end_at).toLocaleString('vi-VN')}</span>}
            footerRight={(
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Mã truy cập"
                  value={codeByWindow[window.id] ?? ''}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setCodeByWindow((current) => ({ ...current, [window.id]: event.target.value }))}
                  className="border border-slate-300 rounded-lg px-2 py-1 w-24"
                />
                <button
                  type="button"
                  disabled={startAttempt.isPending}
                  onClick={(event) => { event.stopPropagation(); handleEnter(window.id); }}
                  className="px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-xs"
                >
                  {startAttempt.isPending ? 'Đang vào' : 'Vào thi'}
                </button>
              </div>
            )}
          />
        ))}
      </div>
    </div>
  );
}
