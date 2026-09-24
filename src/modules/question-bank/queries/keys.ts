export const questionBankKeys = {
  all: ['question-bank'] as const,
  libraries: () => [...questionBankKeys.all, 'libraries'] as const,
  workspace: (libraryId: string) => [...questionBankKeys.all, 'workspace', libraryId] as const,
  drafts: (jobId: string) => [...questionBankKeys.all, 'drafts', jobId] as const,
  question: (questionId: string) => [...questionBankKeys.all, 'question', questionId] as const,
  legacyLink: (target: string, moduleId: string, questionId: string) => [...questionBankKeys.all, 'legacy-link', target, moduleId, questionId] as const,
  occupations: () => [...questionBankKeys.all, 'occupations'] as const,
  modules: (occupationId: string) => [...questionBankKeys.all, 'modules', occupationId] as const,
};
