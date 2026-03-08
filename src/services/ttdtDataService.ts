import { supabase } from '../lib/supabaseClient';
import type { ClassItem, ModuleItem } from '../types';

/** Lấy danh sách lớp từ TTDT (bảng classes). Nếu không cùng DB hoặc chưa có bảng thì trả [] */
export async function listClasses(): Promise<ClassItem[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, code')
    .order('name');
  if (error) {
    console.warn('listClasses:', error.message);
    return [];
  }
  return (data ?? []).map((r: { id: string; name: string; code?: string }) => ({
    id: r.id,
    name: r.name ?? '',
    code: r.code,
  }));
}

/** Lấy danh sách học phần từ TTDT (bảng modules). Nếu không cùng DB hoặc chưa có bảng thì trả [] */
export async function listModules(): Promise<ModuleItem[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('id, name, code')
    .order('name');
  if (error) {
    console.warn('listModules:', error.message);
    return [];
  }
  return (data ?? []).map((r: { id: string; name: string; code?: string }) => ({
    id: r.id,
    name: r.name ?? '',
    code: r.code,
  }));
}

/** Lấy class_id của thí sinh từ bảng enrollments (TTDT). Trả [] nếu không có bảng hoặc không có dữ liệu. */
export async function getClassIdsByStudentId(studentId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('class_id')
    .eq('student_id', studentId);
  if (error) {
    console.warn('getClassIdsByStudentId:', error.message);
    return [];
  }
  return [...new Set((data ?? []).map((r: { class_id: string }) => r.class_id))];
}
