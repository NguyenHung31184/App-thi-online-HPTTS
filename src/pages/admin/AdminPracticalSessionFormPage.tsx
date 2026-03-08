import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getPracticalSession,
  createPracticalSession,
  updatePracticalSession,
} from '../../services/practicalSessionService';
import { listPracticalTemplates } from '../../services/practicalTemplateService';
import { listClasses } from '../../services/ttdtDataService';
import type { PracticalExamSession } from '../../types';

function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function fromDatetimeLocal(s: string): number {
  return new Date(s).getTime();
}

export default function AdminPracticalSessionFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [template_id, setTemplateId] = useState('');
  const [class_id, setClassId] = useState('');
  const [start_at, setStartAt] = useState('');
  const [end_at, setEndAt] = useState('');
  const [access_code, setAccessCode] = useState('');
  const [templates, setTemplates] = useState<{ id: string; title: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listPracticalTemplates().then((list) => setTemplates(list.map((t) => ({ id: t.id, title: t.title })))).catch(() => {});
    listClasses().then(setClasses).catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    getPracticalSession(id).then((s) => {
      if (cancelled || !s) return;
      setTemplateId(s.template_id);
      setClassId(s.class_id);
      setStartAt(toDatetimeLocal(s.start_at));
      setEndAt(toDatetimeLocal(s.end_at));
      setAccessCode(s.access_code);
    }).catch(() => setError('Không tải được kỳ thi.'));
    return () => { cancelled = true; };
  }, [isEdit, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const startTs = fromDatetimeLocal(start_at);
      const endTs = fromDatetimeLocal(end_at);
      if (endTs <= startTs) {
        setError('Thời gian kết thúc phải sau thời gian bắt đầu.');
        setLoading(false);
        return;
      }
      if (isEdit && id) {
        await updatePracticalSession(id, {
          class_id,
          start_at: startTs,
          end_at: endTs,
          access_code,
        });
        navigate('/admin/practical-sessions');
      } else {
        await createPracticalSession({
          template_id,
          class_id,
          start_at: startTs,
          end_at: endTs,
          access_code,
        });
        navigate('/admin/practical-sessions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu kỳ thi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-4">
        {isEdit ? 'Sửa kỳ thi thực hành' : 'Thêm kỳ thi thực hành'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mẫu thi *</label>
            <select
              value={template_id}
              onChange={(e) => setTemplateId(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            >
              <option value="">— Chọn mẫu —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Lớp (TTDT) *</label>
          <select
            value={class_id}
            onChange={(e) => setClassId(e.target.value)}
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          >
            <option value="">— Chọn lớp —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bắt đầu *</label>
            <input
              type="datetime-local"
              value={start_at}
              onChange={(e) => setStartAt(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kết thúc *</label>
            <input
              type="datetime-local"
              value={end_at}
              onChange={(e) => setEndAt(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Mã truy cập *</label>
          <input
            type="text"
            value={access_code}
            onChange={(e) => setAccessCode(e.target.value)}
            required
            placeholder="VD: THTH2026"
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo kỳ thi'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/practical-sessions')}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Hủy
          </button>
        </div>
      </form>
    </div>
  );
}
