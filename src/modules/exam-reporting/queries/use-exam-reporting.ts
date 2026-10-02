import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listExams, listExamWindows } from '../../exam-management/public';
import { listClasses } from '../../integrations/public';
import { listAttemptsForReport, listViolationsForReport, reviewAiProctoringIncident } from '../application/attempt-report';
import { getAttemptResult } from '../application/attempt-result';
import { getAdminDashboardStats, listRecentCompletedAttemptsForDashboard } from '../application/dashboard';
import type { ReportFilters } from '../domain/report-rows';

export const examReportingKeys = {
  all: ['exam-reporting'] as const,
  attemptResult: (id: string) => [...examReportingKeys.all, 'attempt-result', id] as const,
  dashboardStats: () => [...examReportingKeys.all, 'dashboard-stats'] as const,
  recentAttempts: (limit: number) => [...examReportingKeys.all, 'recent-attempts', limit] as const,
  results: (filters: ReportFilters) => [...examReportingKeys.all, 'results', filters] as const,
  violations: (filters: ReportFilters) => [...examReportingKeys.all, 'violations', filters] as const,
  violationsAll: () => [...examReportingKeys.all, 'violations'] as const,
  exams: () => [...examReportingKeys.all, 'exams'] as const,
  windows: () => [...examReportingKeys.all, 'windows'] as const,
  classes: () => [...examReportingKeys.all, 'classes'] as const,
};

/** Refetched on every visit so the start photo link is signed again. */
export function useAttemptResult(attemptId: string | undefined) {
  return useQuery({
    queryKey: examReportingKeys.attemptResult(attemptId ?? ''),
    queryFn: () => getAttemptResult(attemptId as string),
    enabled: Boolean(attemptId),
    staleTime: 0,
    retry: false,
  });
}

export function useDashboardStats() {
  return useQuery({ queryKey: examReportingKeys.dashboardStats(), queryFn: getAdminDashboardStats });
}

export function useRecentAttempts(limit: number) {
  return useQuery({ queryKey: examReportingKeys.recentAttempts(limit), queryFn: () => listRecentCompletedAttemptsForDashboard(limit) });
}

// Report page

export function useReportExams() {
  return useQuery({ queryKey: examReportingKeys.exams(), queryFn: listExams });
}

export function useReportWindows() {
  return useQuery({ queryKey: examReportingKeys.windows(), queryFn: () => listExamWindows() });
}

export function useReportClasses() {
  return useQuery({ queryKey: examReportingKeys.classes(), queryFn: listClasses });
}

export function useAttemptReport(filters: ReportFilters, enabled: boolean) {
  return useQuery({ queryKey: examReportingKeys.results(filters), queryFn: () => listAttemptsForReport(filters), enabled });
}

export function useViolationReport(filters: ReportFilters, enabled: boolean) {
  return useQuery({ queryKey: examReportingKeys.violations(filters), queryFn: () => listViolationsForReport(filters), enabled });
}

export function useReviewIncident() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'confirmed' | 'rejected' }) => reviewAiProctoringIncident(id, decision),
    onSuccess: () => client.invalidateQueries({ queryKey: examReportingKeys.violationsAll() }),
  });
}
