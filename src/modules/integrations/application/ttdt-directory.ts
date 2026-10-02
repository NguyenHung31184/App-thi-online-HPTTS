import type { ClassItem, ModuleItem } from '../../../types';
import {
  selectClasses, selectClassIdsOfStudent, selectCourseModuleRows, selectCourseModuleRowsOf, selectModules,
} from '../data/ttdt-directory-repository';
import { modulesWithCourses, uniqueModules, type ModuleWithCourse } from '../domain/ttdt-directory';

/** Classes of the TTDT app (main app database). */
export function listClasses(): Promise<ClassItem[]> {
  return selectClasses();
}

export function listModules(): Promise<ModuleItem[]> {
  return selectModules();
}

/** Modules grouped by course for pickers; without any course link, every module under "Toàn bộ mô-đun". */
export async function listModulesWithCourses(): Promise<ModuleWithCourse[]> {
  const result = modulesWithCourses(await selectCourseModuleRows());
  if (result.length > 0) return result;
  return (await selectModules()).map((module) => ({ ...module, course_id: undefined, course_name: 'Toàn bộ mô-đun' }));
}

/** Modules of a course (courses.id ↔ course_modules ↔ modules). */
export async function listModulesByOccupationId(occupationId: string): Promise<ModuleItem[]> {
  return uniqueModules(await selectCourseModuleRowsOf(occupationId));
}

/** Modules of a class. The main app has no class–module link yet, so every module is returned. */
export function listModulesByClassId(classId: string): Promise<ModuleItem[]> {
  void classId;
  return selectModules();
}

export function getClassIdsByStudentId(studentId: string): Promise<string[]> {
  return selectClassIdsOfStudent(studentId);
}
