import { supabase } from '../lib/supabaseClient';
import type { ExamWindow } from '../types';
import { getClassIdsByStudentId } from './ttdtDataService';

export interface ExamWindowWithExam extends ExamWindow {
  exam_title?: string;
  class_name?: string;
}

export async function listExamWindows(filters?: { exam_id?: string; class_id?: string }): Promise<ExamWindow[]> {
  let q = supabase.from('exam_windows').select('*').order('start_at', { ascending: false });
  if (filters?.exam_id) {
    q = q.or(`exam_id.eq.${filters.exam_id},exam_ids.ov.{"${filters.exam_id}"}`);
  }
  if (filters?.class_id) q = q.eq('class_id', filters.class_id);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ExamWindow[];
}

export async function getExamWindow(id: string): Promise<ExamWindow | null> {
  const { data, error } = await supabase.from('exam_windows').select('*').eq('id', id).single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data as ExamWindow;
}

/** Trả về exam_id dùng khi tạo attempt: nếu kỳ thi có exam_ids thì quay ngẫu nhiên 1, không thì dùng exam_id. */
export function getExamIdForNewAttempt(window: ExamWindow): string {
  const ids = window.exam_ids?.filter(Boolean);
  if (ids && ids.length > 0) {
    return ids[Math.floor(Math.random() * ids.length)]!;
  }
  return window.exam_id;
}

export interface CreateExamWindowInput {
  /** Đề thi (bắt buộc nếu không dùng exam_ids). Khi dùng exam_ids thì lấy exam_id = exam_ids[0] để hiển thị. */
  exam_id?: string;
  /** Nhiều đề: thí sinh vào thi quay ngẫu nhiên 1 trong các đề. Nếu có thì exam_id có thể bỏ qua (sẽ set = exam_ids[0]). */
  exam_ids?: string[];
  class_id: string;
  start_at: number;
  end_at: number;
  access_code: string;
}

export async function createExamWindow(input: CreateExamWindowInput): Promise<ExamWindow> {
  const examIds = input.exam_ids?.filter(Boolean) ?? [];
  const examId = examIds.length > 0 ? examIds[0]! : input.exam_id;
  if (!examId) throw new Error('Cần chọn ít nhất một đề thi (exam_id hoặc exam_ids).');
  const row = {
    exam_id: examId,
    exam_ids: examIds.length > 0 ? examIds : null,
    class_id: input.class_id,
    start_at: input.start_at,
    end_at: input.end_at,
    access_code: input.access_code,
  };
  const { data, error } = await supabase.from('exam_windows').insert(row).select().single();
  if (error) throw error;
  return data as ExamWindow;
}

export interface UpdateExamWindowInput {
  class_id?: string;
  start_at?: number;
  end_at?: number;
  access_code?: string;
  /** Cập nhật danh sách đề (quay 1 trong N). Null = giữ nguyên; [] = xóa, quay lại 1 đề (exam_id). */
  exam_ids?: string[] | null;
}

export async function updateExamWindow(id: string, input: UpdateExamWindowInput): Promise<ExamWindow> {
  const update: Record<string, unknown> = { ...input };
  if (input.exam_ids !== undefined) {
    const ids = input.exam_ids?.filter(Boolean) ?? [];
    (update as Record<string, unknown>).exam_id = ids.length > 0 ? ids[0] : (await getExamWindow(id))?.exam_id;
  }
  const { data, error } = await supabase
    .from('exam_windows')
    .update(update)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ExamWindow;
}

export async function deleteExamWindow(id: string): Promise<void> {
  const { error } = await supabase.from('exam_windows').delete().eq('id', id);
  if (error) throw error;
}

const now = () => Date.now();

/** Cửa sổ thi được phép làm (trong khoảng thời gian; nếu có studentId thì lọc theo lớp từ enrollments). */
export async function getAllowedWindows(
  studentId?: string | null
): Promise<ExamWindowWithExam[]> {
  const nowTs = now();
  let classIds: string[] = [];
  if (studentId) {
    classIds = await getClassIdsByStudentId(studentId);
    if (classIds.length === 0) return [];
  }

  let q = supabase
    .from('exam_windows')
    .select(`
      *,
      exams (title)
    `)
    .lte('start_at', nowTs)
    .gte('end_at', nowTs)
    .order('start_at', { ascending: false });

  if (classIds.length > 0) q = q.in('class_id', classIds);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as (ExamWindow & { exams: { title: string } | null })[];
  const needClassIds = [...new Set(rows.map((r) => r.class_id))];

  let classNames: Record<string, string> = {};
  if (needClassIds.length > 0) {
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name')
      .in('id', needClassIds);
    if (classes) classNames = Object.fromEntries(classes.map((c: { id: string; name: string }) => [c.id, c.name]));
  }

  return rows.map((r) => ({
    ...r,
    exam_title: r.exams?.title,
    class_name: classNames[r.class_id],
  })) as ExamWindowWithExam[];
}
