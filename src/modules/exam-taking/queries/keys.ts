export const examTakingKeys = {
  root: ['exam-taking'] as const,
  availableWindows: () => [...examTakingKeys.root, 'available-windows'] as const,
  attempt: (attemptId: string) => [...examTakingKeys.root, 'attempt', attemptId] as const,
};
