/** Moved to the exam-reporting module; kept as re-exports until the report page moves (phase 2). */
export {
  exportReportToExcel, exportViolationsToExcel, listAttemptsForReport, listViolationsForReport, reviewAiProctoringIncident,
  type AttemptReportRow, type ReportFilters, type ViolationReportRow,
} from '../modules/exam-reporting/public';
