import type { PracticalExamSession } from '../../../types';
import {
  deleteSessionRow, insertSession, selectClassName, selectSession, selectSessions,
  selectSessionWithTemplate, updateSessionRow,
} from '../data/session-repository';
import type { CreatePracticalSessionInput, UpdatePracticalSessionInput } from '../domain/inputs';
import type { PracticalSessionWithTemplate } from '../domain/sessions';

export const listPracticalSessions = (filters?: { template_id?: string; class_id?: string }): Promise<PracticalExamSession[]> => selectSessions(filters);
export const getPracticalSession = (id: string): Promise<PracticalExamSession | null> => selectSession(id);
/** One live session per class, template and mode: say so instead of the database's wording. */
async function plainDuplicate<T>(save: Promise<T>): Promise<T> {
  try {
    return await save;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new Error('Lớp này đã có kỳ thi với mẫu này. Sửa kỳ thi đó, hoặc xóa nó rồi tạo lại.');
    throw e;
  }
}

export const createPracticalSession = (input: CreatePracticalSessionInput) => plainDuplicate(insertSession(input));
export const updatePracticalSession = (id: string, input: UpdatePracticalSessionInput) => plainDuplicate(updateSessionRow(id, input));
export const deletePracticalSession = (id: string): Promise<void> => deleteSessionRow(id);

/** A session with its template and class name. */
export async function getPracticalSessionWithTemplate(id: string): Promise<PracticalSessionWithTemplate | null> {
  const row = await selectSessionWithTemplate(id);
  if (!row) return null;
  const class_name = row.class_id ? await selectClassName(row.class_id) : undefined;
  return { ...row, template: row.practical_exam_templates ?? null, class_name } as PracticalSessionWithTemplate;
}

/** Template title and class name per session, for the session list. */
export async function describeSessions(sessions: PracticalExamSession[]): Promise<{ titles: Record<string, string>; classNames: Record<string, string> }> {
  const titles: Record<string, string> = {};
  const classNames: Record<string, string> = {};
  await Promise.all(
    sessions.map(async (s) => {
      const w = await getPracticalSessionWithTemplate(s.id);
      if (w?.template) titles[s.template_id] = w.template.title;
      if (w?.class_name) classNames[s.class_id] = w.class_name;
    }),
  );
  return { titles, classNames };
}
