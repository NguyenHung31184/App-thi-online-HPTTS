export const regulationKeys = {
  root: ['regulation'] as const,
  myStatus: () => [...regulationKeys.root, 'my-status'] as const,
};
