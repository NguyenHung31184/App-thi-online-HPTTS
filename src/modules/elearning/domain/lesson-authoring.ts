import type { AssignedBlock } from './assigned-learning';

export type BlockType = AssignedBlock['block_type'];
export type StorageProvider = 'youtube' | 'cloudinary' | 'drive' | 'supabase' | 'vps' | 'external';

export interface LessonRow {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  order_index: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

/** A block of the editable draft. The published copy students read is `LessonVersion.blocks`. */
export interface LessonBlockRow extends AssignedBlock {
  lesson_id: string;
}

export interface LessonVersion {
  id: string;
  lesson_id: string;
  version: number;
  module_id: string;
  title: string;
  description: string | null;
  blocks: AssignedBlock[];
  published_at: string;
}

export interface ClassAssignment {
  id: string;
  class_id: string;
  lesson_id: string;
  lesson_version_id: string;
  order_index: number;
  required: boolean;
  enforce_sequence: boolean;
  opens_at: string | null;
  due_at: string | null;
  created_at: string;
}

export interface LearningClass {
  id: string;
  name: string;
  code: string | null;
}

/** Blocks an author can add today; quiz waits for server-side marking. */
export const AUTHORABLE_BLOCK_TYPES = ['video', 'pdf', 'article'] as const;

export const BLOCK_LABELS: Record<BlockType, string> = {
  video: 'Video',
  pdf: 'PDF, slide',
  article: 'Bài viết',
  quiz: 'Quiz',
};

export const PROVIDER_LABELS: Record<StorageProvider, string> = {
  youtube: 'YouTube',
  cloudinary: 'Cloudinary',
  drive: 'Google Drive',
  supabase: 'Supabase',
  vps: 'Máy chủ của trung tâm',
  external: 'Đường dẫn khác',
};

export interface BlockForm {
  blockType: BlockType;
  title: string;
  url: string;
  provider: StorageProvider;
  body: string;
  /** Video length in minutes, as typed. */
  minutes: string;
}

export function emptyBlockForm(blockType: BlockType = 'video'): BlockForm {
  return { blockType, title: '', url: '', provider: 'youtube', body: '', minutes: '' };
}

export function blockFormFromRow(block: AssignedBlock): BlockForm {
  return {
    blockType: block.block_type,
    title: block.title ?? '',
    url: block.content_url ?? '',
    provider: (block.storage_provider as StorageProvider | null) ?? 'external',
    body: block.body_richtext ?? '',
    minutes: block.duration_seconds ? String(Number((block.duration_seconds / 60).toFixed(2))) : '',
  };
}

/** Storage provider read from the link, so the author rarely has to pick it. */
export function guessProvider(url: string): StorageProvider {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'external';
  }
  if (host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com')) return 'youtube';
  if (host === 'res.cloudinary.com') return 'cloudinary';
  if (host === 'drive.google.com') return 'drive';
  if (host.endsWith('.supabase.co')) return 'supabase';
  return 'external';
}

/** A video the player can time: every source except YouTube, which only offers a manual "done" tick. */
export function isTrackedVideo(block: Pick<AssignedBlock, 'block_type' | 'storage_provider'>): boolean {
  return block.block_type === 'video' && block.storage_provider !== 'youtube';
}

/**
 * The player credits whole seconds and loses the last partial one, so a very short clip can never reach the 90%
 * the server asks for. From this length up, one full viewing always completes the block.
 */
export const MIN_TRACKED_VIDEO_SECONDS = 15;

/** The first problem that blocks saving a block; null when it can be saved. */
export function blockFormError(form: BlockForm): string | null {
  if (form.blockType === 'quiz') return 'Khối quiz chưa soạn được ở bản này.';
  if (form.blockType === 'article') return form.body.trim() ? null : 'Chưa nhập nội dung bài viết.';
  const url = form.url.trim();
  if (!url) return 'Chưa nhập đường dẫn nội dung.';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Đường dẫn chưa hợp lệ. Dán cả phần https:// ở đầu.';
  }
  if (parsed.protocol !== 'https:') return 'Chỉ nhận đường dẫn https://.';
  if (form.blockType === 'video' && form.provider !== 'youtube') {
    const seconds = Number(form.minutes) * 60;
    if (!(seconds > 0)) return 'Nhập độ dài video (phút). Hệ thống cần số này để tính học viên đã xem bao nhiêu.';
    if (seconds < MIN_TRACKED_VIDEO_SECONDS) {
      return `Video ngắn hơn ${MIN_TRACKED_VIDEO_SECONDS} giây không đo được đủ 90%, học viên sẽ không hoàn thành được. Dùng video dài hơn.`;
    }
  }
  return null;
}

