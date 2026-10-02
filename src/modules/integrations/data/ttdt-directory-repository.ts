import { supabase } from '../../../platform/supabase/client';
import type { ClassItem, ModuleItem } from '../../../types';

// Each read returns [] when the TTDT table is missing or unreadable, so the admin forms still open.

export async function selectClasses(): Promise<ClassItem[]> {
  const { data, error } = await supabase.from('classes').select('id, name, code').order('name');
  if (error) {
    console.warn('listClasses:', error.message);
    return [];
  }
  return (data ?? []).map((row: { id: string; name: string; code?: string }) => ({ id: row.id, name: row.name ?? '', code: row.code }));
}

export async function selectModules(): Promise<ModuleItem[]> {
  const { data, error } = await supabase.from('modules').select('id, name, code').order('name');
  if (error) {
    console.warn('listModules:', error.message);
    return [];
  }
  return (data ?? []).map((row: { id: string; name: string; code?: string }) => ({ id: row.id, name: row.name ?? '', code: row.code }));
}

/** `course_modules` rows with their course name and module. */
export async function selectCourseModuleRows(): Promise<unknown[]> {
  const { data, error } = await supabase.from('course_modules').select('course_id, courses:course_id (name), modules(id, name, code, is_deleted)');
  if (error) {
    console.warn('listModulesWithCourses:', error.message);
    return [];
  }
  return (data ?? []) as unknown[];
}

/** `course_modules` rows of one course, with their module. */
export async function selectCourseModuleRowsOf(courseId: string): Promise<unknown[]> {
  const { data, error } = await supabase.from('course_modules').select('modules(id, name, code, is_deleted)').eq('course_id', courseId);
  if (error) {
    console.warn('listModulesByOccupationId:', error.message);
    return [];
  }
  return (data ?? []) as unknown[];
}

export async function selectClassIdsOfStudent(studentId: string): Promise<string[]> {
  const { data, error } = await supabase.from('enrollments').select('class_id').eq('student_id', studentId);
  if (error) {
    console.warn('getClassIdsByStudentId:', error.message);
    return [];
  }
  return [...new Set((data ?? []).map((row: { class_id: string }) => row.class_id))];
}
