import { useEffect, useState } from 'react';
import type { PracticalExamCriteria } from '../../../../types';
import ConfirmationModal from '../../../../shared/ui/ConfirmationModal';
import { useAddCriterion, useCriteria, useDeleteCriterion, useUpdateCriterion } from '../../queries/use-practical-exams';

/** Criteria of a saved template; every change is saved as it is typed. */
export function CriteriaEditor({ templateId, onError }: { templateId: string; onError: (message: string) => void }) {
  const saved = useCriteria(templateId).data;
  const [criteria, setCriteria] = useState<PracticalExamCriteria[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const add = useAddCriterion();
  const update = useUpdateCriterion();
  const remove = useDeleteCriterion();

  useEffect(() => {
    if (saved) setCriteria(saved);
  }, [saved]);

  const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

  const handleAdd = () => {
    onError('');
    add.mutate({ templateId, count: criteria.length }, {
      onSuccess: (c) => setCriteria((prev) => [...prev, c]),
      onError: (err) => onError(errorText(err, 'Lỗi thêm tiêu chí.')),
    });
  };

  const handleUpdate = (id: string, updates: Partial<PracticalExamCriteria>) => {
    update.mutate({ id, input: updates }, {
      onSuccess: () => setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c))),
      onError: (err) => onError(errorText(err, 'Lỗi cập nhật tiêu chí.')),
    });
  };

  const doDelete = () => {
    if (!confirmDeleteId) return;
    remove.mutate(confirmDeleteId, {
      onSuccess: () => {
        setCriteria((prev) => prev.filter((c) => c.id !== confirmDeleteId));
        setConfirmDeleteId(null);
      },
      onError: (err) => onError(errorText(err, 'Lỗi xóa tiêu chí.')),
    });
  };

  return (
    <div className="border-t border-slate-200 pt-6">
      <h2 className="text-lg font-medium text-slate-800 mb-2">Tiêu chí chấm</h2>
      <p className="text-slate-600 text-sm mb-4">
        Mỗi tiêu chí có thang điểm (max_score), hệ số (weight). GV chấm bằng thanh trượt 0 – max_score.
      </p>
      <button type="button" onClick={handleAdd} className="mb-4 px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 text-sm">
        + Thêm tiêu chí
      </button>
      <ul className="space-y-3">
        {criteria.map((c, idx) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-lg">
            <span className="font-medium text-slate-700 w-8">{idx + 1}.</span>
            <input
              type="text"
              value={c.name}
              onChange={(e) => handleUpdate(c.id, { name: e.target.value })}
              className="flex-1 min-w-[120px] border border-slate-300 rounded px-2 py-1"
              placeholder="Tên tiêu chí"
            />
            <label className="flex items-center gap-1 text-sm">
              <span>Điểm tối đa:</span>
              <input
                type="number"
                min={1}
                max={100}
                value={c.max_score}
                onChange={(e) => handleUpdate(c.id, { max_score: Number(e.target.value) })}
                className="w-16 border border-slate-300 rounded px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-1 text-sm">
              <span>Hệ số:</span>
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={c.weight}
                onChange={(e) => handleUpdate(c.id, { weight: Number(e.target.value) })}
                className="w-16 border border-slate-300 rounded px-2 py-1"
              />
            </label>
            <input
              type="text"
              value={c.description ?? ''}
              onChange={(e) => handleUpdate(c.id, { description: e.target.value })}
              className="w-48 border border-slate-300 rounded px-2 py-1 text-sm"
              placeholder="Mô tả (gợi ý GV)"
            />
            <button type="button" onClick={() => setConfirmDeleteId(c.id)} className="text-red-600 text-sm hover:underline">
              Xóa
            </button>
          </li>
        ))}
      </ul>

      <ConfirmationModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={doDelete}
        title="Xóa tiêu chí"
        isLoading={remove.isPending}
        confirmText="Xóa"
      >
        Xóa tiêu chí này?
      </ConfirmationModal>
    </div>
  );
}
