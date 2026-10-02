import { describe, expect, it } from 'vitest';
import { adminAreaAccess, landingPathAfterLogin, loginEmail, roleFromExamRole, studentAreaAccess } from './access';
import { manualCccdInput, normalizeCccd, studentSessionOf, verifyFailure, verifyRequest } from './cccd';

describe('roles and sign-in', () => {
  it('reads the exam role and treats anything else as a student', () => {
    expect(roleFromExamRole('admin')).toBe('admin');
    expect(roleFromExamRole('teacher')).toBe('teacher');
    expect(roleFromExamRole('proctor')).toBe('proctor');
    expect(roleFromExamRole('director')).toBe('student');
    expect(roleFromExamRole(null)).toBe('student');
  });

  it('turns a student code into the exam account email', () => {
    expect(loginEmail(' hv100228 ')).toBe('hv100228@hptts.vn');
    expect(loginEmail('gv@hptts.vn')).toBe('gv@hptts.vn');
  });

  it('sends staff to the admin dashboard and students to the CCCD check', () => {
    expect(landingPathAfterLogin('admin')).toBe('/admin/dashboard');
    expect(landingPathAfterLogin('teacher')).toBe('/admin/dashboard');
    expect(landingPathAfterLogin('proctor')).toBe('/admin/dashboard');
    expect(landingPathAfterLogin('student')).toBe('/verify-cccd');
    expect(landingPathAfterLogin(undefined)).toBe('/verify-cccd');
  });
});

describe('admin area guard', () => {
  const at = (role: 'admin' | 'teacher' | 'proctor' | 'student' | null, pathname: string, loading = false) =>
    adminAreaAccess({ loading, user: role ? { role } : null, pathname });

  it('waits while the role is unknown, so a reload never bounces to /login', () => {
    expect(at(null, '/admin/windows', true)).toEqual({ kind: 'loading' });
  });

  it('applies each role', () => {
    expect(at(null, '/admin/dashboard')).toEqual({ kind: 'redirect', to: '/login' });
    expect(at('student', '/admin/dashboard')).toEqual({ kind: 'redirect', to: '/dashboard' });
    expect(at('proctor', '/admin/dashboard')).toEqual({ kind: 'redirect', to: '/dashboard' });
    expect(at('admin', '/admin/sync')).toEqual({ kind: 'allow' });
    expect(at('teacher', '/admin/report')).toEqual({ kind: 'allow' });
    expect(at('teacher', '/admin/windows')).toEqual({ kind: 'redirect', to: '/admin/dashboard' });
    expect(at('teacher', '/admin/sync')).toEqual({ kind: 'redirect', to: '/admin/dashboard' });
  });
});

describe('student area guard', () => {
  it('needs a user or a CCCD student session', () => {
    expect(studentAreaAccess({ loading: true, user: null, studentSession: null })).toEqual({ kind: 'loading' });
    expect(studentAreaAccess({ loading: false, user: null, studentSession: null })).toEqual({ kind: 'redirect', to: '/start' });
    expect(studentAreaAccess({ loading: false, user: null, studentSession: { student_id: 's' } })).toEqual({ kind: 'allow' });
    expect(studentAreaAccess({ loading: false, user: { id: 'u' }, studentSession: null })).toEqual({ kind: 'allow' });
  });
});

describe('CCCD check', () => {
  it('normalises typed input and requires number and name', () => {
    expect(normalizeCccd(' 0123 4567 ')).toBe('01234567');
    expect(manualCccdInput(' ', 'An', '')).toEqual({ error: 'Vui lòng nhập số CCCD.' });
    expect(manualCccdInput('0123', '  ', '')).toEqual({ error: 'Vui lòng nhập họ và tên đầy đủ (đúng như trên thẻ).' });
    expect(manualCccdInput('012 3', ' Nguyễn   An ', ' 01/01/2000 ')).toEqual({
      data: { id_card_number: '0123', full_name: 'Nguyễn An', name: 'Nguyễn An', dob: '01/01/2000', date_of_birth: '01/01/2000' },
    });
  });

  it('builds the request from OCR or typed fields', () => {
    expect(verifyRequest({ id_card_number: '1', name: 'A', date_of_birth: 'd' }, 'hv@hptts.vn'))
      .toEqual({ id_card_number: '1', name: 'A', dob: 'd', exam_account_email: 'hv@hptts.vn' });
  });

  it('explains a failed check', () => {
    expect(verifyFailure({ success: false })).toBe('Kiểm tra CCCD thất bại.');
    expect(verifyFailure({ success: false, error: 'Phiên đăng nhập đã hết hạn.' })).toBe('Phiên đăng nhập đã hết hạn.');
    expect(verifyFailure({ success: true, data: { valid: false } })).toBe('Số CCCD không thuộc danh sách được thi.');
    expect(verifyFailure({ success: true, data: { valid: true } })).toBeNull();
  });

  it('keeps the student session tidy', () => {
    expect(studentSessionOf('s', 'c', undefined, { student_dob: ' 1/1/2000 ', id_card_number: '0 12' }))
      .toEqual({ student_id: 's', student_code: 'c', student_name: undefined, student_dob: '1/1/2000', id_card_number: '012' });
    expect(studentSessionOf('s', 'c', 'An', { student_dob: ' ' }).student_dob).toBeUndefined();
  });
});
