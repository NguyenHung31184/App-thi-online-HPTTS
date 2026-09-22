import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/AuthContext';
import { listModulesByOccupationId } from '../../../services/ttdtDataService';
import { listOccupations } from '../../../services/occupationService';
import type { ModuleItem, Occupation } from '../../../types';
import type { ImportSourceKind, QuestionLibrary, TaxonomyNode } from '../domain/question-library';
import { useCreateQuestionLibrary, useCreateTaxonomyNode, useQuestionLibraries, useQuestionLibraryWorkspace, useStageQuestionImport } from '../queries/use-question-library';

const sourceKinds: Record<string, ImportSourceKind> = {
  docx: 'docx', pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', webp: 'image',
};

const jobLabels: Record<string, string> = {
  queued: 'Đang chờ xử lý', processing: 'Đang tách tài liệu', review_required: 'Cần rà soát', failed: 'Có lỗi', completed: 'Đã hoàn tất',
};

function libraryScope(library: QuestionLibrary, occupations: Occupation[], modules: ModuleItem[]) {
  const occupation = occupations.find((item) => item.id === library.occupationId)?.name ?? 'Nghề chưa xác định';
  const module = library.moduleId ? modules.find((item) => item.id === library.moduleId)?.name ?? library.moduleId : 'Tất cả mô-đun';
  return `${occupation} · ${module}`;
}

function TaxonomyTree({ nodes }: { nodes: TaxonomyNode[] }) {
  const roots = nodes.filter((node) => !node.parentId);
  const children = (id: string) => nodes.filter((node) => node.parentId === id);
  const renderNode = (node: TaxonomyNode, depth: number) => (
    <li key={node.id} className="py-1" style={{ paddingLeft: `${depth * 16}px` }}>
      <span className={node.nodeType === 'outcome' ? 'text-emerald-700' : 'text-slate-700'}>{node.name}</span>
      <span className="ml-2 text-xs text-slate-400">{node.nodeType === 'outcome' ? 'Năng lực' : 'Chủ đề'}</span>
      {children(node.id).length > 0 && <ul>{children(node.id).map((child) => renderNode(child, depth + 1))}</ul>}
    </li>
  );
  if (roots.length === 0) return <p className="text-sm text-slate-500">Chưa có cây kiến thức.</p>;
  return <ul className="text-sm">{roots.map((node) => renderNode(node, 0))}</ul>;
}

export default function QuestionLibraryDashboardPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const selectedLibraryId = params.get('library') ?? '';
  const { data: libraries = [], isLoading, error } = useQuestionLibraries();
  const { data: workspace, isLoading: workspaceLoading } = useQuestionLibraryWorkspace(selectedLibraryId);
  const createLibrary = useCreateQuestionLibrary();
  const createNode = useCreateTaxonomyNode(selectedLibraryId);
  const stageImport = useStageQuestionImport(selectedLibraryId);
  const [occupations, setOccupations] = useState<Occupation[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [occupationId, setOccupationId] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState<TaxonomyNode['nodeType']>('topic');
  const [parentId, setParentId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const documentImportEnabled = import.meta.env.VITE_DOCUMENT_IMPORT_ENABLED === '1';

  useEffect(() => {
    listOccupations().then(setOccupations).catch(() => setOccupations([]));
  }, []);

  useEffect(() => {
    if (!occupationId) { setModules([]); setModuleId(''); return; }
    listModulesByOccupationId(occupationId).then(setModules).catch(() => setModules([]));
  }, [occupationId]);

  useEffect(() => {
    const selected = libraries.find((library) => library.id === selectedLibraryId);
    if (!selected?.occupationId) return;
    listModulesByOccupationId(selected.occupationId).then(setModules).catch(() => setModules([]));
  }, [libraries, selectedLibraryId]);

  const selectedLibrary = libraries.find((library) => library.id === selectedLibraryId) ?? null;
  const nodeOptions = workspace?.nodes ?? [];
  const publishedCount = workspace?.questions.filter((question) => question.status === 'published').length ?? 0;
  const reviewCount = workspace?.questions.filter((question) => question.status === 'review').length ?? 0;
  const draftCount = workspace?.questions.filter((question) => question.status === 'draft').length ?? 0;
  const scopeModules = useMemo(() => modules, [modules]);

  const selectLibrary = (id: string) => setParams(id ? { library: id } : {});

  const submitLibrary = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) { toast.error('Bạn cần đăng nhập để tạo ngân hàng.'); return; }
    try {
      const library = await createLibrary.mutateAsync({ occupationId, moduleId: moduleId || null, name, description, createdBy: user.id });
      setName(''); setDescription(''); setModuleId('');
      setParams({ library: library.id });
      toast.success('Đã tạo ngân hàng câu hỏi.');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Không thể tạo ngân hàng.');
    }
  };

  const submitNode = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedLibraryId) return;
    try {
      await createNode.mutateAsync({ libraryId: selectedLibraryId, parentId: parentId || null, name: nodeName, nodeType, sortOrder: nodeOptions.length });
      setNodeName(''); setParentId('');
      toast.success('Đã thêm vào cây kiến thức.');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Không thể thêm cấu trúc.');
    }
  };

  const submitImport = async (event: FormEvent) => {
    event.preventDefault();
    if (!file || !user || !selectedLibraryId || !documentImportEnabled) return;
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
    const sourceKind = sourceKinds[extension];
    if (!sourceKind) { toast.error('Chi ho tro DOCX, PDF hoac anh trong luong nay.'); return; }
    try {
      await stageImport.mutateAsync({ libraryId: selectedLibraryId, requestedBy: user.id, file, sourceKind });
      setFile(null);
      toast.success('Đã tạo phiếu nhập. Tài liệu sẽ xuất hiện để rà soát sau khi worker xử lý.');
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Không thể tải tài liệu lên.');
    }
  };

  if (isLoading) return <p className="text-slate-600">Đang tải ngân hàng câu hỏi…</p>;
  if (error) return <p className="text-red-700">{error instanceof Error ? error.message : 'Không thể tải ngân hàng câu hỏi.'}</p>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Ngân hàng câu hỏi</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Soạn, chuẩn hóa và tái sử dụng câu hỏi</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Câu hỏi được tổ chức theo nghề, mô-đun, chủ đề và năng lực để sinh đề đúng ma trận.</p>
        </div>
        <Link to="/admin/questions" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Mở kho câu hỏi cũ</Link>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.6fr)]">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-slate-900">Tạo ngân hàng</h2>
            <form className="mt-4 space-y-3" onSubmit={submitLibrary}>
              <label className="block text-sm font-medium text-slate-700">Nghề đào tạo
                <select value={occupationId} onChange={(event) => setOccupationId(event.target.value)} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">Chọn nghề</option>
                  {occupations.map((occupation) => <option key={occupation.id} value={occupation.id}>{occupation.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">Mô-đun
                <select value={moduleId} onChange={(event) => setModuleId(event.target.value)} disabled={!occupationId} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100">
                  <option value="">Dùng cho tất cả mô-đun</option>
                  {modules.map((module) => <option key={module.id} value={module.id}>{module.code ? `${module.code} — ${module.name}` : module.name}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">Tên ngân hàng
                <input value={name} onChange={(event) => setName(event.target.value)} required minLength={3} maxLength={160} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Ví dụ: An toàn vận hành RTG" />
              </label>
              <label className="block text-sm font-medium text-slate-700">Mô tả
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Phạm vi kiến thức và mục tiêu sử dụng" />
              </label>
              <button disabled={createLibrary.isPending} className="w-full rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60">
                {createLibrary.isPending ? 'Đang tạo…' : 'Tạo ngân hàng'}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="px-1 text-sm font-semibold text-slate-900">Ngân hàng hiện có</h2>
            <div className="mt-2 max-h-[420px] space-y-1 overflow-y-auto">
              {libraries.length === 0 && <p className="px-1 py-3 text-sm text-slate-500">Chưa có ngân hàng mới. Dữ liệu cũ sẽ được chuyển thành ngân hàng mặc định khi chạy migration P1.</p>}
              {libraries.map((library) => (
                <button key={library.id} type="button" onClick={() => selectLibrary(library.id)} className={`w-full rounded-lg p-3 text-left text-sm ${library.id === selectedLibraryId ? 'bg-indigo-50 text-indigo-950 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}>
                  <span className="block font-medium">{library.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">{libraryScope(library, occupations, scopeModules)}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="min-w-0">
          {!selectedLibrary && <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><h2 className="font-semibold text-slate-800">Chọn một ngân hàng để bắt đầu</h2><p className="mt-2 text-sm text-slate-600">Tạo cấu trúc kiến thức, nhập tài liệu và kiểm tra trạng thái câu hỏi tại đây.</p></section>}
          {selectedLibrary && (
            <div className="space-y-5">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-sm text-slate-500">{libraryScope(selectedLibrary, occupations, scopeModules)}</p><h2 className="text-xl font-semibold text-slate-900">{selectedLibrary.name}</h2><p className="mt-1 text-sm text-slate-600">{selectedLibrary.description || 'Chưa có mô tả.'}</p></div>
                  {selectedLibrary.moduleId && <Link to={`/admin/questions/occupation/${selectedLibrary.occupationId}?moduleId=${encodeURIComponent(selectedLibrary.moduleId)}`} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-100">Soạn câu hỏi thủ công</Link>}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-emerald-50 p-3"><p className="text-xs font-medium text-emerald-800">Đã phát hành</p><p className="mt-1 text-2xl font-semibold text-emerald-950">{publishedCount}</p></div>
                  <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs font-medium text-amber-800">Chờ duyệt</p><p className="mt-1 text-2xl font-semibold text-amber-950">{reviewCount}</p></div>
                  <div className="rounded-lg bg-slate-100 p-3"><p className="text-xs font-medium text-slate-700">Bản nháp</p><p className="mt-1 text-2xl font-semibold text-slate-950">{draftCount}</p></div>
                </div>
              </section>

              <div className="grid gap-5 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-900">Cây kiến thức và năng lực</h3>
                  <p className="mt-1 text-sm text-slate-600">Tao chu de truoc, sau do them yeu cau dau ra hoac nang luc ben duoi.</p>
                  <form className="mt-4 grid gap-2 sm:grid-cols-2" onSubmit={submitNode}>
                    <input value={nodeName} onChange={(event) => setNodeName(event.target.value)} required className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Tên chủ đề hoặc năng lực" />
                    <select value={nodeType} onChange={(event) => setNodeType(event.target.value as TaxonomyNode['nodeType'])} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="topic">Chủ đề</option><option value="outcome">Năng lực / yêu cầu đầu ra</option></select>
                    <select value={parentId} onChange={(event) => setParentId(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Mục gốc</option>{nodeOptions.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}</select>
                    <button disabled={createNode.isPending || workspaceLoading} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">{createNode.isPending ? 'Đang thêm…' : 'Thêm vào cây'}</button>
                  </form>
                  <div className="mt-4 border-t border-slate-100 pt-3"><TaxonomyTree nodes={workspace?.nodes ?? []} /></div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-900">Nhập tài liệu thành câu hỏi nháp</h3>
                  <p className="mt-1 text-sm text-slate-600">DOCX, PDF va anh di qua worker Python de tao ban nhap can ra soat. Excel/ZIP tiep tuc nhap o kho cau hoi cu.</p>
                  <form className="mt-4 space-y-3" onSubmit={submitImport}>
                    <input type="file" accept=".docx,.pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-medium file:text-indigo-800 hover:file:bg-indigo-100" />
                    {!documentImportEnabled && <p className="text-sm text-amber-800">Worker chua duoc bat tren moi truong nay.</p>}
                    <button disabled={!file || stageImport.isPending || !documentImportEnabled} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60">{stageImport.isPending ? 'Đang tải lên…' : 'Tạo phiếu nhập'}</button>
                  </form>
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                    {(workspace?.jobs ?? []).length === 0 && <p className="text-sm text-slate-500">Chưa có phiếu nhập nào.</p>}
                    {(workspace?.jobs ?? []).map((job) => <div key={job.id} className="rounded-lg border border-slate-200 p-3 text-sm"><div className="flex items-start justify-between gap-3"><span className="font-medium text-slate-800 break-all">{job.sourceFileName}</span><span className="shrink-0 text-xs text-slate-500">{jobLabels[job.status]}</span></div><p className="mt-1 text-xs text-slate-500">{job.totalDrafts} cau nhap{job.errorMessage ? ` ? ${job.errorMessage}` : ''}</p>{job.status === 'review_required' && <Link to={`/admin/question-libraries/imports/${job.id}`} className="mt-2 inline-block text-sm font-medium text-indigo-700 hover:text-indigo-900">Ra soat ban nhap</Link>}</div>)}
                  </div>
                </section>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
