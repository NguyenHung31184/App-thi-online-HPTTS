import { describe, expect, it } from 'vitest';
import type { AssignedBlock } from './assigned-learning';
import {
  assignmentFormError, assignmentProgress, assignmentState, authoringErrorMessage, blockFieldsFromForm, blockFormError, blockFormFromRow,
  draftDiffersFromVersion, durationLabel, emptyBlockForm, guessProvider, nextOrderIndex, publishBlocker, swapPair,
  type AssignmentForm, type LessonVersion,
} from './lesson-authoring';

const block = (over: Partial<AssignedBlock> = {}): AssignedBlock => ({
  id: 'b1', block_type: 'article', title: 'Mở đầu', content_url: null, storage_provider: null,
  body_richtext: 'Nội dung', duration_seconds: null, quiz_pass_percent: null, order_index: 0, ...over,
});

describe('guessProvider', () => {
  it('reads the provider from the host', () => {
    expect(guessProvider('https://youtu.be/abc')).toBe('youtube');
    expect(guessProvider('https://www.youtube.com/watch?v=abc')).toBe('youtube');
    expect(guessProvider('https://res.cloudinary.com/x/video.mp4')).toBe('cloudinary');
    expect(guessProvider('https://drive.google.com/file/d/1/view')).toBe('drive');
    expect(guessProvider('https://abc.supabase.co/storage/v1/x.pdf')).toBe('supabase');
    expect(guessProvider('https://example.com/a.mp4')).toBe('external');
    expect(guessProvider('not a link')).toBe('external');
  });
});

describe('blockFormError', () => {
  it('requires a body for an article and an https link for the rest', () => {
    expect(blockFormError({ ...emptyBlockForm('article'), body: ' ' })).toBe('Chưa nhập nội dung bài viết.');
    expect(blockFormError({ ...emptyBlockForm('article'), body: 'x' })).toBeNull();
    expect(blockFormError(emptyBlockForm('pdf'))).toBe('Chưa nhập đường dẫn nội dung.');
    expect(blockFormError({ ...emptyBlockForm('pdf'), url: 'tai-lieu.pdf' })).toMatch(/^Đường dẫn chưa hợp lệ/);
    expect(blockFormError({ ...emptyBlockForm('pdf'), url: 'http://example.com/a.pdf' })).toBe('Chỉ nhận đường dẫn https://.');
    expect(blockFormError({ ...emptyBlockForm('pdf'), url: 'https://example.com/a.pdf', provider: 'external' })).toBeNull();
  });

  it('requires a length for a video the player can time, not for YouTube', () => {
    const video = { ...emptyBlockForm('video'), url: 'https://example.com/a.mp4' };
    expect(blockFormError({ ...video, provider: 'external' })).toMatch(/^Nhập độ dài video/);
    expect(blockFormError({ ...video, provider: 'external', minutes: '12' })).toBeNull();
    expect(blockFormError({ ...video, provider: 'external', minutes: '0.1' })).toMatch(/^Video ngắn hơn 15 giây/);
    expect(blockFormError({ ...video, provider: 'external', minutes: '0.25' })).toBeNull();
    expect(blockFormError({ ...video, provider: 'youtube' })).toBeNull();
  });

  it('checks the pass mark and attempts of a quiz block, not a link', () => {
    expect(blockFormError(emptyBlockForm('quiz'))).toBeNull();
    expect(blockFormError({ ...emptyBlockForm('quiz'), passPercent: '120' })).toMatch(/Điểm đạt/);
    expect(blockFormError({ ...emptyBlockForm('quiz'), maxAttempts: '0' })).toMatch(/Số lượt/);
  });
});

