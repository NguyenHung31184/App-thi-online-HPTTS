import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExam, createExam, updateExam } from '../../services/examService';
import { listModulesWithCourses, type ModuleWithCourse } from '../../services/ttdtDataService';
import type { BlueprintRule } from '../../types';

const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Dễ' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'hard', label: 'Khó' },
];

export default function AdminExamFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration_minutes, setDurationMinutes] = useState(60);
  const [pass_threshold, setPassThreshold] = useState(0.7);
  const [module_id, setModuleId] = useState<string>('');
  const [rules, setRules] = useState<BlueprintRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [modules, setModules] = useState<ModuleWithCourse[]>([]);
  const [loadedExamMissingModule, setLoadedExamMissingModule] = useState(false);

  useEffect(() => {
    listModulesWithCourses()
      .then((list) => setModules(list))
      .catch(() => setModules([]));
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    getExam(id).then((exam) => {
      if (cancelled || !exam) return;
      setTitle(exam.title);
      setDescription(exam.description ?? '');
      setDurationMinutes(exam.duration_minutes ?? 60);
      setPassThreshold(exam.pass_threshold ?? 0.7);
      setModuleId(exam.module_id ?? '');
      setLoadedExamMissingModule(!exam.module_id || String(exam.module_id).trim() === '');
      try {
        const arr: BlueprintRule[] = Array.isArray(exam.blueprint)
          ? (exam.blueprint as BlueprintRule[])
          : JSON.parse(String(exam.blueprint ?? '[]'));
        setRules(arr);
      } catch {
        setRules([]);
      }
    }).catch(() => setError('Không tải được đề thi.'));
    return () => { cancelled = true; };
  }, [isEdit, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const titleTrim = (title ?? '').trim();
      if (!titleTrim) { setError('Vui lòng nhập Tiêu đề đề thi.'); setLoading(false); return; }
      if (!module_id || module_id.trim() === '') {
        setError('Bắt buộc chọn Mô-đun trước khi lưu. Nếu không chọn, điểm sẽ không được đồng bộ sang TTDT.');
        setLoading(false); return;
      }
      if (duration_minutes < 1) { setError('Thời gian thi phải ít nhất 1 phút.'); setLoading(false); return; }
      const pt = Number(pass_threshold);
      if (Number.isNaN(pt) || pt < 0 || pt > 1) { setError('Ngưỡng đạt phải trong khoảng 0 đến 1.'); setLoading(false); return; }

      if (isEdit && id) {
        await updateExam(id, { title: titleTrim, description, duration_minutes, pass_threshold: pt, module_id: module_id.trim() || null, blueprint: rules });
        navigate('/admin/exams');
      } else {
        const exam = await createExam({ title: titleTrim, description, duration_minutes, pass_threshold: pt, blueprint: rules, module_id: module_id.trim() || undefined });
        navigate(`/admin/exams/${exam.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu đề thi.');
    } finally {
      setLoading(false);
    }
  };

  const modulesGrouped = useMemo(() => {
    const groups: Record<string, { courseId: string; courseName: string; items: ModuleWithCourse[] }> = {};
    for (const m of modules) {
      const courseId = m.course_id ?? 'unknown';
      const courseName = m.course_name || 'Khóa chưa đặt tên';
      if (!groups[courseId]) groups[courseId] = { courseId, courseName, items: [] };
      groups[courseId].items.push(m);
    }
    return Object.values(groups).sort((a, b) => a.courseName.localeCompare(b.courseName));
  }, [modules]);

  const addRule = () => setRules((prev) => [...prev, { topic: '', difficulty: 'medium', count: 5 }]);
  const removeRule = (idx: number) => setRules((prev) => prev.filter((_, i) => i !== idx));
  const updateRule = (idx: number, patch: Partial<BlueprintRule>) =>
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const totalRequired = rules.reduce((s, r) => s + (r.count || 0), 0);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">
            {isEdit ? 'Cập nhật đề thi' : 'Tạo đề thi mới'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Khai báo thông tin, gắn mô-đun TTDT và thiết lập ma trận câu hỏi.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {isEdit && loadedExamMissingModule && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-sm">
            <p className="font-semibold">Đề thi này đang thiếu Mô-đun</p>
            <p className="mt-0.5">Vui lòng chọn Mô-đun bên dưới rồi nhấn <strong>Cập nhật</strong> để điểm được ghi nhận.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Tiêu đề */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="VD: Đề lý thuyết Boong tàu — MĐ01"
            />
          </div>

          {/* Mô tả */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả <span className="text-slate-400 font-normal">(tùy chọn)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ghi chú ngắn về đề thi..."
            />
          </div>

          {/* Thời gian + Ngưỡng đạt */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian (phút)</label>
              <input
                type="number"
                min={1}
                value={duration_minutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ngưỡng đạt (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(pass_threshold * 100)}
                  onChange={(e) => setPassThreshold(Number(e.target.value) / 100)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
            </div>
          </div>

          {/* Mô-đun */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mô-đun *</label>
            <select
              value={module_id}
              onChange={(e) => {
                setModuleId(e.target.value);
                if ((e.target.value ?? '').trim()) setLoadedExamMissingModule(false);
              }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                !module_id?.trim() ? 'border-amber-400 bg-amber-50/50' : 'border-slate-300'
              }`}
            >
              <option value="">— Chọn mô-đun —</option>
              {modulesGrouped.map((group) => (
                <optgroup key={group.courseId} label={group.courseName}>
                  {group.items.map((m) => (
                    <option key={`${group.courseId}-${m.id}`} value={m.id}>
                      {m.code ? `${m.code} — ${m.name}` : m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {(!module_id || !module_id.trim()) && (
              <p className="text-xs text-amber-700 mt-1">
                Bắt buộc chọn mô-đun — học viên nộp bài sẽ không được ghi điểm nếu thiếu.
              </p>
            )}
          </div>

          {/* Ma trận blueprint */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-sm font-medium text-slate-700">Ma trận câu hỏi</label>
                <p className="text-xs text-slate-500 mt-0.5">Mỗi dòng = 1 nhóm câu hỏi cần có trong đề (theo chủ đề + độ khó).</p>
              </div>
              {totalRequired > 0 && (
                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  Tổng: <strong>{totalRequired}</strong> câu
                </span>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {rules.length > 0 && (
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
                  <div className="col-span-5">Chủ đề (topic)</div>
                  <div className="col-span-4">Độ khó</div>
                  <div className="col-span-2 text-center">Số câu</div>
                  <div className="col-span-1" />
                </div>
              )}

              <div className="divide-y divide-slate-100">
                {rules.map((r, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2.5 items-center">
                    <input
                      type="text"
                      value={r.topic}
                      onChange={(e) => updateRule(idx, { topic: e.target.value })}
                      className="col-span-5 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="VD: An toàn vận hành"
                    />
                    <select
                      value={r.difficulty}
                      onChange={(e) => updateRule(idx, { difficulty: e.target.value })}
                      className="col-span-4 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {DIFFICULTY_OPTIONS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={r.count}
                      onChange={(e) => updateRule(idx, { count: Math.max(1, Number(e.target.value) || 1) })}
                      className="col-span-2 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => removeRule(idx)}
                      className="col-span-1 flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Xóa dòng"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  onClick={addRule}
                  className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Thêm nhóm câu hỏi
                </button>
              </div>
            </div>

            {rules.length === 0 && (
              <p className="text-xs text-slate-400 mt-2">
                Để trống nếu không cần kiểm định ma trận — khóa đề sẽ bỏ qua bước validate.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/admin/exams')}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật đề thi' : 'Tạo đề thi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
