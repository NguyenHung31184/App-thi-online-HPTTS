import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { TemplateDraft } from '../../application/import-template';
import { downloadExcelTemplate, useCreateTemplateFromDraft, useReadTemplateFile } from '../../queries/use-practical-exams';
import { ModuleSelect } from '../template-form/ModuleSelect';
import { DraftPreview } from './DraftPreview';

const fieldClass = 'w-full border border-slate-300 rounded-lg px-3 py-2';

/** Practical template from our Excel template or the centre's Word score sheet: read, check, then create. */
export default function TemplateImportPage() {
  const navigate = useNavigate();
  const read = useReadTemplateFile();
  const create = useCreateTemplateFromDraft();
  const [fileName, setFileName] = useState('');
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [title, setTitle] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [passScore, setPassScore] = useState('70');
  const [error, setError] = useState('');

  const choose = (file: File | undefined) => {
    if (!file) return;
    setError('');
    setDraft(null);
    setFileName(file.name);
    read.mutate(file, {
      onSuccess: (d) => { setDraft(d); setTitle(d.title); setPassScore(String(d.passScore)); },
      onError: (e) => setError(e instanceof Error ? e.message : 'Không đọc được file.'),
    });
  };

  const submit = () => {
    if (!draft) return;
    const pass = Number(passScore);
    if (!title.trim()) return setError('Nhập tên đề.');
    if (!Number.isFinite(pass) || pass < 0 || pass > 100) return setError('Điểm đạt phải từ 0 đến 100.');
    if (draft.criteria.length === 0) return setError('Bản nháp không có tiêu chí nào.');
    setError('');
    create.mutate({ draft, title: title.trim(), moduleId: moduleId || null, passScore: pass }, {
      onSuccess: (t) => navigate(`/admin/practical-templates/${t.id}`),
      onError: (e) => setError(e instanceof Error ? e.message : 'Không tạo được mẫu.'),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-800">Nhập mẫu đánh giá từ file</h1>
        <Link to="/admin/practical-templates" className="text-sm text-slate-600 hover:text-slate-900">← Danh sách mẫu</Link>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
        <ul className="text-sm text-slate-700 space-y-1 list-disc pl-5">
          <li><b>Excel theo mẫu</b>: đủ bước, khung thời gian, lỗi trừ nhanh. Tải file mẫu, điền rồi chọn lại.</li>
          <li><b>Word phiếu chấm</b> của trung tâm (bảng STT, Nội dung, Tiêu chí đánh giá chi tiết, Điểm tối đa). Nếu cùng file có mục "Các lỗi vi phạm", danh sách lỗi loại được đọc luôn. Bước và lỗi trừ nhanh là đề xuất, cần xem lại.</li>
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center min-h-11 px-4 rounded-lg bg-brand-500 text-white font-semibold cursor-pointer hover:bg-brand-600 focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2">
            Chọn file .xlsx hoặc .docx
            <input type="file" accept=".xlsx,.xls,.docx" className="sr-only" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <button type="button" onClick={downloadExcelTemplate} className="min-h-11 px-4 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50">
            Tải file Excel mẫu
          </button>
          {fileName && <span className="text-sm text-slate-600">{read.isPending ? `Đang đọc ${fileName}…` : fileName}</span>}
        </div>
      </section>

      {error && <p className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">{error}</p>}

      {draft && (
        <>
          {draft.warnings.length > 0 && (
            <ul className="rounded-lg border border-amber-300 bg-amber-50 p-3 pl-7 text-sm text-amber-900 list-disc space-y-1">
              {draft.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="block text-sm font-medium text-slate-700 mb-1">Tên đề *</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
            </label>
            <ModuleSelect value={moduleId} onChange={setModuleId} />
            <label className="block">
              <span className="block text-sm font-medium text-slate-700 mb-1">Điểm đạt (trên 100)</span>
              <input type="number" min={0} max={100} value={passScore} onChange={(e) => setPassScore(e.target.value)} className={fieldClass} />
            </label>
          </section>
          <DraftPreview draft={draft} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={submit} disabled={create.isPending} className="min-h-11 px-5 rounded-lg bg-brand-500 text-white font-semibold hover:bg-brand-600 disabled:opacity-50">
              {create.isPending ? 'Đang tạo…' : 'Tạo mẫu và mở để soạn tiếp'}
            </button>
            <button type="button" onClick={() => { setDraft(null); setFileName(''); }} className="min-h-11 px-5 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50">
              Bỏ, chọn file khác
            </button>
          </div>
        </>
      )}
    </div>
  );
}
