import { loadStudentResult } from '../application/student-results';
import { loadAttemptSignatureUrl, saveAttemptSignature } from '../application/student-signature';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import type { Attempt, Exam } from '../../../types';
import { getTheoryAttemptWindowContext as getAttemptWindowContext } from '../../exam-taking/public';
import { useAuth } from '../../identity-access/public';
import { isTtdtSyncConfigured, syncAttemptToTtdt } from '../../integrations/public';
import { fetchMyStudentRecord, fetchStartExamPhotoSignedUrl, getLegacyTotalPoints } from './student-results';
import type { StudentRecord } from '../domain/result-identity';

export function useStudentResult() {

  const { attemptId } = useParams<{ attemptId: string }>();
  const location = useLocation();
  const {
    user, studentSession,
  } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [totalMax, setTotalMax] = useState<number | null>(null);
  const [startPhotoUrl, setStartPhotoUrl] = useState<string | null>(null);
  const [studentRecord, setStudentRecord] = useState<StudentRecord | null>(null);
  /** undefined while it is being looked up; null when the student has not signed. */
  const [signatureUrl, setSignatureUrl] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoSyncStatus, setAutoSyncStatus] = useState<'idle' | 'retrying' | 'success' | 'failed'>('idle');

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!attemptId) return;
        const loaded = await loadStudentResult(attemptId, user?.id);
        if (cancelled) return;
        setAttempt(loaded.attempt);
        setExam(loaded.exam);

      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi tải kết quả.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [attemptId, user?.id]);

  useEffect(() => {
    if (!exam?.id) return;
    let cancelled = false;
    const run = async () => {
      try {
        const total = await getLegacyTotalPoints(exam.id);
        if (!cancelled) setTotalMax(total);
      } catch {
        if (!cancelled) setTotalMax(null);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [exam?.id]);

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    (async () => {
      const u = await fetchStartExamPhotoSignedUrl(attemptId);
      if (!cancelled) setStartPhotoUrl(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void fetchMyStudentRecord().then((record) => {
      if (!cancelled) setStudentRecord(record);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const ownerId = attempt?.user_id ?? null;
  useEffect(() => {
    if (!attemptId || !ownerId) return;
    let cancelled = false;
    (async () => {
      try {
        const url = await loadAttemptSignatureUrl(ownerId, attemptId);
        if (!cancelled) setSignatureUrl(url);
      } catch {
        // The lookup failed: ask for the signature rather than leave the page waiting.
        if (!cancelled) setSignatureUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId, ownerId]);

  const saveSignature = useCallback(async (image: Blob) => {
    if (!attemptId) return;
    setSignatureUrl(await saveAttemptSignature(attemptId, image));
  }, [attemptId]);

  // Tự động retry sync nếu lần đầu thất bại (vd: mạng ngắt lúc nộp bài)
  useEffect(() => {
    const search = new URLSearchParams(location.search ?? '');
    const locState = location.state as { syncSkipped?: boolean; isTrial?: boolean } | null;
    if (!(locState?.syncSkipped ?? search.has('syncSkipped'))) return;
    if (locState?.isTrial ?? search.has('isTrial')) return;
    if (!attempt || !exam) return;
    if (attempt.synced_to_ttdt_at) return;
    if (!isTtdtSyncConfigured()) return;

    let cancelled = false;
    (async () => {
      setAutoSyncStatus('retrying');
      try {
        const windowContext = await getAttemptWindowContext(attempt.id);
        if (cancelled) return;
        if (!windowContext || windowContext.is_trial) { setAutoSyncStatus('idle'); return; }
        const hasModule = Boolean(exam.module_id && String(exam.module_id).trim());
        const studentId = (user as { student_id?: string } | null)?.student_id
          ?? studentSession?.student_id
          ?? null;
        const hasStudentId = Boolean(studentId && String(studentId).trim());
        const hasClassId = Boolean(windowContext.class_id && String(windowContext.class_id).trim());
        if (!hasModule || !hasStudentId || !hasClassId) { setAutoSyncStatus('idle'); return; }
        const result = await syncAttemptToTtdt(attempt, exam, {
          studentId,
          classId: windowContext.class_id,
          userEmail: user?.email ?? undefined,
          userName: (studentSession?.student_name
            ?? (user as { student_name?: string } | null)?.student_name
            ?? user?.name) ?? undefined,
        });
        if (!cancelled) setAutoSyncStatus(result.success ? 'success' : 'failed');
      } catch {
        if (!cancelled) setAutoSyncStatus('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [attempt, exam, location.search, location.state, studentSession?.student_id, studentSession?.student_name, user]);

  const handlePrint = () => {
    window.print();
  };


  return {
    loading, error, attempt, exam, location, totalMax, studentSession, user, startPhotoUrl,
    autoSyncStatus, handlePrint, signatureUrl, saveSignature, studentRecord,
  };
}
