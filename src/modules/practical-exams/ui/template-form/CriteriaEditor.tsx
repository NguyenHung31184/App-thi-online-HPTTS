import { useEffect, useState } from 'react';
import type { PracticalExamCriteria } from '../../../../types';
import ConfirmationModal from '../../../../shared/ui/ConfirmationModal';
import { deductionsFromText, deductionsToText, readDeductions, type FieldStep } from '../../domain/field-config';
import type { UpdateCriteriaInput } from '../../domain/inputs';
import { useAddCriterion, useCriteria, useDeleteCriterion, useUpdateCriterion } from '../../queries/use-practical-exams';

const inputClass = 'border border-slate-300 rounded px-2 py-1';

interface Props {
  templateId: string;
  steps: FieldStep[];
  hasTimeRule: boolean;
  onError: (message: string) => void;
}

/** Criteria of a saved template; every change is saved as it is made (text fields when they lose focus). */
export function CriteriaEditor({ templateId, steps, hasTimeRule, onError }: Props) {
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
  const total = criteria.reduce((sum, c) => sum + Number(c.max_score ?? 0), 0);

  const handleAdd = () => {
    onError('');
    add.mutate({ templateId, count: criteria.length }, {
      onSuccess: (c) => setCriteria((prev) => [...prev, c]),
      onError: (err) => onError(errorText(err, 'Lỗi thêm tiêu chí.')),
    });
  };

  const handleUpdate = (id: string, updates: UpdateCriteriaInput) => {
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
      <p className="text-slate-600 text-sm mb-1">
        Chấm tại sân: mỗi tiêu chí bắt đầu ở điểm tối đa, giáo viên chạm lỗi để trừ. Lỗi trừ nhanh ghi mỗi dòng một lỗi
        theo dạng <code>Tên lỗi | điểm trừ</code>.
      </p>
      <p className={`text-sm mb-4 ${total === 100 ? 'text-slate-600' : 'text-amber-700'}`}>Tổng điểm tối đa: {total}{total !== 100 && ' (nên là 100)'}</p>
      <button type="button" onClick={handleAdd} className="mb-4 px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 text-sm">
        + Thêm tiêu chí
      </button>
      <ul className="space-y-3">
        {criteria.map((c, idx) => (
          <li key={c.id} className="p-3 bg-slate-50 rounded-lg space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-700 w-8">{idx + 1}.</span>
              <input type="text" defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && handleUpdate(c.id, { name: e.target.value })} className={`${inputClass} flex-1 min-w-[12rem]`} placeholder="Tên tiêu chí" />
              <label className="flex items-center gap-1 text-sm">
                <span>Điểm tối đa:</span>
                <input type="number" min={1} max={100} value={c.max_score} onChange={(e) => handleUpdate(c.id, { max_score: Number(e.target.value) })} className={`${inputClass} w-16`} />
              </label>
              <select value={c.step_key ?? ''} onChange={(e) => handleUpdate(c.id, { step_key: e.target.value || null })} className={`${inputClass} text-sm`} aria-label="Bước">
                <option value="">— Bước —</option>
                {steps.map((s) => <option key={s.key} value={s.key}>{s.name || s.key}</option>)}
              </select>
              <select value={c.kind ?? 'score'} onChange={(e) => handleUpdate(c.id, { kind: e.target.value as 'score' | 'time' })} className={`${inputClass} text-sm`} aria-label="Loại">
                <option value="score">Chấm trừ điểm</option>
                <option value="time" disabled={!hasTimeRule}>Điểm thời gian (tự tính)</option>
              </select>
              <button type="button" onClick={() => setConfirmDeleteId(c.id)} className="text-red-600 text-sm hover:underline">Xóa</button>
            </div>
            <div className="flex flex-wrap gap-2 pl-10">
              <input type="text" defaultValue={c.description ?? ''} onBlur={(e) => e.target.value !== (c.description ?? '') && handleUpdate(c.id, { description: e.target.value })} className={`${inputClass} text-sm flex-1 min-w-[14rem]`} placeholder="Tiêu chí đánh giá chi tiết (gợi ý cho GV)" />
              {(c.kind ?? 'score') === 'score' && (
                <textarea
                  defaultValue={deductionsToText(readDeductions(c.deductions))}
                  onBlur={(e) => handleUpdate(c.id, { deductions: deductionsFromText(e.target.value) })}
                  rows={3}
                  className={`${inputClass} text-sm flex-1 min-w-[16rem]`}
                  placeholder={'Lỗi trừ nhanh, ví dụ:\nRung lắc khi di chuyển | 2\nChạm khung | 3'}
                />
              )}
            </div>
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
        Xóa tiêu chí này? Điểm đã chấm theo tiêu chí vẫn được giữ.
      </ConfirmationModal>
    </div>
  );
}
