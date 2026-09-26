import { describe, expect, it } from 'vitest';
import { teacherCanOpen } from './adminAccess';

describe('teacherCanOpen', () => {
  it.each([
    '/admin',
    '/admin/',
    '/admin/dashboard',
    '/admin/exams',
    '/admin/exams/abc/edit',
    '/admin/exams/abc/questions/new',
    '/admin/questions',
    '/admin/question-libraries',
    '/admin/question-libraries/lib-1/questions/new',
    '/admin/report',
    '/admin/attempts/att-1/result',
    '/admin/report/',
  ])('opens %s', (path) => {
    expect(teacherCanOpen(path)).toBe(true);
  });

  it.each([
    '/admin/windows',
    '/admin/windows/new',
    '/admin/windows/',
    '/admin/essay-grading',
    '/admin/essay-grading/att-1',
    '/admin/practical-templates',
    '/admin/practical-sessions/new',
    '/admin/practical-grading/att-1',
    '/admin/sync',
    '/admin/reports',
    '/admin/exams-x',
    '/adminx',
  ])('redirects %s', (path) => {
    expect(teacherCanOpen(path)).toBe(false);
  });
});
