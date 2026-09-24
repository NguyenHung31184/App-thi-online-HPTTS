import type { QuestionType } from '../../../types';

export type CognitiveLevel = 'recognition' | 'comprehension' | 'application';
export type QuestionStatus = 'draft' | 'review' | 'published' | 'retired';
export type ImportJobStatus = 'queued' | 'processing' | 'review_required' | 'failed' | 'completed';
export type ImportSourceKind = 'xlsx' | 'csv' | 'zip' | 'docx' | 'pdf' | 'image';

export interface QuestionLibrary {
  id: string;
  occupationId: string;
  moduleId: string | null;
  name: string;
  description: string;
  status: 'active' | 'archived';
  createdAt: string;
}

export interface TaxonomyNode {
  id: string;
  libraryId: string;
  parentId: string | null;
  name: string;
  nodeType: 'topic' | 'outcome';
  sortOrder: number;
}

export interface LibraryQuestion {
  id: string;
  libraryId: string | null;
  taxonomyNodeId: string | null;
  questionType: QuestionType;
  stem: string;
  options: { id: string; text: string }[];
  answerKey: string;
  points: number;
  topic: string;
  difficulty: string;
  cognitiveLevel: CognitiveLevel | null;
  status: QuestionStatus;
  imageUrl: string | null;
  mediaUrl: string | null;
  createdAt: string | null;
}

export interface QuestionImportJob {
  id: string;
  libraryId: string;
  sourceFileName: string;
  sourceKind: ImportSourceKind;
  status: ImportJobStatus;
  totalDrafts: number;
  errorMessage: string | null;
  createdAt: string;
}

export interface QuestionImportDraft {
  id: string;
  jobId: string;
  sequenceNumber: number;
  sourcePage: number | null;
  payload: Partial<LibraryQuestion>;
  imagePaths: string[];
  confidence: number | null;
  validationIssues: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'imported';
}

export interface LibraryQuestionFilter {
  status: QuestionStatus | '';
  taxonomyNodeId: string;
  text: string;
}

/** Collects a node and every node below it, so filtering by a topic also matches questions tagged to its outcomes. */
export function taxonomySubtreeIds(nodes: TaxonomyNode[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        added = true;
      }
    }
  }
  return ids;
}

export function filterLibraryQuestions(
  questions: LibraryQuestion[],
  nodes: TaxonomyNode[],
  filter: LibraryQuestionFilter,
): LibraryQuestion[] {
  const nodeIds = filter.taxonomyNodeId ? taxonomySubtreeIds(nodes, filter.taxonomyNodeId) : null;
  const text = filter.text.trim().toLocaleLowerCase('vi');
  return questions.filter((question) => {
    if (filter.status && question.status !== filter.status) return false;
    if (nodeIds && (!question.taxonomyNodeId || !nodeIds.has(question.taxonomyNodeId))) return false;
    if (text && !`${question.stem} ${question.topic}`.toLocaleLowerCase('vi').includes(text)) return false;
    return true;
  });
}

export function countQuestionsByStatus(questions: LibraryQuestion[]): Record<QuestionStatus, number> {
  const counts: Record<QuestionStatus, number> = { draft: 0, review: 0, published: 0, retired: 0 };
  for (const question of questions) counts[question.status] += 1;
  return counts;
}
