import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExam, createExam, updateExam } from '../../services/examService';
import { listModulesWithCourses, type ModuleWithCourse } from '../../services/ttdtDataService';
import type { BlueprintRule } from '../../types';

export default function AdminExamFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [duration_minutes, setDurationMinutes] = useState(60);
  const [pass_threshold, setPassThreshold] = useState(0.7);
  const [module_id, setModuleId] = useState<string>('');
  const [blueprintRaw, setBlueprintRaw] = useState('[]');
  const [rules, setRules] = useState<BlueprintRule[]>([]);
  const [requireEasy, setRequireEasy] = useState(0);
  const [requireMedium, setRequireMedium] = useState(0);
  const [requireHard, setRequireHard] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [modules, setModules] = useState<ModuleWithCourse[]>([]);
  /** True nếu khi load đề từ Supabase mà đề thi không có module_id (điểm nộp bài sẽ không ghi nhận). */
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
      const rawBlueprint =
        Array.isArray(exam.blueprint)
          ? JSON.stringify(exam.blueprint, null, 2)
          : typeof exam.blueprint === 'string'
            ? exam.blueprint
            : '[]';
      setBlueprintRaw(rawBlueprint);
      // Tách ma trận đề thành 2 phần:
      // - rules: các dòng topic + difficulty cụ thể (không phải wildcard *)
      // - yêu cầu theo độ khó: topic="*", difficulty=easy/medium/hard
      try {
        const arr = Array.isArray(exam.blueprint) ? (exam.blueprint as BlueprintRule[]) : JSON.parse(String(exam.blueprint ?? '[]'));
        const specificRules = (arr as BlueprintRule[]).filter(
          (r) => !(r.topic === '*' && ['easy', 'medium', 'hard'].includes(r.difficulty))
        );
        setRules(specificRules);
        const getCount = (difficulty: string) =>
          (arr as BlueprintRule[]).find((r) => r.topic === '*' && r.difficulty === difficulty)?.count ?? 0;
        setRequireEasy(getCount('easy'));
        setRequireMedium(getCount('medium'));
        setRequireHard(getCount('hard'));
      } catch {
        setRequireEasy(0);
        setRequireMedium(0);
        setRequireHard(0);
      }
    }).catch(() => setError('Không tải được đề thi.'));
    return () => { cancelled = true; };
  }, [isEdit, id]);

  const parseBlueprint = (): BlueprintRule[] => {
    // Nguồn chính là bảng rules; JSON là chế độ nâng cao
    return rules;
  };

  const withDifficultyRequirements = (bp: BlueprintRule[]): BlueprintRule[] => {
    const cleaned = bp.filter((r) => !(r.topic === '*' && ['easy', 'medium', 'hard'].includes(r.difficulty)));
    const adds: BlueprintRule[] = [];
    if (requireEasy > 0) adds.push({ topic: '*', difficulty: 'easy', count: requireEasy });
    if (requireMedium > 0) adds.push({ topic: '*', difficulty: 'medium', count: requireMedium });
    if (requireHard > 0) adds.push({ topic: '*', difficulty: 'hard', count: requireHard });
    return [...cleaned, ...adds];
  };

  // Đồng bộ JSON hiển thị với bảng rules + yêu cầu độ khó
  useEffect(() => {
    const base = withDifficultyRequirements(rules);
    setBlueprintRaw(JSON.stringify(base, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules, requireEasy, requireMedium, requireHard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // ——— Kiểm tra trước khi lưu: tránh học viên nộp bài mà điểm không ghi nhận ———
      const titleTrim = (title ?? '').trim();
      if (!titleTrim) {
        setError('Vui lòng nhập Tiêu đề đề thi.');
        setLoading(false);
        return;
      }
      if (!module_id || module_id.trim() === '') {
        setError(
          'Bắt buộc chọn Mô-đun trước khi lưu. Nếu không chọn, điểm sẽ không được đồng bộ sang TTDT — học viên nộp bài sẽ không được ghi nhận điểm. Vui lòng chọn Mô-đun ở trên rồi thử lại.'
        );
        setLoading(false);
        return;
      }
      if (duration_minutes < 1) {
        setError('Thời gian thi phải ít nhất 1 phút.');
        setLoading(false);
        return;
      }
      const pt = Number(pass_threshold);
      if (Number.isNaN(pt) || pt < 0 || pt > 1) {
        setError('Ngưỡng đạt phải trong khoảng 0 đến 1.');
        setLoading(false);
        return;
      }

      const blueprint = withDifficultyRequirements(parseBlueprint());
      if (isEdit && id) {
        await updateExam(id, {
          title: titleTrim,
          description,
          duration_minutes,
          pass_threshold: pt,
          module_id: module_id.trim() || null,
          blueprint,
        });
        navigate('/admin/exams');
      } else {
        const exam = await createExam({
          title: titleTrim,
          description,
          duration_minutes,
          pass_threshold: pt,
          blueprint,
          module_id: module_id.trim() || undefined,
        });
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
      if (!groups[courseId]) {
        groups[courseId] = { courseId, courseName, items: [] };
      }
      groups[courseId].items.push(m);
    }
    return Object.values(groups).sort((a, b) => a.courseName.localeCompare(b.courseName));
  }, [modules]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">
            {isEdit ? 'Cập nhật đề thi' : 'Tạo đề thi mới'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Khai báo thông tin đề thi, gắn đúng mô-đun TTDT và thiết lập ma trận câu hỏi theo chủ đề/độ khó.
          </p>
        </div>

        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        {isEdit && loadedExamMissingModule && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-400 text-amber-900 text-sm mb-4">
            <p className="font-semibold">Đề thi này đang thiếu Mô-đun (theo dữ liệu từ hệ thống)</p>
            <p className="mt-1">
              Điểm của bài làm đã nộp sẽ không được đồng bộ sang TTDT cho đến khi bạn chọn Mô-đun bên dưới và bấm{' '}
              <strong>Cập nhật</strong>. Vui lòng chọn Mô-đun rồi lưu lại.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tiêu đề *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Thời gian (phút)</label>
            <input
              type="number"
              min={1}
              value={duration_minutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ngưỡng đạt (0–1)</label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={pass_threshold}
              onChange={(e) => setPassThreshold(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Mô-đun</label>
          <select
            value={module_id}
            onChange={(e) => {
              setModuleId(e.target.value);
              if ((e.target.value ?? '').trim()) setLoadedExamMissingModule(false);
            }}
            className={`w-full border rounded-lg px-3 py-2 ${!module_id?.trim() ? 'border-amber-400 bg-amber-50/50' : 'border-slate-300'}`}
          >
            <option value="">— Không chọn —</option>
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
          <p className="text-xs text-slate-500 mt-1">
            Danh sách mô-đun được group theo nghề đào tạo (courses) giống app quản lý.
          </p>
          {(!module_id || !module_id.trim()) && (
            <div className="mt-2 p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 text-sm">
              <p className="font-semibold">Bắt buộc chọn Mô-đun để ghi nhận điểm</p>
              <p className="mt-1">Nếu không chọn, học viên nộp bài sẽ <strong>không được đồng bộ điểm sang TTDT</strong> — điểm coi như không ghi nhận. Vui lòng chọn Mô-đun trước khi lưu/Cập nhật.</p>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Ma trận đề theo chủ đề + độ khó
          </label>
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-2">
            <div className="grid grid-cols-12 text-xs font-medium text-slate-600 mb-1">
              <div className="col-span-6">Chủ đề (topic)</div>
              <div className="col-span-3">Độ khó</div>
              <div className="col-span-2 text-right">Số câu</div>
              <div className="col-span-1" />
            </div>
            {rules.map((r, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center mb-1">
                <input
                  type="text"
                  value={r.topic}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, topic: e.target.value } : x))
                    )
                  }
                  className="col-span-6 border border-slate-300 rounded-lg px-2 py-1 text-sm"
                  placeholder="VD: An toàn vận hành"
                />
                <select
                  value={r.difficulty}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, difficulty: e.target.value } : x))
                    )
                  }
                  className="col-span-3 border border-slate-300 rounded-lg px-2 py-1 text-sm"
                >
                  <option value="easy">Dễ (easy)</option>
                  <option value="medium">Trung bình (medium)</option>
                  <option value="hard">Khó (hard)</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={r.count}
                  onChange={(e) =>
                    setRules((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, count: Math.max(1, Number(e.target.value) || 1) } : x
                      )
                    )
                  }
                  className="col-span-2 border border-slate-300 rounded-lg px-2 py-1 text-sm text-right"
                />
                <button
                  type="button"
                  onClick={() => setRules((prev) => prev.filter((_, i) => i !== idx))}
                  className="col-span-1 text-xs text-red-600 hover:underline"
                >
                  Xóa
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setRules((prev) => [...prev, { topic: '', difficulty: 'medium', count: 1 }])
              }
              className="mt-2 px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white hover:bg-slate-100"
            >
              + Thêm dòng
            </button>
            <p className="text-xs text-slate-500 mt-2">
              Mỗi dòng là một nhóm câu hỏi cần có trong đề. Chủ đề <code className="bg-slate-100 px-1 rounded">topic</code> phải
              trùng với trường <code className="bg-slate-100 px-1 rounded">Chủ đề</code> của câu hỏi; độ khó lấy từ trường{' '}
              <code className="bg-slate-100 px-1 rounded">difficulty</code> của câu (easy / medium / hard).
            </p>
          </div>
          <div className="mt-3">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Ma trận đề (JSON nâng cao) – tự sinh từ bảng trên
            </label>
            <textarea
              value={blueprintRaw}
              onChange={(e) => setBlueprintRaw(e.target.value)}
              rows={4}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-xs bg-slate-50"
            />
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-sm font-medium text-slate-700 mb-2">Yêu cầu theo độ khó (tùy chọn)</p>
          <p className="text-xs text-slate-500 mb-2">
            Nếu bạn nhập số ở đây, hệ thống sẽ kiểm định đề phải có tối thiểu số câu theo độ khó, không phân biệt chủ đề.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Dễ (easy)</label>
              <input
                type="number"
                min={0}
                value={requireEasy}
                onChange={(e) => setRequireEasy(Math.max(0, Number(e.target.value) || 0))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Trung bình (medium)</label>
              <input
                type="number"
                min={0}
                value={requireMedium}
                onChange={(e) => setRequireMedium(Math.max(0, Number(e.target.value) || 0))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Khó (hard)</label>
              <input
                type="number"
                min={0}
                value={requireHard}
                onChange={(e) => setRequireHard(Math.max(0, Number(e.target.value) || 0))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
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
