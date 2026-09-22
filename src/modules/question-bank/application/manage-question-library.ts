import type { ImportSourceKind, QuestionLibrary, TaxonomyNode } from '../domain/question-library';
import {
  createImportJob,
  createQuestionLibrary,
  createTaxonomyNode,
  listImportDrafts,
  listImportJobs,
  listLibraryQuestions,
  listQuestionLibraries,
  listTaxonomyNodes,
  requestImportProcessing,
} from '../data/question-library-repository';

export async function getQuestionLibraries(): Promise<QuestionLibrary[]> {
  return listQuestionLibraries();
}

export async function addQuestionLibrary(input: {
  occupationId: string;
  moduleId: string | null;
  name: string;
  description: string;
  createdBy: string;
}): Promise<QuestionLibrary> {
  if (!input.occupationId) throw new Error('Chọn nghề đào tạo cho ngân hàng.');
  if (input.name.trim().length < 3) throw new Error('Tên ngân hàng cần ít nhất 3 ký tự.');
  return createQuestionLibrary(input);
}

export async function addTaxonomyNode(input: {
  libraryId: string;
  parentId: string | null;
  name: string;
  nodeType: TaxonomyNode['nodeType'];
  sortOrder: number;
}): Promise<TaxonomyNode> {
  if (input.name.trim().length === 0) throw new Error('Nhập tên chủ đề hoặc yêu cầu đầu ra.');
  return createTaxonomyNode(input);
}

export async function getQuestionLibraryWorkspace(libraryId: string) {
  const [nodes, questions, jobs] = await Promise.all([
    listTaxonomyNodes(libraryId),
    listLibraryQuestions(libraryId),
    listImportJobs(libraryId),
  ]);
  return { nodes, questions, jobs };
}

export async function stageQuestionImport(input: {
  libraryId: string;
  requestedBy: string;
  file: File;
  sourceKind: ImportSourceKind;
}) {
  const job = await createImportJob(input);
  await requestImportProcessing(job.id);
  return job;
}

export async function getImportDrafts(jobId: string) {
  return listImportDrafts(jobId);
}
