import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import type { WindowProctoringMode } from '../domain/exam-inputs';
import { examsWithoutModule, fromDatetimeLocal, randomAccessCode, toDatetimeLocal, windowFormError } from '../domain/window-form';
import {
  useCreateExamWindow,
  useExams,
  useFetchExamWindow,
  useTtdtClasses,
  useUpdateExamWindow,
  useWindowAttemptCount,
} from '../queries/use-exam-management';
import { ExamPickerSection } from './window-form/ExamPickerSection';
import { AiProctoringFieldset, MaxAttemptsPicker, TrialToggle } from './window-form/WindowRuleSections';

export default function WindowFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [examId, setExamId] = useState('');
  const [useMultiExams, setUseMultiExams] = useState(false);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [classId, setClassId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isTrial, setIsTrial] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [proctoringMode, setProctoringMode] = useState<WindowProctoringMode>('strict');
  const [aiRiskThreshold, setAiRiskThreshold] = useState(6);
  const [savedAsTrial, setSavedAsTrial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const exams = useExams().data ?? [];
  const classes = useTtdtClasses().data ?? [];
  const usedAttempts = useWindowAttemptCount(id).data ?? 0;
  const fetchWindow = useFetchExamWindow();
  const createWindow = useCreateExamWindow();
  const updateWindow = useUpdateExamWindow();

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    fetchWindow(id).then((window) => {
      if (cancelled || !window) return;
      const ids = window.exam_ids?.filter(Boolean) ?? [];
      setUseMultiExams(ids.length > 0);
      setSelectedExamIds(ids);
      setExamId(ids.length > 0 ? ids[0] : window.exam_id);
      setClassId(window.class_id);
      setStartAt(toDatetimeLocal(window.start_at));
      setEndAt(toDatetimeLocal(window.end_at));
      setAccessCode(window.access_code);
      setIsTrial(window.is_trial ?? false);
      setSavedAsTrial(window.is_trial ?? false);
      setMaxAttempts(window.max_attempts ?? 2);
      setProctoringMode(window.proctoring_mode ?? 'standard');
      setAiRiskThreshold(window.ai_risk_threshold ?? 6);
    }).catch(() => setError('Không tải được kỳ thi.'));
    return () => { cancelled = true; };
    // fetchWindow is a new function each render; loading once per window id is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  const chosenExamIds = useMultiExams ? selectedExamIds : examId ? [examId] : [];
  const titlesWithoutModule = examsWithoutModule(chosenExamIds, exams);
  const trialLockedAttempts = isEdit && savedAsTrial && usedAttempts > 0 ? usedAttempts : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startTs = fromDatetimeLocal(startAt);
    const endTs = fromDatetimeLocal(endAt);
    const problem = windowFormError({ isTrial, classId, useMultiExams, examId, selectedExamIds, titlesWithoutModule, startAt: startTs, endAt: endTs });
    setError(problem ?? '');
    if (problem) return;

    const common = {
      class_id: classId || '',
      start_at: startTs,
      end_at: endTs,
      access_code: accessCode,
      is_trial: isTrial,
      max_attempts: maxAttempts,
      proctoring_mode: proctoringMode,
      ai_risk_threshold: aiRiskThreshold,
    };
    setLoading(true);
    try {
      if (isEdit && id) {
        await updateWindow.mutateAsync({
          id,
          input: { ...common, exam_id: useMultiExams ? undefined : examId, exam_ids: useMultiExams ? selectedExamIds : [] },
        });
      } else {
        await createWindow.mutateAsync(useMultiExams ? { ...common, exam_ids: selectedExamIds } : { ...common, exam_id: examId });
      }
      navigate('/admin/windows');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu kỳ thi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">{isEdit ? 'Cập nhật kỳ thi' : 'Tạo kỳ thi mới'}</h1>
          <p className="text-sm text-slate-600 mt-1">
            Chọn đề thi, lớp TTDT, thời gian thi và mã truy cập. Kỳ thi chỉ đồng bộ điểm đúng khi đề có mô-đun và kỳ thi gắn lớp.
          </p>
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

        {isTrial ? (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
            <p className="font-semibold">Chế độ kỳ thi thử đang bật</p>
            <p className="mt-1">Học viên vào thi và xem điểm bình thường, nhưng điểm sẽ <strong>không</strong> được ghi vào hệ thống quản lý TTDT. Lớp và Mô-đun không bắt buộc.</p>
          </div>
        ) : (
          <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-sm">
            <p className="font-semibold">Bắt buộc cấu hình đầy đủ để ghi nhận điểm</p>
            <p className="mt-1">Kỳ thi chỉ đồng bộ điểm sang TTDT khi hội đủ 3 điều kiện:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>
                Mọi <strong>đề thi</strong> dùng trong kỳ đều đã gắn <strong>Mô-đun (module_id)</strong>.
                {titlesWithoutModule.length > 0 && <> Đề thiếu mô-đun: <strong>{titlesWithoutModule.join(', ')}</strong>.</>}
              </li>
              <li>
                Kỳ thi đã gắn đúng <strong>Lớp TTDT (class_id)</strong>.
                {!classId && ' (hiện chưa chọn lớp)'}
              </li>
              <li>
                Tài khoản thi của học viên đã có <strong>student_id</strong> (được xác thực từ CCCD) — phần này kiểm tra ở luồng thí sinh.
              </li>
            </ul>
            <p className="mt-1">
              Nếu thiếu một trong các thông tin trên, học viên nộp bài sẽ <strong>không được ghi nhận điểm trên TTDT</strong>.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <ExamPickerSection
            isEdit={isEdit}
            exams={exams}
            useMultiExams={useMultiExams}
            onUseMultiExamsChange={setUseMultiExams}
            examId={examId}
            onExamIdChange={setExamId}
            selectedExamIds={selectedExamIds}
            onSelectedExamIdsChange={setSelectedExamIds}
            titlesWithoutModule={titlesWithoutModule}
          />

          <TrialToggle isTrial={isTrial} onChange={setIsTrial} lockedAttempts={trialLockedAttempts} />

          <AiProctoringFieldset
            mode={proctoringMode}
            onModeChange={setProctoringMode}
            riskThreshold={aiRiskThreshold}
            onRiskThresholdChange={setAiRiskThreshold}
          />

          {!isTrial && <MaxAttemptsPicker value={maxAttempts} onChange={setMaxAttempts} />}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lớp (TTDT){!isTrial && ' *'}</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              required={!isTrial}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            >
              <option value="">— Chọn lớp —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {classes.length === 0 && <option value="" disabled>Chưa có lớp (cần bảng classes trong Supabase)</option>}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bắt đầu *</label>
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kết thúc *</label>
              <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mã truy cập *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                required
                placeholder="VD: A1B2 hoặc bấm nút tạo mã"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
              />
              <button
                type="button"
                onClick={() => setAccessCode(randomAccessCode(Math.random))}
                title="Tạo mã ngẫu nhiên 4 ký tự (chữ + số)"
                className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 hover:text-indigo-600 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Bấm biểu tượng xoay tròn để tạo mã 4 ký tự ngẫu nhiên.</p>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => navigate('/admin/windows')}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật kỳ thi' : 'Tạo kỳ thi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
