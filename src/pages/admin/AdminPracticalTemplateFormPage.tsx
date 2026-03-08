import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getPracticalTemplate,
  updatePracticalTemplate,
  createPracticalTemplate,
  listCriteriaByTemplate,
  createPracticalCriteria,
  updatePracticalCriteria,
  deletePracticalCriteria,
} from '../../services/practicalTemplateService';
import type { PracticalExamTemplate, PracticalExamCriteria } from '../../types';

export default function AdminPracticalTemplateFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration_minutes, setDurationMinutes] = useState<string>('');
  const [criteria, setCriteria] = useState<PracticalExamCriteria[]>([]);
  const [templateLoading, setTemplateLoading] = useState(isEdit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    setTemplateLoading(true);
    getPracticalTemplate(id).then((t) => {
      if (cancelled || !t) return;
      setTitle(t.title);
      setDescription(t.description ?? '');
      setDurationMinutes(t.duration_minutes != null ? String(t.duration_minutes) : '');
    }).catch(() => setError('Không tải được mẫu.')).finally(() => setTemplateLoading(false));
    return () => { cancelled = true; };
  }, [isEdit, id]);

  useEffect(() => {
    if (!id) return;
    listCriteriaByTemplate(id).then(setCriteria).catch(() => {});
  }, [id]);

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isEdit && id) {
        await updatePracticalTemplate(id, {
          title,
          description: description || undefined,
          duration_minutes: duration_minutes === '' ? null : Number(duration_minutes),
        });
      } else {
        const t = await createPracticalTemplate({
          title,
          description: description || undefined,
          duration_minutes: duration_minutes === '' ? null : Number(duration_minutes),
        });
        navigate(`/admin/practical-templates/${t.id}`, { replace: true });
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu mẫu.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCriteria = async () => {
    if (!id) return;
    setError('');
    try {
      const c = await createPracticalCriteria({
        template_id: id,
        order_index: criteria.length,
        name: `Tiêu chí ${criteria.length + 1}`,
        max_score: 10,
        weight: 1,
      });
      setCriteria((prev) => [...prev, c]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi thêm tiêu chí.');
    }
  };

  const handleUpdateCriteria = async (critId: string, updates: Partial<PracticalExamCriteria>) => {
    try {
      await updatePracticalCriteria(critId, updates);
      setCriteria((prev) =>
        prev.map((c) => (c.id === critId ? { ...c, ...updates } : c))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi cập nhật tiêu chí.');
    }
  };

  const handleDeleteCriteria = async (critId: string) => {
    if (!window.confirm('Xóa tiêu chí này?')) return;
    try {
      await deletePracticalCriteria(critId);
      setCriteria((prev) => prev.filter((c) => c.id !== critId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xóa tiêu chí.');
    }
  };

  if (!isEdit && !title) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Thêm mẫu thi thực hành</h1>
        <form onSubmit={handleSaveTemplate} className="space-y-4 max-w-xl">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian (phút)</label>
            <input
              type="number"
              min={0}
              value={duration_minutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="Tùy chọn"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Đang lưu...' : 'Tạo mẫu'}
            </button>
            <button type="button" onClick={() => navigate('/admin/practical-templates')} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              Hủy
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (isEdit && templateLoading) return <p className="text-slate-500">Đang tải...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">
          {isEdit ? 'Sửa mẫu & Tiêu chí' : 'Thêm mẫu'}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/admin/practical-templates')}
          className="text-slate-600 hover:text-slate-900 text-sm"
        >
          ← Danh sách mẫu
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <form onSubmit={handleSaveTemplate} className="space-y-4 max-w-2xl mb-8">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian (phút)</label>
          <input
            type="number"
            min={0}
            value={duration_minutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Đang lưu...' : 'Lưu mẫu'}
          </button>
        </div>
      </form>

      {isEdit && id && (
        <div className="border-t border-slate-200 pt-6">
          <h2 className="text-lg font-medium text-slate-800 mb-2">Tiêu chí chấm</h2>
          <p className="text-slate-600 text-sm mb-4">
            Mỗi tiêu chí có thang điểm (max_score), hệ số (weight). GV chấm bằng thanh trượt 0 – max_score.
          </p>
          <button
            type="button"
            onClick={handleAddCriteria}
            className="mb-4 px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 text-sm"
          >
            + Thêm tiêu chí
          </button>
          <ul className="space-y-3">
            {criteria.map((c, idx) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-700 w-8">{idx + 1}.</span>
                <input
                  type="text"
                  value={c.name}
                  onChange={(e) => handleUpdateCriteria(c.id, { name: e.target.value })}
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
                    onChange={(e) => handleUpdateCriteria(c.id, { max_score: Number(e.target.value) })}
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
                    onChange={(e) => handleUpdateCriteria(c.id, { weight: Number(e.target.value) })}
                    className="w-16 border border-slate-300 rounded px-2 py-1"
                  />
                </label>
                <input
                  type="text"
                  value={c.description ?? ''}
                  onChange={(e) => handleUpdateCriteria(c.id, { description: e.target.value })}
                  className="w-48 border border-slate-300 rounded px-2 py-1 text-sm"
                  placeholder="Mô tả (gợi ý GV)"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteCriteria(c.id)}
                  className="text-red-600 text-sm hover:underline"
                >
                  Xóa
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
