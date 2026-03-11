import { supabase } from '../lib/supabaseClient';
import type { ClassItem, ModuleItem } from '../types';

export interface ModuleWithCourse {
  id: string;
  name: string;
  code?: string;
  course_id?: string;
  course_name?: string;
}

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

/** Lấy toàn bộ học phần kèm thông tin nghề đào tạo (courses) để group theo nghề.
 * Mỗi dòng course_modules = một (nghề, mô-đun); mô-đun dùng chung sẽ xuất hiện ở nhiều nghề.
 * PostgREST trả về courses và modules là object đơn (FK), không phải mảng — cần parse cả hai dạng.
 */
export async function listModulesWithCourses(): Promise<ModuleWithCourse[]> {
  const { data, error } = await supabase
    .from('course_modules')
    .select('course_id, courses:course_id (name), modules(id, name, code, is_deleted)');
  if (error) {
    console.warn('listModulesWithCourses:', error.message);
    return [];
  }
  const raw = (data ?? []) as unknown[];
  const result: ModuleWithCourse[] = [];

  for (const row of raw) {
    const r = row as Record<string, unknown>;
    const courseId = typeof r.course_id === 'string' ? r.course_id : '';
    const courses = r.courses;
    const courseName = Array.isArray(courses)
      ? (courses[0] as Record<string, unknown>)?.name
      : (courses as Record<string, unknown>)?.name;
    const nameStr = typeof courseName === 'string' ? courseName : '';

    const modules = r.modules;
    const modList = Array.isArray(modules) ? modules : modules != null && typeof modules === 'object' ? [modules] : [];
    for (const m of modList) {
      const mod = m as Record<string, unknown> | null;
      if (!mod || mod.is_deleted === true) continue;
      const id = mod.id;
      if (id == null || id === '') continue;
      result.push({
        id: String(id),
        name: typeof mod.name === 'string' ? mod.name : '',
        code: typeof mod.code === 'string' ? mod.code : undefined,
        course_id: courseId,
        course_name: nameStr,
      });
    }
  }

  if (result.length === 0) {
    const all = await listModules();
    return all.map((m) => ({
      id: m.id,
      name: m.name,
      code: m.code,
      course_id: undefined,
      course_name: 'Toàn bộ mô-đun',
    }));
  }
  return result;
}

/** Lấy danh sách học phần theo nghề (course/occupation) dựa trên bảng trung gian course_modules.
 * courses.id ↔ course_modules.course_id ↔ course_modules.module_id ↔ modules.id
 */
export async function listModulesByOccupationId(occupationId: string): Promise<ModuleItem[]> {
  const { data, error } = await supabase
    .from('course_modules')
    .select('modules(id, name, code, is_deleted)')
    .eq('course_id', occupationId);
  if (error) {
    console.warn('listModulesByOccupationId:', error.message);
    return [];
  }
  const modules =
    data
      ?.map((row: any) => row.modules)
      ?.filter((m: any) => m && !m.is_deleted) ?? [];

  const seen = new Set<string>();
  const unique: { id: string; name: string; code?: string }[] = [];
  for (const m of modules) {
    if (!m.id || seen.has(m.id)) continue;
    seen.add(m.id);
    unique.push(m);
  }

  return unique.map((r) => ({
    id: r.id,
    name: r.name ?? '',
    code: r.code,
  }));
}

/**
 * Lấy mô-đun theo lớp (TTDT).
 * Khi app quản lý đã cập nhật quan hệ lớp–mô-đun (vd: bảng class_modules), gọi API tương ứng ở đây.
 * Hiện tại chưa có dữ liệu theo lớp → trả toàn bộ kho mô-đun.
 */
export async function listModulesByClassId(_classId: string): Promise<ModuleItem[]> {
  // TODO: khi có bảng class_modules hoặc API lọc mô-đun theo lớp, thay bằng query tương ứng
  return listModules();
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
