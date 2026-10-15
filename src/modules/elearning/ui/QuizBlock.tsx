import { useState } from 'react';
import type { AssignedBlock, AssignedQuizAttempt } from '../domain/assigned-learning';
import {
  answersPayload, emptyResponse, formatPercent, quizErrorMessage, quizState, setStatement, toggleChoice, unansweredCount,
  DEFAULT_MAX_ATTEMPTS, DEFAULT_PASS_PERCENT, type QuizAnswers, type QuizQuestion, type QuizResult,
} from '../domain/quiz';
import { useSubmitQuiz } from '../queries/use-assigned-learning';

interface Props {
  userId: string;
  enrollmentId: string;
  assignmentId: string;
  block: AssignedBlock;
  attempts: AssignedQuizAttempt[];
  onPassed: () => void;
}

const choiceClass = (selected: boolean) =>
  `flex min-h-[44px] w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left text-sm ${selected ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-white text-slate-800 hover:border-indigo-300'}`;

function QuestionView({ question, index, value, onChange }: {
  question: QuizQuestion; index: number; value: QuizAnswers[string] | undefined; onChange: (value: QuizAnswers[string]) => void;
}) {
  const name = `q-${question.id}`;
  return (
    <fieldset className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
      <legend className="sr-only">Câu {index + 1}</legend>
      <p className="text-sm font-semibold text-slate-900">Câu {index + 1}. <span className="font-normal whitespace-pre-wrap">{question.stem}</span></p>
      {question.image_url && <img src={question.image_url} alt={`Hình của câu ${index + 1}`} className="max-h-64 rounded-lg border border-slate-200" />}
      {question.question_type === 'single_choice' && question.options.map((option) => (
        <label key={option.id} className={choiceClass(value === option.id)}>
          <input type="radio" name={name} checked={value === option.id} onChange={() => onChange(option.id)} className="mt-0.5 h-4 w-4" />
          <span><strong>{option.id}.</strong> {option.text}</span>
        </label>
      ))}
      {question.question_type === 'multiple_choice' && (
        <>
          <p className="text-xs text-slate-600">Chọn tất cả phương án đúng.</p>
          {question.options.map((option) => {
            const checked = Array.isArray(value) && (value as string[]).includes(option.id);
            return (
              <label key={option.id} className={choiceClass(checked)}>
                <input type="checkbox" checked={checked} onChange={() => onChange(toggleChoice(value, option.id))} className="mt-0.5 h-4 w-4" />
                <span><strong>{option.id}.</strong> {option.text}</span>
              </label>
            );
          })}
        </>
      )}
      {question.question_type === 'true_false_multi' && (
        <>
          <p className="text-xs text-slate-600">Đánh dấu Đúng hoặc Sai cho từng ý.</p>
          {question.options.map((option, optionIndex) => {
            const current = Array.isArray(value) ? (value as string[])[optionIndex] : '';
            return (
              <div key={option.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <span className="min-w-0 flex-1 text-sm text-slate-800"><strong>{option.id}.</strong> {option.text}</span>
                {(['T', 'F'] as const).map((choice) => (
                  <label key={choice} className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 text-sm ${current === choice ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-300 text-slate-700'}`}>
                    <input type="radio" name={`${name}-${option.id}`} checked={current === choice} onChange={() => onChange(setStatement(question, value, optionIndex, choice))} className="h-4 w-4" />
                    {choice === 'T' ? 'Đúng' : 'Sai'}
                  </label>
                ))}
              </div>
            );
          })}
        </>
      )}
    </fieldset>
  );
}

/**
 * Bài kiểm tra cuối bài. Học viên chọn đáp án rồi nộp; máy chủ chấm và chỉ trả số câu đúng, điểm, đạt hay chưa.
 * Đạt thì khối được tính hoàn thành; chưa đạt thì làm lại nếu còn lượt.
 */
export function QuizBlock({ userId, enrollmentId, assignmentId, block, attempts, onPassed }: Props) {
  const questions = block.questions ?? [];
  const maxAttempts = block.quiz_max_attempts ?? DEFAULT_MAX_ATTEMPTS;
  const passPercent = Number(block.quiz_pass_percent ?? DEFAULT_PASS_PERCENT);
  const [answers, setAnswers] = useState<QuizAnswers>(() => Object.fromEntries(questions.map((q) => [q.id, emptyResponse(q)])));
  const [last, setLast] = useState<QuizResult | null>(null);
  const [error, setError] = useState('');
  const [confirmPartial, setConfirmPartial] = useState(false);
  const submit = useSubmitQuiz(userId);
  const own = attempts.filter((a) => a.assignment_id === assignmentId && a.block_id === block.id);
  const state = quizState(own, maxAttempts);
  const missing = unansweredCount(questions, answers);

  const send = async () => {
    setError('');
    if (missing > 0 && !confirmPartial) { setConfirmPartial(true); return; }
    try {
      const result = await submit.mutateAsync({ enrollmentId, assignmentId, blockId: block.id, answers: answersPayload(questions, answers) });
      setLast(result);
      setConfirmPartial(false);
      if (result.passed) onPassed();
      else setAnswers(Object.fromEntries(questions.map((q) => [q.id, emptyResponse(q)])));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (reason) {
      setError(quizErrorMessage(reason));
    }
  };

  if (questions.length === 0) return <p role="alert" className="text-sm text-red-700">Bài kiểm tra chưa có câu hỏi. Báo giảng viên.</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p><strong>{questions.length}</strong> câu. Đạt khi đúng từ <strong>{formatPercent(passPercent)}</strong> số điểm. Được làm <strong>{maxAttempts}</strong> lượt; đã làm {state.attemptsUsed}.</p>
        {state.bestPercent !== null && <p className="mt-1">Điểm cao nhất: <strong>{formatPercent(state.bestPercent)}</strong>.</p>}
      </div>

      {last && (
        <div role="status" className={`rounded-2xl border p-4 text-sm ${last.passed ? 'border-green-300 bg-green-50 text-green-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
          <p className="font-semibold">{last.passed ? 'Bạn đã đạt bài kiểm tra.' : 'Chưa đạt.'} Lượt {last.attempt_no}: đúng {last.correct_count}/{last.total_count} câu, được {formatPercent(last.score_percent)}.</p>
          {!last.passed && <p className="mt-1">{last.attempt_no < last.max_attempts ? `Còn ${last.max_attempts - last.attempt_no} lượt. Xem lại nội dung bài rồi làm lại.` : 'Bạn đã dùng hết lượt. Liên hệ giảng viên.'}</p>}
        </div>
      )}

      {state.passed ? (
        !last && <p className="rounded-2xl border border-green-300 bg-green-50 p-4 text-sm text-green-900">Bạn đã đạt bài kiểm tra này.</p>
      ) : !state.canSubmit ? (
        !last && <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">Bạn đã dùng hết {maxAttempts} lượt mà chưa đạt. Liên hệ giảng viên.</p>
      ) : (
        <>
          {questions.map((question, index) => (
            <QuestionView key={question.id} question={question} index={index} value={answers[question.id]}
              onChange={(value) => { setAnswers((prev) => ({ ...prev, [question.id]: value })); setConfirmPartial(false); }} />
          ))}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {confirmPartial && missing > 0 && (
            <p role="alert" className="text-sm text-amber-900">Còn {missing} câu chưa trả lời; câu bỏ trống tính là sai. Bấm "Nộp bài" lần nữa nếu vẫn muốn nộp.</p>
          )}
          <button type="button" disabled={submit.isPending} onClick={() => void send()} className="min-h-[44px] rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-indigo-600">
            {submit.isPending ? 'Đang chấm...' : `Nộp bài (lượt ${state.attemptsUsed + 1}/${maxAttempts})`}
          </button>
        </>
      )}
    </div>
  );
}