/** "12 phút", or seconds for a clip shorter than a minute. */
export function durationLabel(seconds: number): string {
  return seconds < 60 ? `${seconds} giây` : `${Math.round(seconds / 60)} phút`;
}

export type BlockFields = Pick<
  LessonBlockRow,
  'block_type' | 'title' | 'content_url' | 'storage_provider' | 'body_richtext' | 'duration_seconds' | 'quiz_pass_percent'
>;

/** Column values for a block; fields that do not belong to the block type are cleared. */
export function blockFieldsFromForm(form: BlockForm): BlockFields {
  const isArticle = form.blockType === 'article';
  const minutes = Number(form.minutes);
  return {
    block_type: form.blockType,
    title: form.title.trim() || null,
    content_url: isArticle ? null : form.url.trim(),
    storage_provider: isArticle ? null : form.provider,
    body_richtext: isArticle ? form.body : null,
    duration_seconds: form.blockType === 'video' && minutes > 0 ? Math.round(minutes * 60) : null,
    quiz_pass_percent: null,
  };
}

export function sortByOrder<T extends { order_index: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.order_index - b.order_index);
}

/** The two rows that trade places when `id` moves one step; null at either end of the list. */
export function swapPair<T extends { id: string; order_index: number }>(rows: T[], id: string, direction: -1 | 1): [T, T] | null {
  const sorted = sortByOrder(rows);
  const index = sorted.findIndex((row) => row.id === id);
  const other = sorted[index + direction];
  return index >= 0 && other ? [sorted[index], other] : null;
}

/** Next free position; sparse and duplicate order values still give a position after the last row. */
export function nextOrderIndex(rows: { order_index: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.order_index), -1) + 1;
}

/** Why the draft cannot be published; null when it can. Mirrors the checks of `elearning_publish_lesson`. */
export function publishBlocker(blocks: AssignedBlock[]): string | null {
  if (blocks.length === 0) return 'Bài học chưa có nội dung. Thêm ít nhất một khối trước khi xuất bản.';
  if (blocks.some((block) => block.block_type === 'quiz')) return 'Bài có khối quiz chưa xuất bản được ở bản này.';
  const untimed = blocks.find((block) => isTrackedVideo(block) && !(Number(block.duration_seconds) > 0));
  if (untimed) return `Video "${untimed.title || 'chưa đặt tên'}" chưa có độ dài. Sửa khối này rồi xuất bản.`;
  return null;
}

const SNAPSHOT_FIELDS = ['id', 'block_type', 'title', 'content_url', 'storage_provider', 'body_richtext', 'duration_seconds', 'order_index'] as const;

/** True when the draft differs from the newest published version, or nothing has been published yet. */
export function draftDiffersFromVersion(
  lesson: Pick<LessonRow, 'title' | 'description'>,
  blocks: AssignedBlock[],
  latest: LessonVersion | null,
): boolean {
  if (!latest) return true;
  if (lesson.title !== latest.title || (lesson.description ?? '') !== (latest.description ?? '')) return true;
  const draft = sortByOrder(blocks);
  const published = sortByOrder(latest.blocks);
  if (draft.length !== published.length) return true;
  return draft.some((block, index) => SNAPSHOT_FIELDS.some((field) => (block[field] ?? null) !== (published[index][field] ?? null)));
}

