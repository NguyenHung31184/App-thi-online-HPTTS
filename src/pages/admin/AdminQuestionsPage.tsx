import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getExam } from '../../services/examService';
import { listQuestionsByExam, deleteQuestion, deleteQuestionsBulk, generateQuestionsFromBankForExam } from '../../services/questionService';
import type { Exam, BlueprintRule, Question } from '../../types';
import ConfirmationModal from '../../components/ConfirmationModal';

export default function AdminQuestionsPage() {
  const { id: examId } = useParams<{ id: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteBulk, setConfirmDeleteBulk] = useState(false);

  const load = async () => {
    if (!examId) return;
    setLoading(true);
    setError('');
    try {
      const [examData, list] = await Promise.all([
        getExam(examId),
        listQuestionsByExam(examId),
      ]);
      setExam(examData ?? null);
      setQuestions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [examId]);

  const handleDelete = async (qId: string) => {
    setConfirmDeleteId(qId);
  };

  const doDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      setDeleting(true);
      await deleteQuestion(confirmDeleteId);
      setQuestions((prev) => prev.filter((q) => q.id !== confirmDeleteId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(confirmDeleteId);
        return next;
      });
      setConfirmDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const visibleIds = questions.map((q) => q.id);
      const allSelected = visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });
  };

  const handleDeleteSelected = () => {
    if (!questions.some((q) => selectedIds.has(q.id))) return;
    setConfirmDeleteBulk(true);
  };

  const doDeleteBulk = async () => {
    const ids = questions.filter((q) => selectedIds.has(q.id)).map((q) => q.id);
    if (!ids.length) {
      setConfirmDeleteBulk(false);
      return;
    }
    try {
      setDeleting(true);
      await deleteQuestionsBulk(ids);
      setQuestions((prev) => prev.filter((q) => !selectedIds.has(q.id)));
      setSelectedIds(new Set());
      setConfirmDeleteBulk(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa hàng loạt.');
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateFromBank = async () => {
    if (!examId || !exam) return;
    setGenerateMessage('');
    const blueprint = Array.isArray(exam.blueprint)
      ? (exam.blueprint as BlueprintRule[])
      : [];
    if (!blueprint.length) {
      setGenerateMessage('Đề thi chưa có ma trận blueprint. Hãy cấu hình ma trận trong màn Sửa đề thi (topic + độ khó + số câu).');
      return;
    }
    setConfirmGenerate(true);
  };

  const doGenerateFromBank = async () => {
    if (!examId || !exam) return;
    const blueprint = Array.isArray(exam.blueprint)
      ? (exam.blueprint as BlueprintRule[])
      : [];
    setGenerating(true);
    try {
      const res = await generateQuestionsFromBankForExam({
        examId,
        blueprint,
      });
      setConfirmGenerate(false);
      if (res.created > 0) {
        setGenerateMessage(`Đã sinh ${res.created} câu hỏi từ ngân hàng.`);
        await load();
      } else {
        setGenerateMessage(res.errors[0] ?? 'Không sinh được câu hỏi nào từ ngân hàng.');
      }
      if (res.errors.length > 1) {
        console.warn('generateQuestionsFromBankForExam errors:', res.errors);
      }
    } catch (e) {
      setGenerateMessage(e instanceof Error ? e.message : 'Lỗi sinh câu hỏi từ ngân hàng.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading || !examId) return <p className="text-slate-500">Đang tải...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!exam) return <p className="text-red-600">Không tìm thấy đề thi.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link to={`/admin/exams/${examId}`} className="text-slate-500 hover:text-slate-700 text-sm">← Đề thi</Link>
          <h1 className="text-xl font-semibold text-slate-800 mt-1">Câu hỏi: {exam.title}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Mẹo: gắn Mô-đun cho đề + cấu hình ma trận đề, sau đó dùng nút "Sinh từ ngân hàng" để tự động lấy câu hỏi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateFromBank}
            disabled={generating}
            className="px-3 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm disabled:opacity-50"
          >
            {generating ? 'Đang sinh...' : 'Sinh từ ngân hàng'}
          </button>
          <Link
            to={`/admin/exams/${examId}/questions/new`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
          >
            Thêm câu hỏi
          </Link>
          <Link
            to={`/admin/exams/${examId}/questions/import`}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
          >
            Import từ Excel
          </Link>
        </div>
      </div>

      {generateMessage && (
        <p className="mb-4 text-sm text-slate-600">
          {generateMessage}
        </p>
      )}

      <div className="space-y-3">
        {questions.length === 0 ? (
          <p className="text-slate-500">Chưa có câu hỏi. Thêm câu hỏi trắc nghiệm một đáp án.</p>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <button
                  type="button"
                  onClick={toggleSelectAllVisible}
                  className="px-2 py-1 border border-slate-300 rounded text-xs hover:bg-slate-50"
                >
                  {questions.every((q) => selectedIds.has(q.id)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
                <span>
                  Đang chọn{' '}
                  <strong>{questions.filter((q) => selectedIds.has(q.id)).length}</strong> / {questions.length} câu hỏi
                </span>
              </div>
              <button
                type="button"
                disabled={!questions.some((q) => selectedIds.has(q.id))}
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 rounded bg-red-50 text-red-700 border border-red-200 text-xs disabled:opacity-40 disabled:cursor-not-allowed hover:bg-red-100"
              >
                Xóa các câu đã chọn
              </button>
            </div>

            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white border border-slate-200 rounded-lg p-4 flex justify-between items-start"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 text-indigo-600 border-slate-300 rounded"
                    checked={selectedIds.has(q.id)}
                    onChange={() => toggleSelectOne(q.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800">
                      Câu {idx + 1}. {q.stem.slice(0, 120)}{q.stem.length > 120 ? '...' : ''}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Chủ đề: {q.topic || '—'} | Độ khó: {q.difficulty} | Điểm: {q.points}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 ml-2">
                  <Link
                    to={`/admin/exams/${examId}/questions/${q.id}`}
                    className="text-indigo-600 hover:underline text-sm"
                  >
                    Sửa
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    className="text-red-600 hover:underline text-sm"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <ConfirmationModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={doDelete}
        title="Xóa câu hỏi"
        isLoading={deleting}
        confirmText="Xóa"
      >
        Xóa câu hỏi này khỏi đề thi?
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={confirmDeleteBulk}
        onClose={() => setConfirmDeleteBulk(false)}
        onConfirm={doDeleteBulk}
        title="Xóa nhiều câu hỏi"
        isLoading={deleting}
        confirmText="Xóa"
      >
        Xóa {questions.filter((q) => selectedIds.has(q.id)).length} câu hỏi đã chọn khỏi đề thi? Thao tác này không thể hoàn tác.
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={confirmGenerate}
        onClose={() => setConfirmGenerate(false)}
        onConfirm={doGenerateFromBank}
        title="Sinh từ ngân hàng"
        confirmColor="primary"
        isLoading={generating}
        confirmText="Sinh câu hỏi"
      >
        Sinh câu hỏi từ ngân hàng theo mô-đun và ma trận của đề? Các câu mới sẽ được thêm vào cuối danh sách hiện tại.
      </ConfirmationModal>
    </div>
  );
}
