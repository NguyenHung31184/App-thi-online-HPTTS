import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import IconAction from '../../../../shared/ui/IconAction';
import { equalBands, type FieldConfig, type FieldStep, type TimeAggregate } from '../../domain/field-config';

const inputClass = 'border border-slate-300 rounded px-2 py-1 text-sm';
const linesOf = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

/** "m:ss" for seconds, and back; a bare number is minutes. */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
function secondsOf(text: string): number | null {
  const [m, s] = text.trim().split(':');
  const total = s === undefined ? Number(m) * 60 : Number(m) * 60 + Number(s);
  return Number.isFinite(total) && total > 0 ? Math.round(total) : null;
}

function StepsEditor({ steps, onChange }: { steps: FieldStep[]; onChange: (steps: FieldStep[]) => void }) {
  const set = (index: number, patch: Partial<FieldStep>) => onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const move = (index: number, by: number) => {
    const next = [...steps];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange(next);
  };
  const add = () => {
    const used = new Set(steps.map((s) => s.key));
    let n = steps.length + 1;
    while (used.has(`s${n}`)) n += 1;
    onChange([...steps, { key: `s${n}`, name: '', cycle: false, photo: '' }]);
  };
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-700 mb-1">Bước thao tác</h3>
      <p className="text-xs text-slate-500 mb-2">
        Giáo viên chấm lần lượt từng bước. Bước "chu kỳ" (nâng – di chuyển – hạ) được bấm giờ và lặp lại; ảnh nhắc chụp
        sau mỗi lần hạ xong.
      </p>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.key} className="flex flex-wrap items-center gap-2 p-2 bg-slate-50 rounded">
            <span className="w-6 text-sm text-slate-500">{i + 1}.</span>
            <input value={s.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Tên bước" className={`${inputClass} flex-1 min-w-[12rem]`} />
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={s.cycle} onChange={(e) => set(i, { cycle: e.target.checked })} /> Chu kỳ, bấm giờ
            </label>
            <input value={s.photo} onChange={(e) => set(i, { photo: e.target.value })} placeholder="Ảnh cần chụp (bỏ trống nếu không)" className={`${inputClass} w-64`} />
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} title="Lên" aria-label="Lên" className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
            <button type="button" disabled={i === steps.length - 1} onClick={() => move(i, 1)} title="Xuống" aria-label="Xuống" className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
            <IconAction onClick={() => onChange(steps.filter((_, j) => j !== i))} title="Bỏ bước" tone="red"><Trash2 className="w-4 h-4" /></IconAction>
          </li>
        ))}
      </ol>
      <button type="button" onClick={add} className="mt-2 px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 text-sm">+ Thêm bước</button>
    </div>
  );
}

function TimeEditor({ config, onChange }: { config: FieldConfig; onChange: (config: FieldConfig) => void }) {
  const time = config.time;
  if (!time) {
    return (
      <button
        type="button"
        onClick={() => onChange({ ...config, time: { limits: equalBands(360), points: [20, 10, 5], aggregate: 'average' } })}
        className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 text-sm"
      >
        + Thêm tiêu chí thời gian
      </button>
    );
  }
  const setLimit = (index: number, text: string) => {
    const seconds = secondsOf(text);
    if (seconds == null) return;
    const limits = [...time.limits] as typeof time.limits;
    limits[index] = seconds;
    onChange({ ...config, time: { ...time, limits } });
  };
  const setPoints = (index: number, value: number) => {
    const points = [...time.points] as typeof time.points;
    points[index] = value;
    onChange({ ...config, time: { ...time, points } });
  };
  const bandStart = (i: number) => (i === 0 ? '0:00' : clock(time.limits[i - 1]));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Thời gian chuẩn</span>
        <input defaultValue={clock(time.limits[2])} key={time.limits[2]} onBlur={(e) => {
          const seconds = secondsOf(e.target.value);
          if (seconds) onChange({ ...config, time: { ...time, limits: equalBands(seconds) } });
        }} className={`${inputClass} w-20`} />
        <span className="text-slate-500">(phút:giây; đổi ở đây sẽ chia lại đều 3 khung)</span>
      </div>
      <table className="text-sm">
        <tbody>
          {time.limits.map((limit, i) => (
            <tr key={i}>
              <td className="pr-2 py-1">Khung {i + 1}: từ {bandStart(i)} đến dưới</td>
              <td className="pr-2"><input defaultValue={clock(limit)} key={limit} onBlur={(e) => setLimit(i, e.target.value)} className={`${inputClass} w-20`} /></td>
              <td className="pr-2"><input type="number" min={0} value={time.points[i]} onChange={(e) => setPoints(i, Number(e.target.value))} className={`${inputClass} w-16`} /> điểm</td>
            </tr>
          ))}
          <tr><td className="py-1 text-slate-500" colSpan={3}>Từ {clock(time.limits[2])} trở lên: 0 điểm</td></tr>
        </tbody>
      </table>
      <label className="flex items-center gap-2 text-sm">
        Nhiều chu kỳ thì tính
        <select value={time.aggregate} onChange={(e) => onChange({ ...config, time: { ...time, aggregate: e.target.value as TimeAggregate } })} className={inputClass}>
          <option value="average">trung bình các chu kỳ</option>
          <option value="fastest">chu kỳ nhanh nhất</option>
          <option value="last">chu kỳ cuối</option>
        </select>
      </label>
      <button type="button" onClick={() => onChange({ ...config, time: null })} className="text-red-600 text-sm hover:underline">Bỏ tiêu chí thời gian</button>
    </div>
  );
}

/** Field grading set-up of a template: steps, time bands, protective equipment, disqualifying faults. */
export function FieldConfigEditor({ config, onChange }: { config: FieldConfig; onChange: (config: FieldConfig) => void }) {
  return (
    <section className="space-y-5 border border-slate-200 rounded-lg p-4">
      <h2 className="text-lg font-medium text-slate-800">Chấm tại sân (Sổ chuyên cần)</h2>
      <StepsEditor steps={config.steps} onChange={(steps) => onChange({ ...config, steps })} />
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-1">Thời gian một chu kỳ</h3>
        <TimeEditor config={config} onChange={onChange} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Bảo hộ lao động phải kiểm trước khi thi (mỗi dòng một mục)</span>
          <textarea defaultValue={config.ppe.join('\n')} onBlur={(e) => onChange({ ...config, ppe: linesOf(e.target.value) })} rows={5} className={`${inputClass} w-full mt-1`} />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Lỗi loại trực tiếp (mỗi dòng một lỗi)</span>
          <textarea defaultValue={config.disqualifyReasons.join('\n')} onBlur={(e) => onChange({ ...config, disqualifyReasons: linesOf(e.target.value) })} rows={5} className={`${inputClass} w-full mt-1`} />
        </label>
      </div>
    </section>
  );
}
