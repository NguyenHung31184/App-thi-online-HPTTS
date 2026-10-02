import type { StudentSession } from '../../../types';

// Same keys as before the move, so a tab that was already verified stays verified after a deploy.
const KEYS = {
  student_id: 'exam_student_id',
  student_code: 'exam_student_code',
  student_name: 'exam_student_name',
  student_dob: 'exam_student_dob',
  id_card_number: 'exam_student_id_card',
} as const;

/** The CCCD student session of this tab, or null when nothing is stored. */
export function loadStudentSession(): StudentSession | null {
  const session: StudentSession = {};
  let any = false;
  for (const [field, key] of Object.entries(KEYS) as [keyof StudentSession, string][]) {
    const value = sessionStorage.getItem(key) ?? undefined;
    if (value) any = true;
    session[field] = value;
  }
  return any ? session : null;
}

/** Writes every field; an empty one is removed. */
export function saveStudentSession(session: StudentSession): void {
  for (const [field, key] of Object.entries(KEYS) as [keyof StudentSession, string][]) {
    const value = session[field];
    if (value || (value === '' && (field === 'student_id' || field === 'student_code'))) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  }
}

export function clearStudentSession(): void {
  for (const key of Object.values(KEYS)) sessionStorage.removeItem(key);
}

/** Student id and code kept for this tab, read when the account is mapped. */
export function storedStudentIds(): { studentId?: string; studentCode?: string } {
  return {
    studentId: sessionStorage.getItem(KEYS.student_id) ?? undefined,
    studentCode: sessionStorage.getItem(KEYS.student_code) ?? undefined,
  };
}
