import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { ElearningLesson, ElearningLessonBlock, ElearningProgress } from '../../../types';
import { useAuth } from '../../identity-access/public';
import {
  flushProgressKeepalive,
  getLesson,
  getLessonBlocks,
  getMyProgress,
  upsertBlockProgress,
  watchLearningToken,
} from './legacy-learning';

export function useLegacyPlayer() {

  const { lessonId } = useParams<{ lessonId: string }>();
  const {
    user, studentSession,
  } = useAuth();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<ElearningLesson | null>(null);
  const [blocks, setBlocks] = useState<ElearningLessonBlock[]>([]);
  const [progress, setProgress] = useState<ElearningProgress[]>([]);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /** Các block Drive mà <video> không phát được → đã chuyển sang iframe preview. */
  const [driveVideoFailed, setDriveVideoFailed] = useState<Set<string>>(new Set());

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastSavedSecondsRef = useRef(0);
  /** Số giây đang xem hiện tại của block active (cập nhật mỗi timeupdate) — dùng cho ghi vét. */
  const currentSecondsRef = useRef(0);
  const activeBlockRef = useRef<ElearningLessonBlock | null>(null);
  const accessTokenRef = useRef<string>('');

  const studentId = user?.student_id ?? studentSession?.student_id ?? null;
  const userId = user?.id ?? null;
  /** Admin/GV xem trước: không ghi tiến độ, không hiện nút hoàn thành. */
  const isStaffPreview = user?.role === 'admin' || user?.role === 'teacher';

  // Giữ access token sẵn cho ghi vét lúc pagehide (không kịp gọi async getSession khi đó)
  useEffect(() => {
    return watchLearningToken((value) => { accessTokenRef.current = value; });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!lessonId) return;
    (async () => {
      try {
        const [les, blks, prog] = await Promise.all([
          getLesson(lessonId),
          getLessonBlocks(lessonId),
          isStaffPreview ? Promise.resolve([]) : getMyProgress([lessonId]),
        ]);
        if (cancelled) return;
        if (!les) {
          setError('Không tìm thấy bài học hoặc bài chưa được xuất bản.');
          return;
        }
        setLesson(les);
        setBlocks(blks);
        setProgress(prog);
        // Mở khối đầu tiên chưa hoàn thành (hoặc khối đầu)
        const doneSet = new Set(prog.filter((p) => p.status === 'completed').map((p) => p.block_id));
        const firstPending = blks.find((b) => !doneSet.has(b.id));
        setActiveBlockId((firstPending ?? blks[0])?.id ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Lỗi tải bài học.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, isStaffPreview]);

  const activeBlock = useMemo(
    () => blocks.find((b) => b.id === activeBlockId) ?? null,
    [blocks, activeBlockId]
  );
  useEffect(() => {
    activeBlockRef.current = activeBlock;
  }, [activeBlock]);

  const doneBlockIds = useMemo(
    () => new Set(progress.filter((p) => p.status === 'completed').map((p) => p.block_id)),
    [progress]
  );

  /** Số giây đã lưu trong DB của 1 block (để resume). */
  const savedSecondsFor = useCallback(
    (blockId: string): number => progress.find((p) => p.block_id === blockId)?.watched_seconds ?? 0,
    [progress]
  );

  /**
   * Ghi vét tiến độ block đang xem (đổi khối, unmount, đóng tab).
   * keepalive=true khi trang đang đóng — dùng fetch keepalive thay supabase-js.
   */
  const flushCurrentProgress = useCallback(
    (keepalive: boolean) => {
      const block = activeBlockRef.current;
      const seconds = Math.floor(currentSecondsRef.current);
      if (isStaffPreview || !block || !userId || !lessonId) return;
      if (block.block_type !== 'video' || seconds <= 3) return;
      if (doneBlockIds.has(block.id)) return; // đã hoàn thành — không cần vét
      if (seconds <= lastSavedSecondsRef.current) return; // không có gì mới để lưu

      lastSavedSecondsRef.current = seconds;
      const input = { userId, studentId, lessonId, blockId: block.id, watchedSeconds: seconds };
      if (keepalive) {
        flushProgressKeepalive(accessTokenRef.current, input);
      } else {
        void upsertBlockProgress(input).catch(() => {/* best-effort */ });
      }
    },
    [isStaffPreview, userId, studentId, lessonId, doneBlockIds]
  );

  // Đóng tab / chuyển app / minimize → ghi vét bằng keepalive
  useEffect(() => {
    const onPageHide = () => flushCurrentProgress(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushCurrentProgress(true);
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flushCurrentProgress(false); // unmount (bấm "← Danh sách bài học")
    };
  }, [flushCurrentProgress]);

  const markCompleted = useCallback(
    async (block: ElearningLessonBlock, watchedSeconds?: number) => {
      if (isStaffPreview) return; // xem trước: không ghi tiến độ
      if (!userId || !lessonId) {
        toast.error('Cần đăng nhập tài khoản thi để lưu tiến độ học.');
        return;
      }
      if (doneBlockIds.has(block.id)) return;
      try {
        await upsertBlockProgress({
          userId,
          studentId,
          lessonId,
          blockId: block.id,
          watchedSeconds,
          completed: true,
        });
        setProgress((prev) => {
          const others = prev.filter((p) => p.block_id !== block.id);
          return [
            ...others,
            {
              id: `local-${block.id}`,
              user_id: userId,
              student_id: studentId,
              lesson_id: lessonId,
              block_id: block.id,
              status: 'completed',
              watched_seconds: Math.floor(watchedSeconds ?? 0),
              quiz_attempts: 0,
              completed_at: new Date().toISOString(),
            },
          ];
        });
        toast.success('Đã ghi nhận hoàn thành mục này');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Không lưu được tiến độ.');
      }
    },
    [userId, studentId, lessonId, doneBlockIds, isStaffPreview]
  );

  /** Video HTML5: lưu watched_seconds mỗi 15s, tự hoàn thành khi ≥90%. */
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !activeBlock) return;
    const current = Math.floor(v.currentTime);
    currentSecondsRef.current = current; // luôn cập nhật để ghi vét chính xác
    if (isStaffPreview || !userId || !lessonId) return;
    if (v.duration && current / v.duration >= 0.9 && !doneBlockIds.has(activeBlock.id)) {
      void markCompleted(activeBlock, current);
      return;
    }
    if (current - lastSavedSecondsRef.current >= 15 && !doneBlockIds.has(activeBlock.id)) {
      lastSavedSecondsRef.current = current;
      void upsertBlockProgress({
        userId,
        studentId,
        lessonId,
        blockId: activeBlock.id,
        watchedSeconds: current,
      }).catch(() => {/* lưu nháp tiến độ — bỏ qua lỗi mạng tạm thời */ });
    }
  }, [activeBlock, userId, studentId, lessonId, doneBlockIds, markCompleted, isStaffPreview]);

  /** RESUME: video sẵn sàng → tua đến chỗ xem dở (trừ block đã hoàn thành). */
  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v || !activeBlock || isStaffPreview) return;
    if (doneBlockIds.has(activeBlock.id)) return;
    const saved = savedSecondsFor(activeBlock.id);
    // Chỉ resume khi đã xem >5s và chưa sát cuối video (tránh nhảy thẳng đến giây cuối)
    if (saved > 5 && (!v.duration || saved < v.duration - 5)) {
      v.currentTime = saved;
      toast.info(`Tiếp tục từ phút ${Math.floor(saved / 60)}:${String(saved % 60).padStart(2, '0')}`);
    }
  }, [activeBlock, doneBlockIds, savedSecondsFor, isStaffPreview]);

  /** Đổi khối từ sidebar: ghi vét khối cũ trước, reset bộ đếm cho khối mới. */
  const handleSelectBlock = (blockId: string) => {
    if (blockId === activeBlockId) return;
    flushCurrentProgress(false);
    setActiveBlockId(blockId);
    currentSecondsRef.current = 0;
    lastSavedSecondsRef.current = 0;
  };


  return {
    driveVideoFailed, videoRef, handleTimeUpdate, handleLoadedMetadata, setDriveVideoFailed,
    loading, error, lesson, blocks, doneBlockIds, activeBlock, navigate, isStaffPreview,
    activeBlockId, handleSelectBlock, markCompleted,
  };
}
