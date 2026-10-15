import {
  assignLesson, insertBlock, insertLesson, publishLesson, selectActiveAssignments, selectAssignmentMarks, selectBlockCounts,
  selectBlocks, selectClassSizes, selectClassesForModule, selectLatestVersionNumbers, selectLesson, selectLessons,
  selectVersions, updateBlockRow, updateLessonRow, withdrawAssignment,
  insertQuizItem, removeQuizItem, searchBankQuestions, selectQuizItems,
} from '../data/lesson-authoring-repository';
import type { QuizItemRow } from '../domain/quiz';
import {
  assignmentFormError, assignmentProgress, blockFieldsFromForm, blockFormError, nextOrderIndex, swapPair,
  type AssignmentForm, type BlockForm, type ClassAssignment, type LearningClass, type LessonBlockRow, type LessonRow,
  type LessonVersion,
} from '../domain/lesson-authoring';

export interface LessonCatalogEntry {
  lesson: LessonRow;
  blockCount: number;
  /** Newest published version number; 0 when the lesson has never been published. */
  latestVersion: number;
  assignedClassCount: number;
}

/** The lessons of a module with what the list shows about each. */
export async function loadLessonCatalog(moduleId: string): Promise<LessonCatalogEntry[]> {
  const lessons = await selectLessons(moduleId);
  const ids = lessons.map((lesson) => lesson.id);
  const [blockCounts, latest, assignments] = await Promise.all([
    selectBlockCounts(ids), selectLatestVersionNumbers(ids), selectActiveAssignments(ids),
  ]);
  return lessons.map((lesson) => ({
    lesson,
    blockCount: blockCounts[lesson.id] ?? 0,
    latestVersion: latest[lesson.id] ?? 0,
    assignedClassCount: assignments.filter((assignment) => assignment.lesson_id === lesson.id).length,
  }));
}

export async function createLesson(moduleId: string, title: string, siblings: LessonRow[]): Promise<LessonRow> {
  const name = title.trim();
  if (!name) throw new Error('Chưa nhập tên bài học.');
  return insertLesson({ module_id: moduleId, title: name, description: null, order_index: nextOrderIndex(siblings) });
}

export async function saveLessonDetails(lessonId: string, title: string, description: string): Promise<void> {
  const name = title.trim();
  if (!name) throw new Error('Chưa nhập tên bài học.');
  await updateLessonRow(lessonId, { title: name, description: description.trim() || null });
}

/** Moves a lesson to the trash. Refused while a class still has it assigned: learners would lose a required lesson. */
export async function removeLesson(lessonId: string): Promise<void> {
  const assignments = await selectActiveAssignments([lessonId]);
  if (assignments.length > 0) {
    throw new Error(`Bài đang được giao cho ${assignments.length} lớp. Rút bài khỏi các lớp đó trước khi xóa.`);
  }
  await updateLessonRow(lessonId, { is_deleted: true });
}

export async function moveLesson(lessons: LessonRow[], lessonId: string, direction: -1 | 1): Promise<void> {
  const pair = swapPair(lessons, lessonId, direction);
  if (!pair) return;
  await Promise.all(tradePlaces(pair).map(([id, order]) => updateLessonRow(id, { order_index: order })));
}

export interface LessonDraft {
  lesson: LessonRow;
  blocks: LessonBlockRow[];
  versions: LessonVersion[];
  /** Câu đã chọn vào các khối quiz của bản nháp. */
  quizItems: QuizItemRow[];
}

export async function loadLessonDraft(lessonId: string): Promise<LessonDraft | null> {
  const lesson = await selectLesson(lessonId);
  if (!lesson) return null;
  const [blocks, versions] = await Promise.all([selectBlocks(lessonId), selectVersions(lessonId)]);
  const quizBlockIds = blocks.filter((block) => block.block_type === 'quiz').map((block) => block.id);
  const quizItems = await selectQuizItems(quizBlockIds);
  return { lesson, blocks, versions, quizItems };
}

