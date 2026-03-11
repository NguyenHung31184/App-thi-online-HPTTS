import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import {
  getExamWindow,
  createExamWindow,
  updateExamWindow,
} from '../../services/examWindowService';
import { listExams } from '../../services/examService';
import { listClasses } from '../../services/ttdtDataService';

function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function fromDatetimeLocal(s: string): number {
  return new Date(s).getTime();
}

/** Mã truy cập ngẫu nhiên 4 ký tự: chữ và số. */
function randomAccessCode4(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function AdminWindowFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [exam_id, setExamId] = useState('');
  const [class_id, setClassId] = useState('');
  const [start_at, setStartAt] = useState('');
  const [end_at, setEndAt] = useState('');
  const [access_code, setAccessCode] = useState('');
  const [exams, setExams] = useState<{ id: string; title: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    listExams().then((list) => setExams(list.map((e) => ({ id: e.id, title: e.title })))).catch(() => {});
    listClasses().then(setClasses).catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    getExamWindow(id).then((w) => {
      if (cancelled || !w) return;
      setExamId(w.exam_id);
      setClassId(w.class_id);
      setStartAt(toDatetimeLocal(w.start_at));
      setEndAt(toDatetimeLocal(w.end_at));
      setAccessCode(w.access_code);
    }).catch(() => setError('Không tải được kỳ thi.'));
    return () => { cancelled = true; };
  }, [isEdit, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const startTs = fromDatetimeLocal(start_at);
      const endTs = fromDatetimeLocal(end_at);
      if (endTs <= startTs) {
        setError('Thời gian kết thúc phải sau thời gian bắt đầu.');
        setLoading(false);
        return;
      }
      if (isEdit && id) {
        await updateExamWindow(id, {
          class_id,
          start_at: startTs,
          end_at: endTs,
          access_code,
        });
        navigate('/admin/windows');
      } else {
        await createExamWindow({
          exam_id,
          class_id,
          start_at: startTs,
          end_at: endTs,
          access_code,
        });
        navigate('/admin/windows');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu kỳ thi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-4">
        {isEdit ? 'Sửa kỳ thi' : 'Thêm kỳ thi'}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Đề thi *</label>
            <select
              value={exam_id}
              onChange={(e) => setExamId(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            >
              <option value="">— Chọn đề —</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Lớp (TTDT) *</label>
          <select
            value={class_id}
            onChange={(e) => setClassId(e.target.value)}
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          >
            <option value="">— Chọn lớp —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
            {classes.length === 0 && (
              <option value="" disabled>Chưa có lớp (cần bảng classes trong Supabase)</option>
            )}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bắt đầu *</label>
            <input
              type="datetime-local"
              value={start_at}
              onChange={(e) => setStartAt(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kết thúc *</label>
            <input
              type="datetime-local"
              value={end_at}
              onChange={(e) => setEndAt(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Mã truy cập *</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={access_code}
              onChange={(e) => setAccessCode(e.target.value)}
              required
              placeholder="VD: A1B2 hoặc bấm nút tạo mã"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
            />
            <button
              type="button"
              onClick={() => setAccessCode(randomAccessCode4())}
              title="Tạo mã ngẫu nhiên 4 ký tự (chữ + số)"
              className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">Bấm biểu tượng xoay tròn để tạo mã 4 ký tự ngẫu nhiên.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Tạo kỳ thi'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/windows')}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Hủy
          </button>
        </div>
      </form>
    </div>
  );
}
