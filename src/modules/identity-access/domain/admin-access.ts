/** Admin sections a teacher may open, with their sub-paths: the teacher menu plus attempt results. */
const TEACHER_SECTIONS = [
  '/admin/dashboard',
  '/admin/exams',
  '/admin/questions',
  '/admin/question-libraries',
  '/admin/report',
  '/admin/attempts',
];

/** `/admin` itself only redirects to the dashboard, so it matches exactly and never as a prefix. */
export function teacherCanOpen(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/admin') return true;
  return TEACHER_SECTIONS.some((section) => path === section || path.startsWith(`${section}/`));
}
