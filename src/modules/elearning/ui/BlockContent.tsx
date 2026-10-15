import type { AssignedBlock } from '../domain/assigned-learning';

const YOUTUBE_ID = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i;
const DRIVE_FILE = /drive\.google\.com\/file\/d\/([\w-]+)/i;

/**
 * A block as a learner sees it, without progress tracking: the author's preview.
 * The learner's player renders timed videos itself, because it has to record what was watched.
 */
export function BlockContent({ block }: { block: AssignedBlock }) {
  if (block.block_type === 'article') {
    return (
      <article className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-5 text-slate-700">
        {block.body_richtext}
      </article>
    );
  }
  const url = block.content_url ?? '';
  if (block.block_type === 'pdf') {
    const drive = DRIVE_FILE.exec(url);
    return (
      <iframe
        title={block.title ?? 'Tài liệu PDF'}
        src={drive ? `https://drive.google.com/file/d/${drive[1]}/preview` : url}
        className="h-[70vh] w-full rounded-2xl border border-slate-200"
      />
    );
  }
  if (block.block_type === 'video') {
    if (block.storage_provider === 'youtube') {
      const match = YOUTUBE_ID.exec(url);
      if (!match) return <p role="alert" className="text-sm text-red-700">Đường dẫn YouTube không đọc được. Sửa lại khối này.</p>;
      return (
        <iframe
          title={block.title ?? 'Video bài giảng'}
          src={`https://www.youtube-nocookie.com/embed/${match[1]}?rel=0`}
          allowFullScreen
          className="aspect-video w-full rounded-2xl border border-slate-200"
        />
      );
    }
    return <video src={url} controls playsInline className="aspect-video w-full rounded-2xl border border-slate-200 bg-black" />;
  }
  const questions = block.questions ?? [];
  if (questions.length === 0) {
    return <p className="text-sm text-slate-600">Bài kiểm tra: học viên thấy các câu đã chọn sau khi bài được xuất bản.</p>;
  }
  return (
    <ol className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-800">
      {questions.map((question, index) => (
        <li key={question.id}>
          <p className="font-medium">Câu {index + 1}. {question.stem}</p>
          <ul className="mt-1 space-y-0.5 pl-4 text-slate-700">
            {question.options.map((option) => <li key={option.id}>{option.id}. {option.text}</li>)}
          </ul>
        </li>
      ))}
    </ol>
  );
}
