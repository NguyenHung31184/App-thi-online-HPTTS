import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExam, createExam, updateExam } from '../../services/examService';
import { listModules } from '../../services/ttdtDataService';
import type { Exam, BlueprintRule } from '../../types';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [modules, setModules] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    listModules().then(setModules).catch(() => setModules([]));
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
      setBlueprintRaw(
        Array.isArray(exam.blueprint)
          ? JSON.stringify(exam.blueprint, null, 2)
          : typeof exam.blueprint === 'string'
            ? exam.blueprint
            : '[]'
      );
    }).catch(() => setError('Không tải được đề thi.'));
    return () => { cancelled = true; };
  }, [isEdit, id]);

  const parseBlueprint = (): BlueprintRule[] => {
    try {
      const arr = JSON.parse(blueprintRaw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(
        (r: unknown) =>
          r && typeof r === 'object' && 'topic' in r && 'difficulty' in r && 'count' in r
      ) as BlueprintRule[];
    } catch {
      return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const blueprint = parseBlueprint();
      if (isEdit && id) {
        await updateExam(id, {
          title,
          description,
          duration_minutes,
          pass_threshold,
          module_id: module_id || null,
          blueprint,
        });
        navigate('/admin/exams');
      } else {
        const exam = await createExam({
          title,
          description,
          duration_minutes,
          pass_threshold,
          blueprint,
          module_id: module_id || undefined,
        });
        navigate(`/admin/exams/${exam.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu đề thi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-4">
        {isEdit ? 'Sửa đề thi' : 'Thêm đề thi'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        {error && <p className="text-red-600 text-sm">{error}</p>}
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
        <div className="grid grid-cols-2 gap-4">
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
          <label className="block text-sm font-medium text-slate-700 mb-1">Học phần (TTDT)</label>
          <select
            value={module_id}
            onChange={(e) => setModuleId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          >
            <option value="">— Không chọn —</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Ma trận đề (JSON): [{'{'} topic, difficulty, count {'}'}]
          </label>
          <textarea
            value={blueprintRaw}
            onChange={(e) => setBlueprintRaw(e.target.value)}
            rows={6}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm"
            placeholder='[{"topic":"Chủ đề 1","difficulty":"easy","count":2},{"topic":"Chủ đề 1","difficulty":"medium","count":3}]'
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo đề thi'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/exams')}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Hủy
          </button>
        </div>
      </form>
    </div>
  );
}
