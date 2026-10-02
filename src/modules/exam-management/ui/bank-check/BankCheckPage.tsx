import { useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { BlueprintRule, QuestionBankItem } from '../../../../types';
import { blueprintCheck, simulateDraw } from '../../domain/bank-check';
import { useDrawFrequency, useExam, useModuleQuestions } from '../../queries/use-exam-management';
import { DifficultyBadge, DrawFreqBadge, QuestionPreviewModal, SimulateDrawModal } from './bank-check-parts';
import { BlueprintStatusPanel } from './BlueprintStatusPanel';
import { downloadBankCsv } from './download-bank-csv';

// Bank check page of an exam: the module's questions, the blueprint gap analysis, a simulated draw and a CSV export.

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BankCheckPage() {
  const { id: examId } = useParams<{ id: string }>();
  const examQuery = useExam(examId);
  const exam = examQuery.data ?? null;
  const questionsQuery = useModuleQuestions(exam?.module_id);
  const frequencyQuery = useDrawFrequency(exam?.module_id ? examId : undefined);
  const bankQuestions = useMemo(() => questionsQuery.data ?? [], [questionsQuery.data]);
  const drawFrequency = useMemo(() => frequencyQuery.data ?? {}, [frequencyQuery.data]);
  const loading = examQuery.isPending || (Boolean(exam?.module_id) && (questionsQuery.isPending || frequencyQuery.isPending));
  const failure = examQuery.error ?? questionsQuery.error;
  const error = failure ? (failure instanceof Error ? failure.message : 'Lỗi tải dữ liệu.') : '';
  const [filterTopic, setFilterTopic] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [previewQuestion, setPreviewQuestion] = useState<QuestionBankItem | null>(null);
  const [simulatedDraw, setSimulatedDraw] = useState<QuestionBankItem[] | null>(null);

  const blueprint = useMemo<BlueprintRule[]>(
    () => (Array.isArray(exam?.blueprint) ? (exam!.blueprint as BlueprintRule[]) : []),
    [exam],
  );

  const topics = useMemo(
    () => [...new Set(bankQuestions.map((q) => q.topic).filter(Boolean))].sort() as string[],
    [bankQuestions],
  );

  const filteredQuestions = useMemo(() => {
    return bankQuestions.filter((q) => {
      if (filterTopic && q.topic !== filterTopic) return false;
      if (filterDifficulty && q.difficulty !== filterDifficulty) return false;
      return true;
    });
  }, [bankQuestions, filterTopic, filterDifficulty]);

  const blueprintStatus = useMemo(
    () => blueprintCheck(bankQuestions, blueprint),
    [bankQuestions, blueprint],
  );

  const handleSimulate = useCallback(() => {
    if (!blueprint.length) return;
    setSimulatedDraw(simulateDraw(bankQuestions, blueprint, Math.random));
  }, [bankQuestions, blueprint]);

  const handleReroll = useCallback(() => {
    if (!blueprint.length) return;
    setSimulatedDraw(simulateDraw(bankQuestions, blueprint, Math.random));
  }, [bankQuestions, blueprint]);

  // ── Render guards ──────────────────────────────────────────────────────────

  if (loading || !examId) return <p className="text-slate-500 text-sm">Đang tải...</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!exam) return <p className="text-red-600 text-sm">Không tìm thấy đề thi.</p>;

  const hasModule = Boolean(exam.module_id);
  const totalDraws = Object.values(drawFrequency).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-4">
        <div className="min-w-0">
          <Link to={`/admin/exams/${examId}`} className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Đề thi
          </Link>
          <h1 className="text-xl font-semibold text-slate-800 truncate mt-1">{exam.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">Kiểm tra ngân hàng câu hỏi</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasModule && (
            <button
              type="button"
              onClick={() => downloadBankCsv(filteredQuestions, drawFrequency, exam.title)}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm"
              title="Xuất danh sách câu hỏi đang lọc ra CSV"
            >
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Xuất CSV
            </button>
          )}
          {blueprint.length > 0 && hasModule && (
            <button
              type="button"
              onClick={handleSimulate}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              title="Mô phỏng một lần bốc thăm câu hỏi theo blueprint"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Mô phỏng bốc thăm
            </button>
          )}
          <Link
            to="/admin/question-libraries"
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm"
            title="Mở ngân hàng câu hỏi"
          >
            <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Quản lý ngân hàng
          </Link>
        </div>
      </div>

      {/* Module info */}
      {!hasModule ? (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>
            Đề thi chưa gắn mô-đun. Vào{' '}
            <Link to={`/admin/exams/${examId}/edit`} className="underline font-medium">Sửa đề thi</Link>{' '}
            để chọn mô-đun — sau đó ngân hàng câu hỏi của mô-đun đó sẽ hiển thị ở đây.
          </span>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-xs">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>Mô-đun: <strong>{exam.module_id}</strong></span>
          <span className="text-sky-400">·</span>
          <span>{bankQuestions.length} câu trong ngân hàng</span>
          {totalDraws > 0 && (
            <>
              <span className="text-sky-400">·</span>
              <span>{totalDraws} lần bốc thăm tổng cộng</span>
            </>
          )}
        </div>
      )}

      {/* Blueprint / Gap analysis */}
        <BlueprintStatusPanel status={blueprintStatus} onFilter={(topic, difficulty) => { setFilterTopic(topic); setFilterDifficulty(difficulty); }} />

      {blueprint.length === 0 && hasModule && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>
            Đề thi chưa có blueprint ma trận. Vào{' '}
            <Link to={`/admin/exams/${examId}/edit`} className="underline font-medium">Sửa đề thi</Link>{' '}
            để cấu hình — blueprint xác định số câu bốc theo từng chủ đề/độ khó.
          </span>
        </div>
      )}

      {/* Filter toolbar */}
      {hasModule && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <span className="text-xs text-slate-500">Lọc:</span>
          </div>
          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="">Tất cả chủ đề</option>
            {topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="">Tất cả độ khó</option>
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
          {(filterTopic || filterDifficulty) && (
            <button
              type="button"
              onClick={() => { setFilterTopic(''); setFilterDifficulty(''); }}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Xóa lọc
            </button>
          )}
          <span className="text-xs text-slate-400 ml-auto">
            {filteredQuestions.length} / {bankQuestions.length} câu
          </span>
        </div>
      )}

      {/* Question list */}
      {!hasModule ? null : bankQuestions.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-sm font-medium">Ngân hàng câu hỏi của mô-đun này đang trống</p>
          <p className="text-xs mt-1">
            Vào{' '}
            <Link to="/admin/question-libraries" className="underline text-indigo-500">Quản lý ngân hàng</Link>{' '}
            để thêm câu hỏi.
          </p>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          Không có câu nào khớp với bộ lọc.{' '}
          <button type="button" onClick={() => { setFilterTopic(''); setFilterDifficulty(''); }} className="underline text-indigo-500">Xóa lọc</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredQuestions.map((q, idx) => {
            const drawCount = drawFrequency[q.id] ?? 0;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setPreviewQuestion(q)}
                className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-3 hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <span className="text-xs text-slate-300 pt-0.5 w-5 flex-shrink-0 group-hover:text-indigo-300">
                  #{idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 font-medium leading-snug">
                    {q.stem.slice(0, 140)}{q.stem.length > 140 ? '…' : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <DifficultyBadge difficulty={q.difficulty} />
                    {q.topic && (
                      <span className="text-[11px] text-slate-500 truncate max-w-[200px]" title={q.topic}>
                        {q.topic}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400">{q.points} điểm</span>
                    {drawCount > 0 && <DrawFreqBadge count={drawCount} />}
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <QuestionPreviewModal
        question={previewQuestion}
        frequency={drawFrequency}
        onClose={() => setPreviewQuestion(null)}
      />
      {simulatedDraw !== null && (
        <SimulateDrawModal
          drawn={simulatedDraw}
          blueprint={blueprint}
          onReroll={handleReroll}
          onClose={() => setSimulatedDraw(null)}
        />
      )}
    </div>
  );
}