export interface AssignmentForm {
  classId: string;
  versionId: string;
  orderIndex: string;
  required: boolean;
  enforceSequence: boolean;
  /** Timestamps in ms, or null when the lesson has no opening time or deadline. */
  opensAt: number | null;
  dueAt: number | null;
}

export function assignmentFormError(form: AssignmentForm): string | null {
  if (!form.classId) return 'Chưa chọn lớp.';
  if (!form.versionId) return 'Bài học chưa có phiên bản đã xuất bản để giao.';
  if (!/^\d+$/.test(form.orderIndex.trim())) return 'Thứ tự trong lớp phải là số nguyên từ 0 trở lên.';
  if (form.opensAt !== null && !Number.isFinite(form.opensAt)) return 'Ngày mở chưa hợp lệ.';
  if (form.dueAt !== null && !Number.isFinite(form.dueAt)) return 'Hạn học chưa hợp lệ.';
  if (form.opensAt !== null && form.dueAt !== null && form.dueAt <= form.opensAt) return 'Hạn học phải sau ngày mở.';
  return null;
}

export type AssignmentState = 'scheduled' | 'open' | 'closed';

export const ASSIGNMENT_STATE_LABELS: Record<AssignmentState, string> = {
  scheduled: 'Chưa tới ngày mở',
  open: 'Đang mở',
  closed: 'Đã hết hạn',
};

export function assignmentState(assignment: Pick<ClassAssignment, 'opens_at' | 'due_at'>, now: number): AssignmentState {
  if (assignment.opens_at && Date.parse(assignment.opens_at) > now) return 'scheduled';
  if (assignment.due_at && Date.parse(assignment.due_at) < now) return 'closed';
  return 'open';
}

export interface ProgressMark {
  enrollment_id: string;
  block_id: string;
  status: 'in_progress' | 'completed';
}

/** Learners who completed every block of the assigned version, and learners who started at least one. */
export function assignmentProgress(blockIds: string[], marks: ProgressMark[]): { started: number; completed: number } {
  const wanted = new Set(blockIds);
  const doneByLearner = new Map<string, Set<string>>();
  for (const mark of marks) {
    if (!wanted.has(mark.block_id)) continue;
    const done = doneByLearner.get(mark.enrollment_id) ?? new Set<string>();
    if (mark.status === 'completed') done.add(mark.block_id);
    doneByLearner.set(mark.enrollment_id, done);
  }
  let completed = 0;
  for (const done of doneByLearner.values()) if (wanted.size > 0 && done.size === wanted.size) completed += 1;
  return { started: doneByLearner.size, completed };
}

const SERVER_MESSAGES: [RegExp, string][] = [
  [/Cannot publish this lesson/i, 'Bạn không có quyền xuất bản bài học này.'],
  [/needs content before publication/i, 'Bài học chưa có nội dung để xuất bản.'],
  [/quiz publication is not enabled/i, 'Bài có khối quiz chưa xuất bản được ở bản này.'],
  [/Cannot assign content to this class/i, 'Bạn không có quyền giao bài cho lớp này.'],
  [/does not belong to class course/i, 'Lớp này không học mô-đun của bài, nên không giao được.'],
  [/Invalid assignment settings/i, 'Thông tin giao bài chưa hợp lệ. Kiểm tra lại thứ tự, ngày mở và hạn học.'],
  [/Cannot withdraw this assignment/i, 'Bài này đã được rút hoặc bạn không có quyền rút.'],
  [/row-level security/i, 'Tài khoản của bạn không có quyền sửa nội dung của mô-đun này.'],
  [/Could not find the function|schema cache/i, 'Máy chủ chưa có chức năng này. Báo quản trị hệ thống.'],
  [/Failed to fetch|NetworkError/i, 'Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.'],
];

/** A message an author can act on, from whatever the server or the network threw. */
export function authoringErrorMessage(error: unknown): string {
  const raw = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error ? String((error as { message: unknown }).message) : '';
  for (const [pattern, message] of SERVER_MESSAGES) if (pattern.test(raw)) return message;
  return raw || 'Có lỗi chưa rõ nguyên nhân. Thử lại sau ít phút.';
}
