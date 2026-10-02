import { supabase } from '../../../platform/supabase/client';
import { studentKeysOf, type ProfileInfo, type ReportDirectory, type StudentInfo } from '../domain/report-rows';

// Lookups fail soft: a missing name shows the email or the id instead of breaking the report.

async function selectProfiles(userIds: string[]): Promise<Map<string, ProfileInfo>> {
  const map = new Map<string, ProfileInfo>();
  if (userIds.length === 0) return map;
  const { data, error } = await supabase.from('profiles').select('id, name, email, student_id').in('id', userIds);
  if (error) return map;
  (data ?? []).forEach((p: { id: string; name: string | null; email?: string | null; student_id?: string | null }) => {
    map.set(p.id, { name: p?.name?.trim() ?? '', email: (p?.email ?? '').trim(), student_id: (p?.student_id ?? undefined) || undefined });
  });
  return map;
}

async function selectClassNames(classIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (classIds.length === 0) return map;
  const { data, error } = await supabase.from('classes').select('id, name').in('id', classIds);
  if (error) return map;
  (data ?? []).forEach((c: { id: string; name: string | null }) => {
    if (c?.name) map.set(c.id, c.name.trim());
  });
  return map;
}

async function selectStudentsById(studentIds: string[]): Promise<Map<string, StudentInfo>> {
  const map = new Map<string, StudentInfo>();
  if (studentIds.length === 0) return map;
  const { data, error } = await supabase.from('students').select('id, name, student_code').in('id', studentIds);
  if (error) {
    console.warn('selectStudentsById:', error.message);
    return map;
  }
  (data ?? []).forEach((s: { id: string; name?: string | null; student_code?: string | null }) => {
    map.set(s.id, { name: (s.name || '').trim(), code: (s.student_code ?? undefined) || undefined });
  });
  return map;
}

async function selectStudentsByExamEmail(emails: string[]): Promise<Map<string, StudentInfo>> {
  const map = new Map<string, StudentInfo>();
  if (emails.length === 0) return map;
  const { data, error } = await supabase.from('students').select('exam_account_email, name, student_code').in('exam_account_email', emails);
  if (error) {
    console.warn('selectStudentsByExamEmail:', error.message);
    return map;
  }
  (data ?? []).forEach((s: { exam_account_email?: string | null; name?: string | null; student_code?: string | null }) => {
    const email = (s.exam_account_email ?? '').trim();
    if (!email) return;
    map.set(email, { name: (s.name ?? '').trim(), code: (s.student_code ?? undefined) || undefined });
  });
  return map;
}

/** Profiles, TTDT student names and class names for the users and classes of a report. */
export async function selectReportDirectory(userIds: string[], classIds: string[]): Promise<ReportDirectory> {
  const profiles = await selectProfiles(userIds);
  const { studentIds, emails } = studentKeysOf(profiles);
  const [classNames, studentsById, studentsByExamEmail] = await Promise.all([
    selectClassNames(classIds),
    selectStudentsById(studentIds),
    selectStudentsByExamEmail(emails),
  ]);
  return { profiles, classNames, studentsById, studentsByExamEmail };
}