describe('blockFieldsFromForm', () => {
  it('clears the fields that do not belong to the block type', () => {
    expect(blockFieldsFromForm({ blockType: 'article', title: ' ', url: 'https://x.y', provider: 'drive', body: 'Chữ', minutes: '5', passPercent: '80', maxAttempts: '3' })).toEqual({
      block_type: 'article', title: null, content_url: null, storage_provider: null, body_richtext: 'Chữ',
      duration_seconds: null, quiz_pass_percent: null, quiz_max_attempts: null,
    });
    expect(blockFieldsFromForm({ blockType: 'video', title: ' Bài 1 ', url: ' https://x.y/a.mp4 ', provider: 'vps', body: 'bỏ', minutes: '2.5', passPercent: '80', maxAttempts: '3' })).toEqual({
      block_type: 'video', title: 'Bài 1', content_url: 'https://x.y/a.mp4', storage_provider: 'vps', body_richtext: null,
      duration_seconds: 150, quiz_pass_percent: null, quiz_max_attempts: null,
    });
    expect(blockFieldsFromForm({ ...emptyBlockForm('quiz'), title: 'Kiểm tra', url: 'https://x.y', passPercent: '70', maxAttempts: '2' })).toEqual({
      block_type: 'quiz', title: 'Kiểm tra', content_url: null, storage_provider: null, body_richtext: null,
      duration_seconds: null, quiz_pass_percent: 70, quiz_max_attempts: 2,
    });
  });

  it('round-trips a stored block through the form', () => {
    const stored = block({ block_type: 'video', content_url: 'https://x.y/a.mp4', storage_provider: 'vps', body_richtext: null, duration_seconds: 600 });
    expect(blockFieldsFromForm(blockFormFromRow(stored))).toMatchObject({ content_url: 'https://x.y/a.mp4', storage_provider: 'vps', duration_seconds: 600 });
  });
});

describe('durationLabel', () => {
  it('shows seconds below a minute and minutes above', () => {
    expect(durationLabel(5)).toBe('5 giây');
    expect(durationLabel(600)).toBe('10 phút');
    expect(blockFormFromRow(block({ block_type: 'video', duration_seconds: 5 })).minutes).toBe('0.08');
  });
});

describe('ordering', () => {
  const rows = [{ id: 'a', order_index: 0 }, { id: 'b', order_index: 4 }, { id: 'c', order_index: 9 }];

  it('pairs a row with its neighbour and stops at the ends', () => {
    expect(swapPair(rows, 'b', -1)?.map((row) => row.id)).toEqual(['b', 'a']);
    expect(swapPair(rows, 'b', 1)?.map((row) => row.id)).toEqual(['b', 'c']);
    expect(swapPair(rows, 'a', -1)).toBeNull();
    expect(swapPair(rows, 'c', 1)).toBeNull();
    expect(swapPair(rows, 'missing', 1)).toBeNull();
  });

  it('puts a new row after the last one', () => {
    expect(nextOrderIndex(rows)).toBe(10);
    expect(nextOrderIndex([])).toBe(0);
  });
});

describe('publishBlocker', () => {
  it('needs content, no quiz, and a length on every timed video', () => {
    expect(publishBlocker([])).toMatch(/^Bài học chưa có nội dung/);
    expect(publishBlocker([block({ block_type: 'quiz', title: 'Cuối bài' })])).toMatch(/^Bài kiểm tra "Cuối bài" chưa có câu hỏi/);
    expect(publishBlocker([block({ block_type: 'quiz' })], { b1: ['q1'] })).toBeNull();
    expect(publishBlocker([block({ block_type: 'video', storage_provider: 'vps', title: 'Cẩu' })])).toBe('Video "Cẩu" chưa có độ dài. Sửa khối này rồi xuất bản.');
    expect(publishBlocker([block({ block_type: 'video', storage_provider: 'youtube' }), block()])).toBeNull();
  });
});

