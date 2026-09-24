import { supabase } from '../../../lib/supabaseClient';
import type { ModuleItem, Occupation } from '../../../types';
import type {
  ImportSourceKind,
  LibraryQuestion,
  QuestionImportDraft,
  QuestionImportJob,
  QuestionLibrary,
  TaxonomyNode,
} from '../domain/question-library';

type Row = Record<string, unknown>;

export async function listQuestionLibraryOccupations(): Promise<Occupation[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, name, code')
    .order('name');
  if (error) throw error;
  return (data ?? []).map((row) => {
    const value = row as Row;
    return {
      id: string(value.id),
      name: string(value.name),
      code: nullableString(value.code) ?? undefined,
    };
  });
}

export async function listQuestionLibraryModules(occupationId: string): Promise<ModuleItem[]> {
  const { data, error } = await supabase
    .from('course_modules')
    .select('modules(id, name, code, is_deleted)')
    .eq('course_id', occupationId);
  if (error) throw error;

  const modules = new Map<string, ModuleItem>();
  for (const row of data ?? []) {
    const related = (row as Row).modules;
    const values = Array.isArray(related) ? related : related && typeof related === 'object' ? [related] : [];
    for (const item of values) {
      const module = item as Row;
      if (module.is_deleted === true) continue;
      const id = string(module.id);
      if (!id) continue;
      modules.set(id, {
        id,
        name: string(module.name),
        code: nullableString(module.code) ?? undefined,
      });
    }
  }
  return [...modules.values()];
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function libraryFromRow(row: Row): QuestionLibrary {
  return {
    id: string(row.id),
    occupationId: string(row.occupation_id),
    moduleId: nullableString(row.module_id),
    name: string(row.name),
    description: string(row.description),
    status: row.status === 'archived' ? 'archived' : 'active',
    createdAt: string(row.created_at),
  };
}

function importJobFromRow(row: Row): QuestionImportJob {
  const sourceKind = row.source_kind;
  return {
    id: string(row.id),
    libraryId: string(row.library_id),
    sourceFileName: string(row.source_file_name),
    sourceKind: ['xlsx', 'csv', 'zip', 'docx', 'pdf', 'image'].includes(String(sourceKind))
      ? sourceKind as ImportSourceKind
      : 'pdf',
    status: ['queued', 'processing', 'review_required', 'failed', 'completed'].includes(String(row.status))
      ? row.status as QuestionImportJob['status']
      : 'failed',
    totalDrafts: Number(row.total_drafts ?? 0),
    errorMessage: nullableString(row.error_message),
    createdAt: string(row.created_at),
  };
}

export async function listQuestionLibraries(): Promise<QuestionLibrary[]> {
  const { data, error } = await supabase
    .from('question_libraries')
    .select('id, occupation_id, module_id, name, description, status, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => libraryFromRow(row as Row));
}

export async function createQuestionLibrary(input: {
  occupationId: string;
  moduleId: string | null;
  name: string;
  description: string;
  createdBy: string;
}): Promise<QuestionLibrary> {
  const { data, error } = await supabase
    .from('question_libraries')
    .insert({
      occupation_id: input.occupationId,
      module_id: input.moduleId,
      name: input.name.trim(),
      description: input.description.trim(),
      created_by: input.createdBy,
    })
    .select('id, occupation_id, module_id, name, description, status, created_at')
    .single();
  if (error) throw new Error(error.message);
  return libraryFromRow(data as Row);
}

export async function listTaxonomyNodes(libraryId: string): Promise<TaxonomyNode[]> {
  const { data, error } = await supabase
    .from('question_taxonomy_nodes')
    .select('id, library_id, parent_id, name, node_type, sort_order')
    .eq('library_id', libraryId)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []).map((row) => {
    const value = row as Row;
    return {
      id: string(value.id), libraryId: string(value.library_id), parentId: nullableString(value.parent_id),
      name: string(value.name), nodeType: value.node_type === 'outcome' ? 'outcome' : 'topic', sortOrder: Number(value.sort_order ?? 0),
    };
  });
}

export async function createTaxonomyNode(input: {
  libraryId: string;
  parentId: string | null;
  name: string;
  nodeType: TaxonomyNode['nodeType'];
  sortOrder: number;
}): Promise<TaxonomyNode> {
  const { data, error } = await supabase
    .from('question_taxonomy_nodes')
    .insert({ library_id: input.libraryId, parent_id: input.parentId, name: input.name.trim(), node_type: input.nodeType, sort_order: input.sortOrder })
    .select('id, library_id, parent_id, name, node_type, sort_order')
    .single();
  if (error) throw error;
  const row = data as Row;
  return { id: string(row.id), libraryId: string(row.library_id), parentId: nullableString(row.parent_id), name: string(row.name), nodeType: row.node_type === 'outcome' ? 'outcome' : 'topic', sortOrder: Number(row.sort_order ?? 0) };
}

export async function listLibraryQuestions(libraryId: string): Promise<LibraryQuestion[]> {
  const { data, error } = await supabase
    .from('question_bank')
    .select('id, library_id, taxonomy_node_id, question_type, stem, options, answer_key, points, topic, difficulty, cognitive_level, status, image_url, media_url, created_at')
    .eq('library_id', libraryId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((item) => {
    const row = item as Row;
    return {
      id: string(row.id), libraryId: nullableString(row.library_id), taxonomyNodeId: nullableString(row.taxonomy_node_id),
      questionType: string(row.question_type) as LibraryQuestion['questionType'], stem: string(row.stem),
      options: Array.isArray(row.options) ? row.options as { id: string; text: string }[] : [], answerKey: string(row.answer_key),
      points: Number(row.points ?? 0), topic: string(row.topic), difficulty: string(row.difficulty),
      cognitiveLevel: ['recognition', 'comprehension', 'application'].includes(String(row.cognitive_level)) ? row.cognitive_level as LibraryQuestion['cognitiveLevel'] : null,
      status: ['draft', 'review', 'published', 'retired'].includes(String(row.status)) ? row.status as LibraryQuestion['status'] : 'published',
      imageUrl: nullableString(row.image_url), mediaUrl: nullableString(row.media_url), createdAt: nullableString(row.created_at),
    };
  });
}

export async function createImportJob(input: {
  libraryId: string;
  requestedBy: string;
  file: File;
  sourceKind: ImportSourceKind;
}): Promise<QuestionImportJob> {
  const { data: job, error: jobError } = await supabase
    .from('question_import_jobs')
    .insert({ library_id: input.libraryId, requested_by: input.requestedBy, source_file_name: input.file.name, source_file_path: 'pending', source_kind: input.sourceKind })
    .select('id, library_id, source_file_name, source_kind, status, total_drafts, error_message, created_at')
    .single();
  if (jobError) throw jobError;
  const id = string((job as Row).id);
  const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${input.requestedBy}/${id}/${safeName}`;
  const { error: uploadError } = await supabase.storage.from('question-imports').upload(path, input.file, { upsert: false });
  if (uploadError) {
    await supabase.from('question_import_jobs').update({ status: 'failed', error_message: uploadError.message }).eq('id', id);
    throw uploadError;
  }
  const { data, error } = await supabase
    .from('question_import_jobs')
    .update({ source_file_path: path })
    .eq('id', id)
    .select('id, library_id, source_file_name, source_kind, status, total_drafts, error_message, created_at')
    .single();
  if (error) throw error;
  return importJobFromRow(data as Row);
}

export async function requestImportProcessing(jobId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Phiên đăng nhập đã hết hạn.');
  const response = await fetch('/api/process-question-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ job_id: jobId }),
  });
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(body.message ?? 'Không thể gửi tài liệu đến worker xử lý.');
}

export async function listImportJobs(libraryId: string): Promise<QuestionImportJob[]> {
  const { data, error } = await supabase
    .from('question_import_jobs')
    .select('id, library_id, source_file_name, source_kind, status, total_drafts, error_message, created_at')
    .eq('library_id', libraryId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => importJobFromRow(row as Row));
}

export async function listImportDrafts(jobId: string): Promise<QuestionImportDraft[]> {
  const { data, error } = await supabase
    .from('question_import_drafts')
    .select('id, job_id, sequence_number, source_page, payload, image_paths, confidence, validation_issues, status')
    .eq('job_id', jobId)
    .order('sequence_number');
  if (error) throw error;
  return (data ?? []).map((item) => {
    const row = item as Row;
    return {
      id: string(row.id), jobId: string(row.job_id), sequenceNumber: Number(row.sequence_number), sourcePage: typeof row.source_page === 'number' ? row.source_page : null,
      payload: row.payload && typeof row.payload === 'object' ? row.payload as Partial<LibraryQuestion> : {},
      imagePaths: Array.isArray(row.image_paths) ? row.image_paths.filter((path): path is string => typeof path === 'string') : [],
      confidence: typeof row.confidence === 'number' ? row.confidence : null,
      validationIssues: Array.isArray(row.validation_issues) ? row.validation_issues.filter((issue): issue is string => typeof issue === 'string') : [],
      status: ['pending', 'accepted', 'rejected', 'imported'].includes(String(row.status)) ? row.status as QuestionImportDraft['status'] : 'pending',
    };
  });
}
