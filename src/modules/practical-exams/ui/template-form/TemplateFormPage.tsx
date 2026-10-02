import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fieldConfigProblems, fieldConfigRow, readFieldConfig, type FieldConfig } from '../../domain/field-config';
import { durationFromInput } from '../../domain/sessions';
import { usePracticalTemplate, useSaveTemplate } from '../../queries/use-practical-exams';
import { CriteriaEditor } from './CriteriaEditor';
import { FieldConfigEditor } from './FieldConfigEditor';
import { ModuleSelect } from './ModuleSelect';

const fieldClass = 'w-full border border-slate-300 rounded-lg px-3 py-2';

interface Fields {
  title: string;
  description: string;
  duration: string;
  moduleId: string;
  passScore: string;
}

function TemplateFields({ fields, onChange, durationPlaceholder }: { fields: Fields; onChange: (patch: Partial<Fields>) => void; durationPlaceholder?: string }) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề *</label>
        <input type="text" value={fields.title} onChange={(e) => onChange({ title: e.target.value })} required className={fieldClass} />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
        <textarea value={fields.description} onChange={(e) => onChange({ description: e.target.value })} rows={2} className={fieldClass} />
      </div>
      <ModuleSelect value={fields.moduleId} onChange={(moduleId) => onChange({ moduleId })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian (phút)</label>
          <input type="number" min={0} value={fields.duration} onChange={(e) => onChange({ duration: e.target.value })} className={fieldClass} placeholder={durationPlaceholder} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Điểm đạt (trên 100)</label>
          <input type="number" min={0} max={100} value={fields.passScore} onChange={(e) => onChange({ passScore: e.target.value })} className={fieldClass} />
        </div>
      </div>
    </>
  );
}

const emptyFields: Fields = { title: '', description: '', duration: '', moduleId: '', passScore: '70' };

/** New template: title, module, pass mark; once saved, the same page edits its field grading set-up and criteria. */
export default function TemplateFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const template = usePracticalTemplate(id);
  const save = useSaveTemplate();

  const [fields, setFields] = useState<Fields>(emptyFields);
  const [config, setConfig] = useState<FieldConfig | null>(isEdit ? null : readFieldConfig({}));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const t = template.data;
    if (!t) return;
    setFields({
      title: t.title,
      description: t.description ?? '',
      duration: t.duration_minutes != null ? String(t.duration_minutes) : '',
      moduleId: t.module_id ?? '',
      passScore: String(t.pass_score ?? 70),
    });
    setConfig(readFieldConfig(t.config));
  }, [template.data]);

  useEffect(() => {
    if (template.error) setError('Không tải được mẫu.');
  }, [template.error]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    const passScore = Number(fields.passScore);
    if (!Number.isFinite(passScore) || passScore < 0 || passScore > 100) return setError('Điểm đạt phải từ 0 đến 100.');
    const problems = config ? fieldConfigProblems(config) : [];
    if (problems.length) return setError(problems.join(' '));
    const input = {
      title: fields.title,
      description: fields.description || undefined,
      duration_minutes: durationFromInput(fields.duration),
      module_id: fields.moduleId || null,
      pass_score: passScore,
      ...(config ? { config: fieldConfigRow(config) } : {}),
    };
    save.mutate({ id, input }, {
      onSuccess: (saved) => {
        if (!isEdit) navigate(`/admin/practical-templates/${saved.id}`, { replace: true });
        else setNotice('Đã lưu mẫu.');
      },
      onError: (err) => setError(err instanceof Error ? err.message : 'Lỗi lưu mẫu.'),
    });
  };

  const onFields = (patch: Partial<Fields>) => setFields((prev) => ({ ...prev, ...patch }));
  const saveButton = (label: string) => (
    <button type="submit" disabled={save.isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
      {save.isPending ? 'Đang lưu...' : label}
    </button>
  );

  if (!isEdit) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Thêm mẫu thi thực hành</h1>
        <form onSubmit={handleSave} className="space-y-4 max-w-xl">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <TemplateFields fields={fields} onChange={onFields} durationPlaceholder="Tùy chọn" />
          <div className="flex gap-2">
            {saveButton('Tạo mẫu')}
            <button type="button" onClick={() => navigate('/admin/practical-templates')} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              Hủy
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (template.isLoading || !config) return <p className="text-slate-500">Đang tải...</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-800">Sửa mẫu & Tiêu chí</h1>
        <button type="button" onClick={() => navigate('/admin/practical-templates')} className="text-slate-600 hover:text-slate-900 text-sm">
          ← Danh sách mẫu
        </button>
      </div>
      <form onSubmit={handleSave} className="space-y-4 max-w-4xl mb-8">
        <div className="max-w-2xl space-y-4">
          <TemplateFields fields={fields} onChange={onFields} />
        </div>
        <FieldConfigEditor config={config} onChange={setConfig} />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {notice && <p className="text-green-700 text-sm">{notice}</p>}
        <div className="flex gap-2">{saveButton('Lưu mẫu')}</div>
      </form>

      {id && <CriteriaEditor templateId={id} steps={config.steps} hasTimeRule={Boolean(config.time)} onError={setError} />}
    </div>
  );
}
