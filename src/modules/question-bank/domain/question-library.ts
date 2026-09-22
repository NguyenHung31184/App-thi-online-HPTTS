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
