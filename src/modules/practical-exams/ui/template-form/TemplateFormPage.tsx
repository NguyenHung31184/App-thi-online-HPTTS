import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { durationFromInput } from '../../domain/sessions';
import { usePracticalTemplate, useSaveTemplate } from '../../queries/use-practical-exams';
import { CriteriaEditor } from './CriteriaEditor';

interface FieldsProps {
  title: string;
  onTitle: (v: string) => void;
  description: string;
  onDescription: (v: string) => void;
  duration: string;
  onDuration: (v: string) => void;
  durationPlaceholder?: string;
}

function TemplateFields({ title, onTitle, description, onDescription, duration, onDuration, durationPlaceholder }: FieldsProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề *</label>
        <input type="text" value={title} onChange={(e) => onTitle(e.target.value)} required className="w-full border border-slate-300 rounded-lg px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
        <textarea value={description} onChange={(e) => onDescription(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian (phút)</label>
        <input
          type="number"
          min={0}
          value={duration}
          onChange={(e) => onDuration(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2"
          placeholder={durationPlaceholder}
        />
      </div>
    </>
  );
}

/** New template: title, description, time; once saved, the same page edits it and its criteria. */
export default function TemplateFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const template = usePracticalTemplate(id);
  const save = useSaveTemplate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const t = template.data;
    if (!t) return;
    setTitle(t.title);
    setDescription(t.description ?? '');
    setDuration(t.duration_minutes != null ? String(t.duration_minutes) : '');
  }, [template.data]);

  useEffect(() => {
    if (template.error) setError('Không tải được mẫu.');
  }, [template.error]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const input = { title, description: description || undefined, duration_minutes: durationFromInput(duration) };
    save.mutate({ id, input }, {
      onSuccess: (saved) => { if (!isEdit) navigate(`/admin/practical-templates/${saved.id}`, { replace: true }); },
      onError: (err) => setError(err instanceof Error ? err.message : 'Lỗi lưu mẫu.'),
    });
  };

  const fields = (
    <TemplateFields
      title={title}
      onTitle={setTitle}
      description={description}
      onDescription={setDescription}
      duration={duration}
      onDuration={setDuration}
      durationPlaceholder={isEdit ? undefined : 'Tùy chọn'}
    />
  );

  if (!isEdit) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Thêm mẫu thi thực hành</h1>
        <form onSubmit={handleSave} className="space-y-4 max-w-xl">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {fields}
          <div className="flex gap-2">
            <button type="submit" disabled={save.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {save.isPending ? 'Đang lưu...' : 'Tạo mẫu'}
            </button>
            <button type="button" onClick={() => navigate('/admin/practical-templates')} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              Hủy
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (template.isLoading) return <p className="text-slate-500">Đang tải...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Sửa mẫu & Tiêu chí</h1>
        <button type="button" onClick={() => navigate('/admin/practical-templates')} className="text-slate-600 hover:text-slate-900 text-sm">
          ← Danh sách mẫu
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <form onSubmit={handleSave} className="space-y-4 max-w-2xl mb-8">
        {fields}
        <div className="flex gap-2">
          <button type="submit" disabled={save.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {save.isPending ? 'Đang lưu...' : 'Lưu mẫu'}
          </button>
        </div>
      </form>

      {id && <CriteriaEditor templateId={id} onError={setError} />}
    </div>
  );
}
