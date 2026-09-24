import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { taxonomySubtreeIds, type TaxonomyNode } from '../domain/question-library';
import { useCreateTaxonomyNode } from '../queries/use-question-library';
import { useLibraryContext } from './library-context';
import { errorMessage, focusRing } from './labels';
import { EmptyState, ErrorState, LoadingState } from './states';

const fieldClass = `min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ${focusRing}`;

function TaxonomyTree({ nodes, libraryId, questionCounts }: { nodes: TaxonomyNode[]; libraryId: string; questionCounts: Map<string, number> }) {
  const children = (id: string | null) => nodes.filter((node) => node.parentId === id);
  const renderNode = (node: TaxonomyNode) => {
    const nested = children(node.id);
    const count = questionCounts.get(node.id) ?? 0;
    return (
      <li key={node.id} className="py-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className={node.nodeType === 'outcome' ? 'text-slate-700' : 'font-medium text-slate-900'}>{node.name}</span>
          <span className="text-xs text-slate-600">{node.nodeType === 'outcome' ? 'Năng lực' : 'Chủ đề'}</span>
          {count > 0 ? (
            <Link to={`/admin/question-libraries/${libraryId}/questions?node=${node.id}`} className={`inline-flex min-h-11 items-center rounded px-1 text-xs font-medium text-indigo-700 hover:text-indigo-900 ${focusRing}`}>
              {count} câu
            </Link>
          ) : (
            <span className="text-xs text-slate-600">0 câu</span>
          )}
        </div>
        {nested.length > 0 && <ul className="ml-4 border-l border-slate-200 pl-3">{nested.map(renderNode)}</ul>}
      </li>
    );
  };
  return <ul className="text-sm">{children(null).map(renderNode)}</ul>;
}

export default function QuestionLibraryStructurePage() {
  const { library, workspace, workspaceLoading, workspaceError, refetchWorkspace } = useLibraryContext();
  const createNode = useCreateTaxonomyNode(library.id);
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState<TaxonomyNode['nodeType']>('topic');
  const [parentId, setParentId] = useState('');
  const nodes = workspace?.nodes ?? [];

  // Counts include every node below, matching what the questions tab shows when filtered by this node.
  const questionCounts = new Map<string, number>();
  for (const node of nodes) {
    const ids = taxonomySubtreeIds(nodes, node.id);
    questionCounts.set(node.id, (workspace?.questions ?? []).filter((question) => question.taxonomyNodeId && ids.has(question.taxonomyNodeId)).length);
  }

  const submitNode = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await createNode.mutateAsync({ libraryId: library.id, parentId: parentId || null, name: nodeName, nodeType, sortOrder: nodes.length });
      setNodeName('');
      toast.success('Đã thêm vào cây kiến thức.');
    } catch (reason) {
      toast.error(errorMessage(reason, 'Không thể thêm vào cây kiến thức.'));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
      <section aria-labelledby="tree-heading" className="min-w-0">
        <h2 id="tree-heading" className="font-semibold text-slate-900">Cây kiến thức và năng lực</h2>
        <p className="mb-3 mt-1 text-sm text-slate-600">Chưa có màn gắn câu hỏi vào từng mục, nên số câu ở đây chỉ tính các câu đã được gắn sẵn. Ma trận đề hiện vẫn bốc câu theo trường “Chủ đề” của câu hỏi, chưa theo cây này.</p>
        {workspaceLoading && <LoadingState>Đang tải cây kiến thức…</LoadingState>}
        {workspaceError != null && <ErrorState title="Không tải được cây kiến thức" detail={errorMessage(workspaceError, 'Kiểm tra kết nối mạng.')} onRetry={refetchWorkspace} />}
        {!workspaceLoading && workspaceError == null && nodes.length === 0 && (
          <EmptyState title="Cây kiến thức còn trống">
            <p>Thêm các chủ đề trước, sau đó thêm năng lực hoặc yêu cầu đầu ra bên dưới từng chủ đề bằng biểu mẫu “Thêm mục”.</p>
          </EmptyState>
        )}
        {nodes.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <TaxonomyTree nodes={nodes} libraryId={library.id} questionCounts={questionCounts} />
          </div>
        )}
      </section>

      <section aria-labelledby="add-node-heading" className="h-fit rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="add-node-heading" className="font-semibold text-slate-900">Thêm mục</h2>
        <form className="mt-3 grid gap-3" onSubmit={submitNode}>
          <label className="grid gap-1 text-sm font-medium text-slate-700">Tên
            <input value={nodeName} onChange={(event) => setNodeName(event.target.value)} required className={fieldClass} placeholder="Ví dụ: Kiểm tra trước ca" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">Loại
            <select value={nodeType} onChange={(event) => setNodeType(event.target.value as TaxonomyNode['nodeType'])} className={fieldClass}>
              <option value="topic">Chủ đề</option>
              <option value="outcome">Năng lực / yêu cầu đầu ra</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">Nằm dưới
            <select value={parentId} onChange={(event) => setParentId(event.target.value)} className={fieldClass}>
              <option value="">Mục gốc</option>
              {nodes.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
            </select>
          </label>
          <button disabled={createNode.isPending || workspaceLoading} className={`min-h-11 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}>
            {createNode.isPending ? 'Đang thêm…' : 'Thêm vào cây'}
          </button>
        </form>
      </section>
    </div>
  );
}
