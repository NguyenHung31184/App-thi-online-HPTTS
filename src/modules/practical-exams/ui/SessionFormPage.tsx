import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fromDatetimeLocal, toDatetimeLocal } from '../../../shared/lib/datetime-local';
import { sessionTimeError } from '../domain/sessions';
import { usePracticalSession, usePracticalTemplates, useSaveSession, useTtdtClassOptions } from '../queries/use-practical-exams';

export default function SessionFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [templateId, setTemplateId] = useState('');
  const [classId, setClassId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [error, setError] = useState('');

  const templates = usePracticalTemplates().data ?? [];
  const classes = useTtdtClassOptions().data ?? [];
  const session = usePracticalSession(id);
  const save = useSaveSession();

  useEffect(() => {
    const s = session.data;
    if (!s) return;
    setTemplateId(s.template_id);
    setClassId(s.class_id);
    setStartAt(toDatetimeLocal(s.start_at));
    setEndAt(toDatetimeLocal(s.end_at));
  }, [session.data]);

  useEffect(() => {
    if (session.error) setError('Không tải được kỳ thi.');
  }, [session.error]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const startTs = fromDatetimeLocal(startAt);
    const endTs = fromDatetimeLocal(endAt);
    const problem = sessionTimeError(startTs, endTs);
    if (problem) {
      setError(problem);
      return;
    }
    const common = { class_id: classId, start_at: startTs, end_at: endTs };
    // Field grading does not ask for the access code; a new session still gets one because the column requires it.
    const created = { ...common, template_id: templateId, access_code: crypto.randomUUID().slice(0, 8), mode: 'teacher_grading' as const };
    save.mutate(isEdit && id ? { id, input: common } : { input: created }, {
      onSuccess: () => navigate('/admin/practical-sessions'),
      onError: (err) => setError(err instanceof Error ? err.message : 'Lỗi lưu kỳ thi.'),
    });
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-4">{isEdit ? 'Sửa kỳ thi thực hành' : 'Thêm kỳ thi thực hành'}</h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mẫu đánh giá *</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2">
              <option value="">— Chọn mẫu —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Lớp (TTDT) *</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2">
            <option value="">— Chọn lớp —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bắt đầu *</label>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kết thúc *</label>
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2" />
          </div>
        </div>
        <p className="text-sm text-slate-600">
          Giáo viên chấm kỳ thi này trên Sổ chuyên cần. Thời gian để giáo viên biết ngày thi; app không chặn chấm ngoài khoảng này.
        </p>
        <div className="flex gap-2">
          <button type="submit" disabled={save.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {save.isPending ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo kỳ thi'}
          </button>
          <button type="button" onClick={() => navigate('/admin/practical-sessions')} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
            Hủy
          </button>
        </div>
      </form>
    </div>
  );
}
