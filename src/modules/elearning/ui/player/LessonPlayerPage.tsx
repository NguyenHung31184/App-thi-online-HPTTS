import { useParams, useSearchParams } from 'react-router-dom';
import type { ElearningLessonBlock } from '../../../../types';
import { useAuth } from '../../../identity-access/public';
import { useLegacyPlayer } from '../../queries/use-legacy-player';
import { AssignedLessonPlayer } from '../AssignedLessonPlayer';

/** Lấy YouTube video id từ các dạng link phổ biến. */
const youtubeId = (url: string): string | null => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  return m ? m[1] : null;
};

/** Lấy file id từ link Google Drive. */
const driveFileId = (url: string): string | null => {
  const m = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/i);
  return m ? m[1] : null;
};

/** Link Google Drive xem trước (file/d/<id>/preview) — fallback khi <video> không phát được. */
const drivePreviewUrl = (url: string): string => {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/file/d/${id}/preview` : url;
};

/** Link phát trực tiếp MP4 từ Drive — để <video> track được timeupdate. */
const driveDirectUrl = (url: string): string | null => {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : null;
};

/**
 * Trang học 1 bài: sidebar khối nội dung + vùng hiển thị (video/pdf/bài viết).
 * - Video HTML5 (Cloudinary/VPS/Drive MP4 trực tiếp): tự hoàn thành khi xem ≥90%,
 *   RESUME đúng chỗ xem dở (watched_seconds), lưu tiến độ mỗi 15s.
 * - Drive: thử <video> link uc?export=download trước (track được); file lớn/bị chặn → fallback iframe.
 * - Rời trang / đổi khối / đóng tab: ghi vét số giây đang xem (fetch keepalive khi pagehide).
 * - Video YouTube (iframe): bấm "Đánh dấu đã học xong".
 */
export default function LessonPlayerPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const [search] = useSearchParams();
  const { user, loading } = useAuth();
  const assignmentId = search.get('assignment');
  const enrollmentId = search.get('enrollment');
  if (assignmentId || enrollmentId) {
    if (loading) return <p role="status">Đang tải tài khoản...</p>;
    if (!user?.id || !assignmentId || !enrollmentId || !lessonId) return <p role="alert">Thiếu thông tin bài học hoặc phiên đăng nhập.</p>;
    return <AssignedLessonPlayer key={`${user.id}:${enrollmentId}:${assignmentId}`} userId={user.id} enrollmentId={enrollmentId} assignmentId={assignmentId} lessonId={lessonId} />;
  }
  return <LegacyLessonPlayer />;
}

function LegacyLessonPlayer() {
  const {
    driveVideoFailed, videoRef, handleTimeUpdate, handleLoadedMetadata, setDriveVideoFailed,
    loading, error, lesson, blocks, doneBlockIds, activeBlock, navigate, isStaffPreview,
    activeBlockId, handleSelectBlock, markCompleted,
  } = useLegacyPlayer();
  const renderContent = (block: ElearningLessonBlock) => {
    if (block.block_type === 'article') {
      return (
        <article className="prose prose-slate max-w-none bg-white border border-slate-200 rounded-2xl p-6 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">
          {block.body_richtext}
        </article>
      );
    }

    const url = block.content_url ?? '';

    if (block.block_type === 'pdf') {
      const src = block.storage_provider === 'drive' ? drivePreviewUrl(url) : url;
      return (
        <iframe
          title={block.title ?? 'Tài liệu PDF'}
          src={src}
          className="w-full h-[70vh] bg-white border border-slate-200 rounded-2xl"
        />
      );
    }

    // video
    const yid = block.storage_provider === 'youtube' ? youtubeId(url) : null;
    if (yid) {
      return (
        <div className="aspect-video w-full">
          <iframe
            title={block.title ?? 'Video bài giảng'}
            src={`https://www.youtube-nocookie.com/embed/${yid}?rel=0`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full rounded-2xl border border-slate-200 bg-black"
          />
        </div>
      );
    }

    if (block.storage_provider === 'drive') {
      const directUrl = driveDirectUrl(url);
      // Thử <video> trước để track được; phát lỗi (file lớn bị Drive chặn stream) → iframe
      if (directUrl && !driveVideoFailed.has(block.id)) {
        return (
          <video
            ref={videoRef}
            key={block.id}
            src={directUrl}
            controls
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onError={() => {
              setDriveVideoFailed((prev) => new Set([...prev, block.id]));
            }}
            className="w-full rounded-2xl border border-slate-200 bg-black max-h-[70vh]"
          />
        );
      }
      return (
        <div className="aspect-video w-full">
          <iframe
            title={block.title ?? 'Video bài giảng'}
            src={drivePreviewUrl(url)}
            allow="autoplay"
            allowFullScreen
            className="w-full h-full rounded-2xl border border-slate-200 bg-black"
          />
        </div>
      );
    }

    // Cloudinary / VPS / link mp4 trực tiếp → HTML5 video, tự tracking + resume
    return (
      <video
        ref={videoRef}
        key={block.id}
        src={url}
        controls
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        className="w-full rounded-2xl border border-slate-200 bg-black max-h-[70vh]"
      />
    );
  };

  if (loading) return <p className="text-slate-500">Đang tải bài học...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!lesson) return null;

  const doneCount = blocks.filter((b) => doneBlockIds.has(b.id)).length;
  /** Video iframe (YouTube hoặc Drive đã fallback) → cần nút hoàn thành tay. */
  const activeIsIframeVideo =
    !!activeBlock &&
    activeBlock.block_type === 'video' &&
    (activeBlock.storage_provider === 'youtube' ||
      (activeBlock.storage_provider === 'drive' && driveVideoFailed.has(activeBlock.id)));

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header bài học */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate('/student/learn')}
            className="text-xs text-indigo-600 hover:underline mb-1"
          >
            ← Danh sách bài học
          </button>
          <h2 className="text-lg font-bold text-slate-800 truncate">{lesson.title}</h2>
          {isStaffPreview ? (
            <p className="text-xs font-medium text-amber-600">👁 Chế độ xem trước — tiến độ không được ghi</p>
          ) : (
            <p className="text-xs text-slate-500">
              Hoàn thành {doneCount}/{blocks.length} mục
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sidebar khối nội dung */}
        <aside className="lg:w-72 flex-shrink-0 bg-white border border-slate-200 rounded-2xl p-2 h-fit">
          {blocks.length === 0 && (
            <p className="text-sm text-slate-400 p-3">Bài học chưa có nội dung.</p>
          )}
          {blocks.map((b, idx) => {
            const done = doneBlockIds.has(b.id);
            const isActive = b.id === activeBlockId;
            const typeLabel =
              b.block_type === 'video' ? 'Video' : b.block_type === 'pdf' ? 'PDF' : b.block_type === 'article' ? 'Bài viết' : 'Quiz';
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => handleSelectBlock(b.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 flex items-center gap-2.5 transition-colors ${isActive ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-slate-50 border border-transparent'
                  }`}
              >
                <span
                  className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}
                >
                  {done ? '✓' : idx + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm truncate ${isActive ? 'font-semibold text-indigo-700' : 'text-slate-700'}`}>
                    {b.title || typeLabel}
                  </span>
                  <span className="block text-[11px] text-slate-400">
                    {typeLabel}
                    {b.duration_seconds ? ` · ${Math.round(b.duration_seconds / 60)} phút` : ''}
                  </span>
                </span>
              </button>
            );
          })}
        </aside>

        {/* Vùng nội dung */}
        <main className="flex-1 min-w-0">
          {activeBlock ? (
            <>
              {activeBlock.title && (
                <h3 className="text-sm font-semibold text-slate-700 mb-2">{activeBlock.title}</h3>
              )}
              {renderContent(activeBlock)}
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  {isStaffPreview
                    ? 'Đang xem với tư cách quản trị — học viên sẽ thấy nút ghi nhận hoàn thành ở đây.'
                    : activeBlock.block_type === 'video' && !activeIsIframeVideo
                      ? 'Xem hết video sẽ tự ghi nhận hoàn thành. Thoát giữa chừng — lần sau xem tiếp từ chỗ dở.'
                      : 'Học xong mục này, bấm nút bên phải để ghi nhận.'}
                </p>
                {isStaffPreview ? null : doneBlockIds.has(activeBlock.id) ? (
                  <span className="px-3 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-xl flex-shrink-0">
                    ✓ Đã hoàn thành
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => markCompleted(activeBlock, videoRef.current?.currentTime)}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex-shrink-0"
                  >
                    Đánh dấu đã học xong
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm">Chọn một mục bên trái để bắt đầu học.</p>
          )}
        </main>
      </div>
    </div>
  );
}
