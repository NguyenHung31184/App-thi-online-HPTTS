import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getExam } from '../../services/examService';
import { listQuestionsByModule, getQuestionDrawFrequency } from '../../services/questionBankService';
import type { Exam, BlueprintRule, QuestionBankItem } from '../../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeBlueprintStatus(questions: QuestionBankItem[], blueprint: BlueprintRule[]) {
  if (!blueprint.length) return null;
  const byTopicDiff: Record<string, number> = {};
  const byDiff: Record<string, number> = {};
  const byTopic: Record<string, number> = {};
  const total = questions.length;
  for (const q of questions) {
    const t = q.topic || '';
    const d = q.difficulty || '';
    byTopicDiff[`${t}|${d}`] = (byTopicDiff[`${t}|${d}`] ?? 0) + 1;
    byDiff[d] = (byDiff[d] ?? 0) + 1;
    byTopic[t] = (byTopic[t] ?? 0) + 1;
  }
  return blueprint.map((rule) => {
    const topic = rule.topic ?? '';
    const difficulty = rule.difficulty ?? '';
    const have =
      topic === '*' && difficulty === '*' ? total
        : topic === '*' ? (byDiff[difficulty] ?? 0)
          : difficulty === '*' ? (byTopic[topic] ?? 0)
            : (byTopicDiff[`${topic}|${difficulty}`] ?? 0);
    return { rule, have, ok: have >= rule.count };
  });
}

function simulateDraw(questions: QuestionBankItem[], blueprint: BlueprintRule[]): QuestionBankItem[] {
  const usedIds = new Set<string>();
  const result: QuestionBankItem[] = [];
  for (const rule of blueprint) {
    const pool = questions.filter((q) => {
      if (usedIds.has(q.id)) return false;
      if (rule.topic !== '*' && q.topic !== rule.topic) return false;
      if (rule.difficulty !== '*' && q.difficulty !== rule.difficulty) return false;
      return true;
    });
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    shuffled.slice(0, rule.count).forEach((q) => { result.push(q); usedIds.add(q.id); });
  }
  return result;
}

