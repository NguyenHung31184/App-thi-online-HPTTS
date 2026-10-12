import { useEffect, useState } from 'react';
import { useAuth } from '../../identity-access/public';
import { listStudentResults, type AttemptWithExam } from './student-results';

export function useStudentResults() {

  const {
    user,
  } = useAuth();
  const [attempts, setAttempts] = useState<AttemptWithExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const data = await listStudentResults(user.id);
        if (!cancelled) setAttempts(data);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Lỗi tải kết quả.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);


  return {
    loading, error, attempts,
  };
}
