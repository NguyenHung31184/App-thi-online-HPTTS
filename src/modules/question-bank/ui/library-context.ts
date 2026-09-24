import { useOutletContext } from 'react-router-dom';
import type { getQuestionLibraryWorkspace } from '../application/manage-question-library';
import type { QuestionLibrary } from '../domain/question-library';

type Workspace = Awaited<ReturnType<typeof getQuestionLibraryWorkspace>>;

export interface LibraryOutletContext {
  library: QuestionLibrary;
  workspace: Workspace | undefined;
  workspaceLoading: boolean;
  workspaceError: unknown;
  refetchWorkspace: () => void;
}

export function useLibraryContext() {
  return useOutletContext<LibraryOutletContext>();
}
