export {
  getClassIdsByStudentId, listClasses, listModules, listModulesByClassId, listModulesByOccupationId, listModulesWithCourses,
} from './application/ttdt-directory';
export type { ModuleWithCourse } from './domain/ttdt-directory';
export { analyzeCccdByImageFile, isOcrConfigured } from './application/ocr';
export {
  isTtdtSyncConfigured, listExamSyncLog, listPracticalSyncLog, syncAttemptToTtdt, syncPracticalAttemptToTtdt,
  type SyncResult,
} from './application/ttdt-sync';
export type { ExamSyncLogEntry, PracticalSyncLogEntry, SyncStatus } from './domain/sync-log';
export { default as SyncLogPage } from './ui/sync-log/SyncLogPage';