/** Adds a block at the end, or rewrites the block being edited. */
export async function saveBlock(lessonId: string, form: BlockForm, blocks: LessonBlockRow[], editingId: string | null): Promise<void> {
  const problem = blockFormError(form);
  if (problem) throw new Error(problem);
  const fields = blockFieldsFromForm(form);
  if (editingId) await updateBlockRow(editingId, fields);
  else await insertBlock(lessonId, fields, nextOrderIndex(blocks));
}

export async function removeBlock(blockId: string): Promise<void> {
  await updateBlockRow(blockId, { is_deleted: true });
}

export async function moveBlock(blocks: LessonBlockRow[], blockId: string, direction: -1 | 1): Promise<void> {
  const pair = swapPair(blocks, blockId, direction);
  if (!pair) return;
  await Promise.all(tradePlaces(pair).map(([id, order]) => updateBlockRow(id, { order_index: order })));
}

/** Two rows that share an order value would not trade places, so the mover takes a distinct one. */
function tradePlaces<T extends { id: string; order_index: number }>([moving, other]: [T, T]): [string, number][] {
  if (moving.order_index !== other.order_index) return [[moving.id, other.order_index], [other.id, moving.order_index]];
  return [[moving.id, other.order_index - 1], [other.id, other.order_index]];
}

export { publishLesson };

export interface AssignmentEntry {
  assignment: ClassAssignment;
  classItem: LearningClass | null;
  /** Version number the class reads; null when the version is not among the lesson's versions. */
  version: number | null;
  classSize: number;
  started: number;
  completed: number;
}

export interface LessonAssignments {
  classes: LearningClass[];
  entries: AssignmentEntry[];
}

/** Classes that can take the lesson, and how far each class with the lesson has got. */
export async function loadLessonAssignments(lesson: LessonRow, versions: LessonVersion[]): Promise<LessonAssignments> {
  const [classes, assignments] = await Promise.all([selectClassesForModule(lesson.module_id), selectActiveAssignments([lesson.id])]);
  const [sizes, marks] = await Promise.all([
    selectClassSizes(assignments.map((assignment) => assignment.class_id)),
    selectAssignmentMarks(assignments.map((assignment) => assignment.id)),
  ]);
  const entries = assignments.map((assignment) => {
    const version = versions.find((item) => item.id === assignment.lesson_version_id) ?? null;
    const progress = assignmentProgress(
      (version?.blocks ?? []).map((block) => block.id),
      marks.filter((mark) => mark.assignment_id === assignment.id),
    );
    return {
      assignment,
      classItem: classes.find((item) => item.id === assignment.class_id) ?? null,
      version: version?.version ?? null,
      classSize: sizes[assignment.class_id] ?? 0,
      ...progress,
    };
  });
  return { classes, entries };
}

export async function submitAssignment(form: AssignmentForm): Promise<void> {
  const problem = assignmentFormError(form);
  if (problem) throw new Error(problem);
  await assignLesson({
    classId: form.classId,
    versionId: form.versionId,
    orderIndex: Number(form.orderIndex.trim()),
    required: form.required,
    enforceSequence: form.enforceSequence,
    opensAt: form.opensAt === null ? null : new Date(form.opensAt).toISOString(),
    dueAt: form.dueAt === null ? null : new Date(form.dueAt).toISOString(),
  });
}

export { withdrawAssignment };

/** Thêm một câu vào cuối khối quiz; câu đã có trong khối thì báo lỗi. */
export async function addQuizQuestion(blockId: string, questionId: string, items: QuizItemRow[]): Promise<void> {
  const own = items.filter((item) => item.block_id === blockId);
  if (own.some((item) => item.question_id === questionId)) throw new Error('Câu này đã có trong bài kiểm tra.');
  await insertQuizItem(blockId, questionId, own.reduce((max, item) => Math.max(max, item.order_index), -1) + 1);
}

export { removeQuizItem, searchBankQuestions };
