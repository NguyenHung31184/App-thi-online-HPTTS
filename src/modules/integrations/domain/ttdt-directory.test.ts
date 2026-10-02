import { describe, expect, it } from 'vitest';
import { modulesWithCourses, uniqueModules } from './ttdt-directory';

describe('modulesWithCourses', () => {
  it('reads object and array relations, one entry per course, without deleted modules', () => {
    const rows = [
      { course_id: 'c1', courses: { name: 'QC' }, modules: { id: 'm1', name: 'Cấu tạo', code: 'CT' } },
      { course_id: 'c2', courses: [{ name: 'RTG' }], modules: [{ id: 'm1', name: 'Cấu tạo' }, { id: 'm2', name: 'Cũ', is_deleted: true }] },
      { course_id: 'c3', courses: null, modules: { id: '' } },
    ];
    expect(modulesWithCourses(rows)).toEqual([
      { id: 'm1', name: 'Cấu tạo', code: 'CT', course_id: 'c1', course_name: 'QC' },
      { id: 'm1', name: 'Cấu tạo', code: undefined, course_id: 'c2', course_name: 'RTG' },
    ]);
  });
});

describe('uniqueModules', () => {
  it('keeps each module once', () => {
    const rows = [{ modules: { id: 'm1', name: 'A' } }, { modules: [{ id: 'm1', name: 'A' }, { id: 'm2', name: 'B', code: 'B1' }] }];
    expect(uniqueModules(rows)).toEqual([{ id: 'm1', name: 'A', code: undefined }, { id: 'm2', name: 'B', code: 'B1' }]);
  });
});
