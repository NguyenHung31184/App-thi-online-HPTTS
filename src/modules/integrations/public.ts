export {
  getClassIdsByStudentId, listClasses, listModules, listModulesByClassId, listModulesByOccupationId, listModulesWithCourses,
} from './application/ttdt-directory';
export type { ModuleWithCourse } from './domain/ttdt-directory';
export { analyzeCccdByImageFile, isOcrConfigured } from './application/ocr';
