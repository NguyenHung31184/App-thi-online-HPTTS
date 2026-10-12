import { useExamIntro } from '../../queries/use-exam-intro';
import { ExamRules } from './ExamRules';

/** Rules for an attempt that already exists (an old link or a reload); new attempts agree before they are created. */
export default function ExamIntroPage() {
  const {
    handleStart, confirmed, loading, error, attempt, exam, setConfirmed,
  } = useExamIntro();
  if (loading) return <p className="p-4 text-slate-500">Đang tải...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;
  if (!attempt || !exam) return null;

  return (
    <ExamRules
      examTitle={exam.title}
      rules={{ durationMinutes: exam.duration_minutes, totalQuestions: exam.total_questions, passThreshold: exam.pass_threshold }}
      confirmed={confirmed}
      onConfirmedChange={setConfirmed}
      onStart={handleStart}
    />
  );
}