describe('draftDiffersFromVersion', () => {
  const lesson = { title: 'Bài 1', description: null };
  const version = (blocks: AssignedBlock[]): LessonVersion => ({
    id: 'v', lesson_id: 'l', version: 1, module_id: 'm', title: 'Bài 1', description: null, blocks, published_at: '2026-10-13T00:00:00Z',
  });

  it('is true before the first publication', () => {
    expect(draftDiffersFromVersion(lesson, [block()], null)).toBe(true);
  });

  it('is false when the draft matches the published copy', () => {
    expect(draftDiffersFromVersion(lesson, [block()], version([block()]))).toBe(false);
    expect(draftDiffersFromVersion({ title: 'Bài 1', description: '' }, [block()], version([block()]))).toBe(false);
  });

  it('notices a changed title, block text, block count and order', () => {
    expect(draftDiffersFromVersion({ ...lesson, title: 'Bài 1a' }, [block()], version([block()]))).toBe(true);
    expect(draftDiffersFromVersion(lesson, [block({ body_richtext: 'Khác' })], version([block()]))).toBe(true);
    expect(draftDiffersFromVersion(lesson, [block(), block({ id: 'b2', order_index: 1 })], version([block()]))).toBe(true);
    const two = [block(), block({ id: 'b2', order_index: 1 })];
    const swapped = [block({ order_index: 1 }), block({ id: 'b2', order_index: 0 })];
    expect(draftDiffersFromVersion(lesson, swapped, version(two))).toBe(true);
  });
});

describe('assignmentFormError', () => {
  const form: AssignmentForm = { classId: 'c', versionId: 'v', orderIndex: '0', required: true, enforceSequence: true, opensAt: null, dueAt: null };

  it('accepts an assignment without dates', () => {
    expect(assignmentFormError(form)).toBeNull();
  });

  it('names the first problem', () => {
    expect(assignmentFormError({ ...form, classId: '' })).toBe('Chưa chọn lớp.');
    expect(assignmentFormError({ ...form, versionId: '' })).toMatch(/chưa có phiên bản/);
    expect(assignmentFormError({ ...form, orderIndex: '-1' })).toMatch(/^Thứ tự/);
    expect(assignmentFormError({ ...form, opensAt: NaN })).toBe('Ngày mở chưa hợp lệ.');
    expect(assignmentFormError({ ...form, opensAt: 10, dueAt: 10 })).toBe('Hạn học phải sau ngày mở.');
    expect(assignmentFormError({ ...form, opensAt: 10, dueAt: 11 })).toBeNull();
  });
});

describe('assignmentState', () => {
  const now = Date.parse('2026-10-13T08:00:00Z');

  it('follows the opening time and the deadline', () => {
    expect(assignmentState({ opens_at: null, due_at: null }, now)).toBe('open');
    expect(assignmentState({ opens_at: '2026-10-14T00:00:00Z', due_at: null }, now)).toBe('scheduled');
    expect(assignmentState({ opens_at: '2026-10-01T00:00:00Z', due_at: '2026-10-12T00:00:00Z' }, now)).toBe('closed');
    expect(assignmentState({ opens_at: '2026-10-01T00:00:00Z', due_at: '2026-10-20T00:00:00Z' }, now)).toBe('open');
  });
});

describe('authoringErrorMessage', () => {
  it('turns server refusals into something the author can act on', () => {
    expect(authoringErrorMessage(new Error('Lesson module does not belong to class course'))).toMatch(/^Lớp này không học mô-đun/);
    expect(authoringErrorMessage({ message: 'new row violates row-level security policy for table "elearning_lessons"' })).toMatch(/không có quyền/);
    expect(authoringErrorMessage(new Error('Chưa nhập tên bài học.'))).toBe('Chưa nhập tên bài học.');
    expect(authoringErrorMessage(null)).toMatch(/^Có lỗi chưa rõ/);
  });
});

describe('assignmentProgress', () => {
  it('counts learners who started and learners who finished every block', () => {
    const marks = [
      { enrollment_id: 'e1', block_id: 'b1', status: 'completed' as const },
      { enrollment_id: 'e1', block_id: 'b2', status: 'completed' as const },
      { enrollment_id: 'e2', block_id: 'b1', status: 'completed' as const },
      { enrollment_id: 'e3', block_id: 'b1', status: 'in_progress' as const },
      { enrollment_id: 'e4', block_id: 'old', status: 'completed' as const },
    ];
    expect(assignmentProgress(['b1', 'b2'], marks)).toEqual({ started: 3, completed: 1 });
    expect(assignmentProgress([], marks)).toEqual({ started: 0, completed: 0 });
  });
});
