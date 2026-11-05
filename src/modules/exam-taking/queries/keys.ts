export const examTakingKeys = {
  root: ['exam-taking'] as const,
  availableWindows: () => [...examTakingKeys.root, 'available-windows'] as const,
  examRules: (examId: string) => [...examTakingKeys.root, 'exam-rules', examId] as const,
  attempt: (attemptId: string) => [...examTakingKeys.root, 'attempt', attemptId] as const,
};
