import { getClassIdsByStudentId } from '../../integrations/public';
import { getModuleIdsByClassIds, getPublishedModuleLessonRows } from '../data/legacy-learning-repository';
import type { ModuleWithLessons } from '../domain/legacy-learning';
export { getLesson, getLessonBlocks, getBlocksMeta, getMyProgress, upsertBlockProgress, flushProgressKeepalive } from '../data/legacy-learning-repository';
export { watchLearningToken } from '../data/assigned-learning-repository';
export type { ModuleWithLessons } from '../domain/legacy-learning';

/** Bài học đã xuất bản theo lớp bất kỳ — dùng cho chế độ xem trước của admin/GV. */
export async function getModulesWithLessonsByClassIds(classIds: string[]): Promise<ModuleWithLessons[]> {
  const moduleIds = await getModuleIdsByClassIds(classIds);
  return getModulesWithLessonsByModuleIds(moduleIds);
}

/** Bài học đã xuất bản, gom theo mô-đun của học viên (RLS chỉ trả bài is_published). */
export async function getMyModulesWithLessons(studentId: string): Promise<ModuleWithLessons[]> {
  const classIds = await getClassIdsByStudentId(studentId);
  const moduleIds = await getModuleIdsByClassIds(classIds);
  return getModulesWithLessonsByModuleIds(moduleIds);
}


async function getModulesWithLessonsByModuleIds(moduleIds: string[]): Promise<ModuleWithLessons[]> {
  const { modules, lessons } = await getPublishedModuleLessonRows(moduleIds);
  return modules.map((module) => ({ module_id: module.id, module_name: module.name, module_code: module.code,
    lessons: lessons.filter((lesson) => lesson.module_id === module.id),
  })).filter((module) => module.lessons.length > 0).sort((a, b) => a.module_name.localeCompare(b.module_name));
}
