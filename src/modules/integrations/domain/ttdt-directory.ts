import type { ModuleItem } from '../../../types';

export interface ModuleWithCourse {
  id: string;
  name: string;
  code?: string;
  course_id?: string;
  course_name?: string;
}

type Row = Record<string, unknown>;

/** PostgREST returns a to-one relation as an object and a to-many one as an array; read both. */
function asList(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];
  return value != null && typeof value === 'object' ? [value as Row] : [];
}

function moduleOf(raw: Row | null): ModuleItem | null {
  if (!raw || raw.is_deleted === true) return null;
  if (raw.id == null || raw.id === '') return null;
  return {
    id: String(raw.id),
    name: typeof raw.name === 'string' ? raw.name : '',
    code: typeof raw.code === 'string' ? raw.code : undefined,
  };
}

/** One entry per (course, module) row of `course_modules`; a module shared by several courses appears once per course. */
export function modulesWithCourses(rows: unknown[]): ModuleWithCourse[] {
  const result: ModuleWithCourse[] = [];
  for (const row of rows as Row[]) {
    const courseId = typeof row.course_id === 'string' ? row.course_id : '';
    const courseName = asList(row.courses)[0]?.name;
    for (const raw of asList(row.modules)) {
      const module = moduleOf(raw);
      if (module) result.push({ ...module, course_id: courseId, course_name: typeof courseName === 'string' ? courseName : '' });
    }
  }
  return result;
}

/** The modules of `course_modules` rows, each once, deleted ones left out. */
export function uniqueModules(rows: unknown[]): ModuleItem[] {
  const seen = new Set<string>();
  const unique: ModuleItem[] = [];
  for (const row of rows as Row[]) {
    for (const raw of asList(row.modules)) {
      const module = moduleOf(raw);
      if (!module || seen.has(module.id)) continue;
      seen.add(module.id);
      unique.push(module);
    }
  }
  return unique;
}
