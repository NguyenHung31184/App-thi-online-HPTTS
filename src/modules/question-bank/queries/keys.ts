export const questionBankKeys = {
  all: ['question-bank'] as const,
  libraries: () => [...questionBankKeys.all, 'libraries'] as const,
  workspace: (libraryId: string) => [...questionBankKeys.all, 'workspace', libraryId] as const,
  drafts: (jobId: string) => [...questionBankKeys.all, 'drafts', jobId] as const,
};
