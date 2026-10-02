import { useMemo } from 'react';
import type { ModuleWithCourse } from '../../../integrations/public';
import { useTtdtModules } from '../../queries/use-practical-exams';

/** TTDT module that receives the practical grade, grouped by course. */
export function ModuleSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const modules = useTtdtModules().data;
  const groups = useMemo(() => {
    const byCourse = new Map<string, { name: string; items: ModuleWithCourse[] }>();
    for (const m of modules ?? []) {
      const key = m.course_id ?? 'unknown';
      if (!byCourse.has(key)) byCourse.set(key, { name: m.course_name || 'Khóa chưa đặt tên', items: [] });
      byCourse.get(key)!.items.push(m);
    }
    return [...byCourse.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [modules]);
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Mô-đun nhận điểm (TTDT) *</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-lg px-3 py-2 text-sm ${value ? 'border-slate-300' : 'border-amber-400 bg-amber-50/50'}`}
      >
        <option value="">— Chọn mô-đun —</option>
        {groups.map(([courseId, group]) => (
          <optgroup key={courseId} label={group.name}>
            {group.items.map((m) => (
              <option key={`${courseId}-${m.id}`} value={m.id}>{m.code ? `${m.code} — ${m.name}` : m.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {!value && <p className="text-xs text-amber-700 mt-1">Chưa chọn mô-đun thì điểm không sang được TTDT.</p>}
    </div>
  );
}
