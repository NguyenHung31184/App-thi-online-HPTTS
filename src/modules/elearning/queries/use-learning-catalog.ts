import { lessonCompletionStats, isLessonDone as lessonDone } from '../domain/legacy-learning';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ClassItem, ElearningLessonBlock, ElearningProgress } from '../../../types';
import { useAuth } from '../../identity-access/public';
import { listClasses } from '../../integrations/public';
import {
  getBlocksMeta,
  getModulesWithLessonsByClassIds,
  getMyModulesWithLessons,
  getMyProgress,
  type ModuleWithLessons,
} from './legacy-learning';

export function useLearningCatalog() {

  const {
    user, studentSession,
  } = useAuth();
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [blocksMeta, setBlocksMeta] = useState<Pick<ElearningLessonBlock, 'id' | 'lesson_id'>[]>([]);
  const [progress, setProgress] = useState<ElearningProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Chế độ xem trước cho staff
  const isStaffPreview = user?.role === 'admin' || user?.role === 'teacher';
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [previewClassId, setPreviewClassId] = useState('');

  const studentId = user?.student_id ?? studentSession?.student_id ?? null;

  // Staff: tải danh sách lớp cho dropdown xem trước
  useEffect(() => {
    if (!isStaffPreview) return;
    listClasses()
      .then(setClasses)
      .catch(() => setError('Không tải được danh sách lớp.'));
  }, [isStaffPreview]);

  useEffect(() => {
    let cancelled = false;

    // Staff chưa chọn lớp / học viên chưa xác định danh tính → không tải gì
    if (isStaffPreview ? !previewClassId : !studentId) {
      setModules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const mods = isStaffPreview
          ? await getModulesWithLessonsByClassIds([previewClassId])
          : await getMyModulesWithLessons(studentId!);
        if (cancelled) return;
        setModules(mods);
        const lessonIds = mods.flatMap((m) => m.lessons.map((l) => l.id));
        const [meta, prog] = await Promise.all([
          getBlocksMeta(lessonIds),
          isStaffPreview ? Promise.resolve([]) : getMyProgress(lessonIds),
        ]);
        if (cancelled) return;
        setBlocksMeta(meta);
        setProgress(prog);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi tải bài học.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId, isStaffPreview, previewClassId]);

  /** lesson_id → { tổng khối, khối đã xong } */
  const lessonStats = useMemo(() => lessonCompletionStats(blocksMeta, progress), [blocksMeta, progress]);
  const isLessonDone = (lessonId: string) => lessonDone(lessonId, lessonStats);

  return {
    isStaffPreview, studentId, user, previewClassId, setPreviewClassId, classes, loading,
    error, modules, lessonStats, isLessonDone, navigate,
  };
}
