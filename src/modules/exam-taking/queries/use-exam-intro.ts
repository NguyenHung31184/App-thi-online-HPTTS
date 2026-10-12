import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../identity-access/public';
import { getAttempt } from './session-actions';
import { getExam } from '../../exam-management/public';
import type { Attempt, Exam } from '../../../types';

export function useExamIntro() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const {
    user,
  } = useAuth();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!attemptId) return;
        const a = await getAttempt(attemptId);
        if (!a) {
          if (!cancelled) setError('Không tìm thấy bài làm.');
          return;
        }
        if (user?.id && a.user_id !== user.id) {
          if (!cancelled) setError('Bạn không có quyền làm bài này.');
          return;
        }
        const e = await getExam(a.exam_id);
        if (!cancelled) {
          setAttempt(a);
          setExam(e ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi tải thông tin bài thi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [attemptId, user?.id]);

  const handleStart = () => {
    if (!attemptId || !confirmed) return;
    navigate(`/exam/${attemptId}`);
  };


  return {
    handleStart, confirmed, loading, error, attempt, exam, setConfirmed,
  };
}
