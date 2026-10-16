import { fetchAccessFailures, unlockAccess } from '../data/access-lock-repository';
import type { AccessFailure } from '../domain/access-locks';

/** Students entering wrong access codes at windows open now. */
export const loadAccessFailures = (): Promise<AccessFailure[]> => fetchAccessFailures();

/** Lets one student try the access code again; returns false when the student was no longer counted. */
export const unlockStudentAccess = (windowId: string, userId: string): Promise<boolean> => unlockAccess(windowId, userId);