function exportCsv(questions: QuestionBankItem[], frequency: Record<string, number>, examTitle: string) {
  const header = ['#', 'Câu hỏi', 'Chủ đề', 'Độ khó', 'Điểm', 'Số lần bốc'];
  const rows = questions.map((q, i) => {
    const opts = Array.isArray(q.options) ? (q.options as { id: string; text: string }[]) : [];
    const correctOpt = opts.find((o) => o.id === q.answer_key);
    return [
      String(i + 1),
      q.stem,
      q.topic || '',
      q.difficulty,
      String(q.points),
      String(frequency[q.id] ?? 0),
      correctOpt?.text ?? q.answer_key,
    ];
  });
  const allRows = [
    [...header, 'Đáp án đúng'],
    ...rows,
  ];
  const csv = allRows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ngan-hang-${examTitle.slice(0, 30).replace(/\s+/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const DIFFICULTY_BADGE: Record<string, { label: string; cls: string }> = {
  easy:   { label: 'Dễ',        cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  medium: { label: 'Trung bình', cls: 'bg-amber-100   text-amber-700   border-amber-200' },
  hard:   { label: 'Khó',       cls: 'bg-red-100     text-red-700     border-red-200' },
};

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const cfg = DIFFICULTY_BADGE[difficulty] ?? { label: difficulty, cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function DrawFreqBadge({ count }: { count: number }) {
  if (count === 0) return null;
  const cls =
    count >= 10 ? 'bg-orange-100 text-orange-700 border-orange-200' :
    count >= 5  ? 'bg-amber-100  text-amber-700  border-amber-200'  :
                  'bg-slate-100  text-slate-500  border-slate-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${cls}`}>
      {count} lần bốc
    </span>
  );
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

function QuestionPreviewModal({
  question,
  frequency,
  onClose,
}: {
  question: QuestionBankItem | null;
  frequency: Record<string, number>;
  onClose: () => void;
}) {
  if (!question) return null;
  const opts = Array.isArray(question.options) ? (question.options as { id: string; text: string }[]) : [];
  const drawCount = frequency[question.id] ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <DifficultyBadge difficulty={question.difficulty} />
            {question.topic && (
              <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{question.topic}</span>
            )}
            <span className="text-[11px] text-slate-400">{question.points} điểm</span>
            {drawCount > 0 && <DrawFreqBadge count={drawCount} />}
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 ml-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">
          {question.image_url && (
            <img src={question.image_url} alt="" className="mb-3 rounded-lg max-h-40 object-contain w-full border border-slate-100" />
          )}
          <p className="text-sm font-medium text-slate-800 leading-relaxed mb-4">{question.stem}</p>
          <div className="space-y-2">
            {opts.map((opt) => {
              const isCorrect = opt.id === question.answer_key;
              return (
                <div
                  key={opt.id}
                  className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-sm ${
                    isCorrect
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  {isCorrect && (
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span>{opt.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Simulate Draw Modal ───────────────────────────────────────────────────────

function SimulateDrawModal({
  drawn,
  blueprint,
  onReroll,
  onClose,
}: {
  drawn: QuestionBankItem[];
  blueprint: BlueprintRule[];
  onReroll: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <div>
            <p className="font-semibold text-slate-800">Mô phỏng bốc thăm</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {drawn.length} câu — theo blueprint {blueprint.map((r) => `${r.count} ${r.topic === '*' ? '' : r.topic}`).join(' + ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReroll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 text-indigo-600 hover:bg-indigo-50 text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Bốc lại
            </button>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="overflow-y-auto px-5 py-3 space-y-1.5">
          {drawn.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Không bốc được câu nào — ngân hàng thiếu câu theo blueprint.</p>
          ) : (
            drawn.map((q, idx) => (
              <div key={q.id} className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
                <span className="text-xs text-slate-400 w-5 flex-shrink-0 pt-0.5">#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 leading-snug">{q.stem.slice(0, 100)}{q.stem.length > 100 ? '…' : ''}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <DifficultyBadge difficulty={q.difficulty} />
                    {q.topic && <span className="text-[10px] text-slate-400">{q.topic}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminQuestionsPage() {
  const { id: examId } = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [bankQuestions, setBankQuestions] = useState<QuestionBankItem[]>([]);
  const [drawFrequency, setDrawFrequency] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [previewQuestion, setPreviewQuestion] = useState<QuestionBankItem | null>(null);
  const [simulatedDraw, setSimulatedDraw] = useState<QuestionBankItem[] | null>(null);

  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setError('');
    try {
      const examData = await getExam(examId);
      setExam(examData ?? null);
      if (examData?.module_id) {
        const [bankData, freq] = await Promise.all([
          listQuestionsByModule(examData.module_id),
          getQuestionDrawFrequency(examId),
        ]);
        setBankQuestions(bankData);
        setDrawFrequency(freq);
      } else {
        setBankQuestions([]);
        setDrawFrequency({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => { load(); }, [load]);

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
    () => computeBlueprintStatus(bankQuestions, blueprint),
    [bankQuestions, blueprint],
  );
  const blueprintAllOk = blueprintStatus ? blueprintStatus.every((s) => s.ok) : true;

  const handleSimulate = useCallback(() => {
    if (!blueprint.length) return;
    setSimulatedDraw(simulateDraw(bankQuestions, blueprint));
  }, [bankQuestions, blueprint]);

  const handleReroll = useCallback(() => {
    if (!blueprint.length) return;
    setSimulatedDraw(simulateDraw(bankQuestions, blueprint));
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
              onClick={() => exportCsv(filteredQuestions, drawFrequency, exam.title)}
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
            to="/admin/questions"
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 text-sm"
            title="Quản lý ngân hàng câu hỏi theo nghề"
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
      {blueprintStatus && blueprintStatus.length > 0 && (
        <div className={`mb-4 rounded-xl border p-3 text-sm ${blueprintAllOk ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            {blueprintAllOk ? (
              <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <p className={`font-semibold ${blueprintAllOk ? 'text-emerald-800' : 'text-red-800'}`}>
              Kiểm tra blueprint — {blueprintAllOk ? 'Ngân hàng đủ câu' : 'Ngân hàng thiếu câu'}
            </p>
          </div>
          <div className="space-y-1.5">
            {blueprintStatus.map((s, i) => {
              const topicLabel = s.rule.topic === '*' ? 'Tất cả chủ đề' : (s.rule.topic || '—');
              const diffLabel  = s.rule.difficulty === '*' ? 'mọi độ khó' : s.rule.difficulty;
              const gap = s.rule.count - s.have;
              return (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold ${s.ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    {s.ok ? '✓' : '!'}
                  </span>
                  <span className="text-slate-700 text-xs flex-1">
                    {topicLabel} / {diffLabel}:{' '}
                    <span className={`font-semibold ${s.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                      Có {s.have} câu, cần {s.rule.count}
                    </span>
                    {!s.ok && (
                      <span className="text-red-600 font-bold"> → thiếu {gap} câu</span>
                    )}
                  </span>
                  {!s.ok && s.rule.topic !== '*' && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterTopic(s.rule.topic === '*' ? '' : s.rule.topic);
                        setFilterDifficulty(s.rule.difficulty === '*' ? '' : s.rule.difficulty);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-red-300 text-red-600 hover:bg-red-100 flex-shrink-0"
                    >
                      Lọc ngay
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {!blueprintAllOk && (
            <p className="mt-2 text-xs text-red-600">
              Thêm câu hỏi vào ngân hàng trước khi mở kỳ thi — vào{' '}
              <Link to="/admin/questions" className="underline font-medium">Quản lý ngân hàng</Link>.
            </p>
          )}
        </div>
      )}

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
            <Link to="/admin/questions" className="underline text-indigo-500">Quản lý ngân hàng</Link>{' '}
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
