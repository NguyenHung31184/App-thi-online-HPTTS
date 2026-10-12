import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getExam } from '../../exam-management/public';
import { listAvailableTheoryWindows, recordTheoryAttemptAuditEvent, startTheoryAttempt } from '../application/manage-theory-attempt';
import { examTakingKeys } from './keys';

export function useAvailableTheoryWindows() {
  return useQuery({ queryKey: examTakingKeys.availableWindows(), queryFn: listAvailableTheoryWindows });
}

/** Duration, question count and pass mark for the rules screen; off while no single exam is known. */
export function useExamForRules(examId: string | null) {
  return useQuery({
    queryKey: examTakingKeys.examRules(examId ?? ''),
    queryFn: () => getExam(examId ?? ''),
    enabled: Boolean(examId),
  });
}

/** Starts the attempt after the student ticked the rules, and records that consent on the attempt. */
export function useStartTheoryAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ windowId, accessCode }: { windowId: string; accessCode: string }) => {
      const attempt = await startTheoryAttempt(windowId, accessCode);
      // The attempt must not fail because the consent line could not be written.
      await recordTheoryAttemptAuditEvent(attempt.id, 'rules_accepted', { accepted_at: new Date().toISOString() }).catch(() => undefined);
      return attempt;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: examTakingKeys.availableWindows() }),
  });
}
