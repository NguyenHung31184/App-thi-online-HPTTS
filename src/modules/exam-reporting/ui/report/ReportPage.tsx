import { useEffect, useMemo, useState } from 'react';
import type { Exam, ExamWindow } from '../../../../types';
import {
  classesWithWindows, examsOfWindows, reportFiltersFor, windowsForClassAndTrial, windowsForExam, type ClassLabelInfo, type TrialFilter,
} from '../../domain/report-filters';
import {
  useAttemptReport, useReportClasses, useReportExams, useReportWindows, useReviewIncident, useViolationReport,
} from '../../queries/use-exam-reporting';
import { ReportFilterPanel } from './ReportFilterPanel';
import { ResultsTab } from './ResultsTab';
import { SignalsTab } from './SignalsTab';

const NO_EXAMS: Exam[] = [];
const NO_WINDOWS: ExamWindow[] = [];

const tabClass = (active: boolean, activeColors: string) =>
  `px-3 py-1.5 text-sm font-medium rounded-full border ${active ? activeColors : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`;

/** Theory report: results and monitoring signals of one exam or window. */
export default function ReportPage() {
  const [classId, setClassId] = useState('');
  const [examId, setExamId] = useState('');
  const [windowId, setWindowId] = useState('');
  const [trial, setTrial] = useState<TrialFilter>('all');
  const [activeTab, setActiveTab] = useState<'results' | 'violations'>('results');
  const [resultSearch, setResultSearch] = useState('');
  const [violationSearch, setViolationSearch] = useState('');
  const [reviewError, setReviewError] = useState('');

  const exams = useReportExams().data ?? NO_EXAMS;
  const allWindows = useReportWindows().data ?? NO_WINDOWS;
  const classList = useReportClasses().data;
  const classNames = useMemo<Record<string, ClassLabelInfo>>(
    () => Object.fromEntries((classList ?? []).map((c) => [c.id, { name: c.name, code: c.code }])),
    [classList],
  );

  const availableClasses = useMemo(() => classesWithWindows(allWindows, classNames), [allWindows, classNames]);
  const windowsByClassAndTrial = useMemo(() => windowsForClassAndTrial(allWindows, classId, trial), [allWindows, classId, trial]);
  const availableExams = useMemo(() => examsOfWindows(exams, windowsByClassAndTrial), [exams, windowsByClassAndTrial]);
  const filteredWindows = useMemo(() => windowsForExam(windowsByClassAndTrial, examId), [windowsByClassAndTrial, examId]);

  // Clear a choice that the other filters have ruled out.
  useEffect(() => {
    if (examId && !availableExams.find((e) => e.id === examId)) {
      setExamId('');
      setWindowId('');
    }
  }, [availableExams, examId]);
  useEffect(() => {
    if (windowId && !filteredWindows.find((w) => w.id === windowId)) setWindowId('');
  }, [filteredWindows, windowId]);

  const hasSelection = Boolean(examId || windowId);
  const filters = useMemo(() => reportFiltersFor(examId, windowId), [examId, windowId]);
  const results = useAttemptReport(filters, activeTab === 'results' && hasSelection);
  const violations = useViolationReport(filters, activeTab === 'violations' && hasSelection);
  const review = useReviewIncident();

  const loading = results.isFetching;
  const loadingViolations = violations.isFetching;

  const reload = () => {
    if (!hasSelection) return;
    if (activeTab === 'results') void results.refetch();
    else void violations.refetch();
  };

  const handleReview = (id: string, decision: 'confirmed' | 'rejected') => {
    setReviewError('');
    review.mutate({ id, decision }, {
      onError: (error) => setReviewError(error instanceof Error ? error.message : 'Không cập nhật được kết quả kiểm tra.'),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Báo cáo lý thuyết</h1>
          <p className="text-sm text-slate-500 mt-0.5">Lọc theo lớp, đề thi, loại kỳ thi rồi chọn kỳ thi cụ thể để xem báo cáo.</p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={!hasSelection || loading || loadingViolations}
          className="px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Nạp lại
        </button>
      </div>

      <ReportFilterPanel
        trial={trial}
        onTrialChange={setTrial}
        classes={availableClasses}
        classId={classId}
        onClassChange={(id) => { setClassId(id); setExamId(''); setWindowId(''); }}
        exams={availableExams}
        examId={examId}
        onExamChange={(id) => { setExamId(id); setWindowId(''); }}
        windows={filteredWindows}
        windowId={windowId}
        onWindowChange={setWindowId}
        classNames={classNames}
      />

      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setActiveTab('results')} className={tabClass(activeTab === 'results', 'bg-slate-800 text-white border-slate-800')}>
          Kết quả
        </button>
        <button type="button" onClick={() => setActiveTab('violations')} className={tabClass(activeTab === 'violations', 'bg-rose-700 text-white border-rose-700')}>
          Tín hiệu giám sát
        </button>
      </div>

      {!hasSelection && <p className="text-slate-400 text-sm">Chọn ít nhất một đề thi hoặc kỳ thi để xem báo cáo.</p>}

      {(loading || loadingViolations) && <p className="text-slate-500 text-sm">Đang tải...</p>}

      {activeTab === 'results' && hasSelection && !loading && (
        <ResultsTab rows={results.data ?? []} search={resultSearch} onSearchChange={setResultSearch} />
      )}

      {activeTab === 'violations' && hasSelection && !loadingViolations && (
        <SignalsTab
          rows={violations.data ?? []}
          search={violationSearch}
          onSearchChange={setViolationSearch}
          reviewingId={review.isPending ? review.variables?.id ?? null : null}
          reviewError={reviewError}
          onReview={handleReview}
        />
      )}
    </div>
  );
}
