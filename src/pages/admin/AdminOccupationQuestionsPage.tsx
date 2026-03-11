import { useEffect, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getOccupation } from '../../services/occupationService';
import {
  listQuestionsByOccupation,
  listQuestionsWithoutModule,
  deleteQuestionBankItem,
  deleteQuestionBankItemsBulk,
} from '../../services/questionBankService';
import type { Occupation, QuestionBankItem, ModuleItem } from '../../types';
import { listModulesByOccupationId } from '../../services/ttdtDataService';
import ConfirmationModal from '../../components/ConfirmationModal';

/** Giá trị đặc biệt trong dropdown: hiển thị câu hỏi chưa gắn mô-đun (lang thang) để có thể xóa. */
const NO_MODULE_ID = '__no_module__';

export default function AdminOccupationQuestionsPage() {
  const { occupationId } = useParams<{ occupationId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [occupation, setOccupation] = useState<Occupation | null>(null);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteOne, setConfirmDeleteOne] = useState<{ id: string } | null>(null);
  const [confirmDeleteBulk, setConfirmDeleteBulk] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async (moduleId: string | null) => {
    if (!occupationId) return;
    setLoading(true);
    setError('');
    try {
      const [occ, list] = await Promise.all([
        getOccupation(occupationId),
        moduleId === NO_MODULE_ID
          ? listQuestionsWithoutModule(occupationId)
          : listQuestionsByOccupation(occupationId, moduleId || undefined),
      ]);
      setOccupation(occ ?? null);
      setQuestions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!occupationId) return;
    const params = new URLSearchParams(location.search);
    const mId = params.get('moduleId');
    setSelectedModuleId(mId || null);
    load(mId === NO_MODULE_ID ? NO_MODULE_ID : mId);
  }, [occupationId, location.search]);

  useEffect(() => {
    if (!occupationId) return;
    let cancelled = false;
    listModulesByOccupationId(occupationId)
      .then((list) => {
        if (cancelled) return;
        setModules(list);
      })
      .catch(() => {
        if (cancelled) return;
        setModules([]);
      });
    return () => {
      cancelled = true;
    };
  }, [occupationId]);

  const handleDelete = async (qId: string) => {
    setConfirmDeleteOne({ id: qId });
  };

  const doDeleteOne = async () => {
    if (!confirmDeleteOne) return;
    try {
      setDeleting(true);
      await deleteQuestionBankItem(confirmDeleteOne.id);
      setQuestions((prev) => prev.filter((q) => q.id !== confirmDeleteOne.id));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(confirmDeleteOne.id);
        return next;
      });
      setConfirmDeleteOne(null);
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

  const handleDeleteSelected = async () => {
    const ids = questions.map((q) => q.id).filter((id) => selectedIds.has(id));
    if (!ids.length) return;
    setConfirmDeleteBulk(true);
  };

  const doDeleteBulk = async () => {
    const ids = questions.map((q) => q.id).filter((id) => selectedIds.has(id));
    if (!ids.length) {
      setConfirmDeleteBulk(false);
      return;
    }
    try {
      setDeleting(true);
      await deleteQuestionBankItemsBulk(ids);
      setQuestions((prev) => prev.filter((q) => !selectedIds.has(q.id)));
      setSelectedIds(new Set());
      setConfirmDeleteBulk(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa hàng loạt.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !occupationId) return <p className="text-slate-500">Đang tải...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!occupation) return <p className="text-red-600">Không tìm thấy nghề đào tạo.</p>;

  const handleModuleChange = (mId: string) => {
    const params = new URLSearchParams(location.search);
    if (mId) {
      params.set('moduleId', mId);
    } else {
      params.delete('moduleId');
    }
    navigate({ pathname: `/admin/questions/occupation/${occupationId}`, search: params.toString() ? `?${params.toString()}` : '' });
  };

  const isNoModuleView = selectedModuleId === NO_MODULE_ID;
  const canAddOrImport = selectedModuleId && selectedModuleId !== NO_MODULE_ID;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link to="/admin/questions" className="text-slate-500 hover:text-slate-700 text-sm">← Soạn câu hỏi</Link>
          <h1 className="text-xl font-semibold text-slate-800 mt-1">Ngân hàng câu hỏi: {occupation.name}</h1>
          <p className="text-sm text-slate-600 mt-1">
            Bước 1: chọn <strong>mô-đun</strong> thuộc nghề này. Bước 2: soạn/import câu hỏi cho mô-đun đó.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={selectedModuleId ?? ''}
            onChange={(e) => handleModuleChange(e.target.value || '')}
          >
            <option value="">-- Chọn mô-đun --</option>
            <option value={NO_MODULE_ID}>— Câu chưa gắn mô-đun (lang thang) —</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.code ? `${m.code} — ${m.name}` : m.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Link
              to={`/admin/questions/occupation/${occupationId}/new${selectedModuleId && selectedModuleId !== NO_MODULE_ID ? `?moduleId=${selectedModuleId}` : ''}`}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm disabled:opacity-50"
              onClick={(e) => {
                if (!canAddOrImport) {
                  e.preventDefault();
                  toast.info(
                    isNoModuleView
                      ? 'Đây là danh sách câu lang thang. Chọn mô-đun cụ thể ở trên để thêm/import câu hỏi.'
                      : 'Hãy chọn mô-đun trước khi thêm câu hỏi.'
                  );
                }
              }}
            >
              Thêm câu hỏi
            </Link>
            <Link
              to={`/admin/questions/occupation/${occupationId}/import${selectedModuleId && selectedModuleId !== NO_MODULE_ID ? `?moduleId=${selectedModuleId}` : ''}`}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"
              onClick={(e) => {
                if (!canAddOrImport) {
                  e.preventDefault();
                  toast.info(
                    isNoModuleView
                      ? 'Đây là danh sách câu lang thang. Chọn mô-đun cụ thể để import.'
                      : 'Hãy chọn mô-đun trước khi import từ Excel.'
                  );
                }
              }}
            >
              Import từ Excel
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {!selectedModuleId && (
          <p className="text-slate-500 text-sm">
            Vui lòng chọn mô-đun ở góc phải trên để xem và soạn câu hỏi.
          </p>
        )}
        {selectedModuleId === NO_MODULE_ID && (
          <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
            <strong>Câu hỏi chưa gắn mô-đun (lang thang)</strong> — Các câu này thuộc nghề nhưng không gắn mô-đun nào.
            Bạn có thể chọn từng câu hoặc <strong>Chọn tất cả</strong> rồi bấm <strong>Xóa các câu đã chọn</strong> để dọn dẹp.
          </p>
        )}
        {selectedModuleId && selectedModuleId !== NO_MODULE_ID && questions.length === 0 && (
          <p className="text-slate-500">
            Mô-đun này chưa có câu hỏi. Bấm "Thêm câu hỏi" hoặc "Import từ Excel".
          </p>
        )}
        {isNoModuleView && questions.length === 0 && (
          <p className="text-slate-500">
            Không có câu hỏi nào chưa gắn mô-đun trong nghề này.
          </p>
        )}
        {selectedModuleId && questions.length > 0 && (
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
                  <strong>
                    {questions.filter((q) => selectedIds.has(q.id)).length}
                  </strong>{' '}
                  / {questions.length} câu hỏi
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
                      Câu {idx + 1}. {q.stem.slice(0, 120)}
                      {q.stem.length > 120 ? '...' : ''}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      Chủ đề: {q.topic || '—'} | Độ khó: {q.difficulty} | Điểm: {q.points}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 ml-2">
                  <Link
                    to={`/admin/questions/occupation/${occupationId}/questions/${q.id}${
                      selectedModuleId && selectedModuleId !== NO_MODULE_ID ? `?moduleId=${selectedModuleId}` : ''
                    }`}
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
        isOpen={!!confirmDeleteOne}
        onClose={() => setConfirmDeleteOne(null)}
        onConfirm={doDeleteOne}
        title="Xóa câu hỏi"
        isLoading={deleting}
        confirmText="Xóa"
      >
        Xóa câu hỏi này khỏi ngân hàng?
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={confirmDeleteBulk}
        onClose={() => setConfirmDeleteBulk(false)}
        onConfirm={doDeleteBulk}
        title="Xóa nhiều câu hỏi"
        isLoading={deleting}
        confirmText="Xóa"
      >
        Xóa {questions.filter((q) => selectedIds.has(q.id)).length} câu hỏi đã chọn khỏi ngân hàng?
        Thao tác này không thể hoàn tác.
      </ConfirmationModal>
    </div>
  );
}
