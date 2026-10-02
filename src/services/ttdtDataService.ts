// Moved to src/modules/integrations; kept until the last consumer imports the module.
export {
  getClassIdsByStudentId, listClasses, listModules, listModulesByClassId, listModulesByOccupationId, listModulesWithCourses,
} from '../modules/integrations/public';
export type { ModuleWithCourse } from '../modules/integrations/public';
