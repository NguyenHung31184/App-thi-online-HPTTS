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

/** Nhãn đề thi để phân biệt khi tiêu đề giống nhau: "Tiêu đề — Mô tả". */
function examOptionLabel(e: { title: string; description?: string | null }): string {
  const d = (e.description ?? '').trim();
  const full = d ? `${e.title} — ${d}` : e.title;
  return full.length > 75 ? full.slice(0, 72) + '...' : full;
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
  const [useMultiExams, setUseMultiExams] = useState(false);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [class_id, setClassId] = useState('');
  const [start_at, setStartAt] = useState('');
  const [end_at, setEndAt] = useState('');
  const [access_code, setAccessCode] = useState('');
  const [exams, setExams] = useState<{ id: string; title: string; description?: string | null; module_id?: string | null }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addExamSelect, setAddExamSelect] = useState('');

  useEffect(() => {
    listExams()
      .then((list) =>
        setExams(
          list.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description ?? null,
            module_id: e.module_id ?? null,
          }))
        )
      )
      .catch(() => setExams([]));
    listClasses().then(setClasses).catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    if (!isEdit || !id) return;
    let cancelled = false;
    getExamWindow(id).then((w) => {
      if (cancelled || !w) return;
      const ids = w.exam_ids?.filter(Boolean) ?? [];
      if (ids.length > 0) {
        setUseMultiExams(true);
        setSelectedExamIds(ids);
        setExamId(ids[0] ?? '');
      } else {
        setExamId(w.exam_id);
        setUseMultiExams(false);
        setSelectedExamIds([]);
      }
      setClassId(w.class_id);
      setStartAt(toDatetimeLocal(w.start_at));
      setEndAt(toDatetimeLocal(w.end_at));
      setAccessCode(w.access_code);
    }).catch(() => setError('Không tải được kỳ thi.'));
    return () => { cancelled = true; };
  }, [isEdit, id]);

  const addExamToMulti = () => {
    if (addExamSelect && !selectedExamIds.includes(addExamSelect)) {
      setSelectedExamIds((prev) => [...prev, addExamSelect]);
      setAddExamSelect('');
    }
  };

  const removeExamFromMulti = (examId: string) => {
    setSelectedExamIds((prev) => prev.filter((id) => id !== examId));
  };

  /** Đề trong danh sách quay 1 trong N mà chưa gắn mô-đun → đồng bộ điểm TTDT sẽ lỗi. */
  const selectedExamsWithoutModule = selectedExamIds.filter((eid) => {
    const ex = exams.find((e) => e.id === eid);
    return !ex?.module_id || String(ex.module_id).trim() === '';
  });
  const examTitlesWithoutModule = selectedExamsWithoutModule
    .map((eid) => exams.find((e) => e.id === eid)?.title ?? eid)
    .filter(Boolean);
  const hasMissingModule = useMultiExams && selectedExamIds.length > 0 && selectedExamsWithoutModule.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!class_id || class_id.trim() === '') {
        setError('Vui lòng chọn Lớp (TTDT) cho kỳ thi để có thể đồng bộ điểm.');
        setLoading(false);
        return;
      }
      if (!useMultiExams && !exam_id) {
        setError('Vui lòng chọn Đề thi.');
        setLoading(false);
        return;
      }
      if (useMultiExams && selectedExamIds.length === 0) {
        setError('Vui lòng thêm ít nhất một đề thi (chế độ nhiều đề).');
        setLoading(false);
        return;
      }
      if (hasMissingModule) {
        setError(
          `Không thể lưu: ${examTitlesWithoutModule.length} đề chưa gắn mô-đun (${examTitlesWithoutModule.join(', ')}). Vui lòng vào Đề thi → Sửa từng đề → chọn Mô-đun rồi lưu, sau đó quay lại tạo/sửa kỳ thi.`
        );
        setLoading(false);
        return;
      }
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
          exam_ids: useMultiExams ? selectedExamIds : [],
        });
        navigate('/admin/windows');
      } else {
        if (useMultiExams) {
          await createExamWindow({
            exam_ids: selectedExamIds,
            class_id,
            start_at: startTs,
            end_at: endTs,
            access_code,
          });
        } else {
          await createExamWindow({
            exam_id,
            class_id,
            start_at: startTs,
            end_at: endTs,
            access_code,
          });
        }
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
          <>
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-2">Chế độ đề thi</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="examMode"
                    checked={!useMultiExams}
                    onChange={() => setUseMultiExams(false)}
                    className="text-indigo-600"
                  />
                  <span>Một đề</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="examMode"
                    checked={useMultiExams}
                    onChange={() => setUseMultiExams(true)}
                    className="text-indigo-600"
                  />
                  <span>Nhiều đề (quay 1 trong N — thí sinh vào thi được gán ngẫu nhiên 1 đề)</span>
                </label>
              </div>
            </div>
            {!useMultiExams ? (
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
                    <option key={e.id} value={e.id}>{examOptionLabel(e)}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Nếu tiêu đề giống nhau, dùng thêm mô tả (— Mô tả) để phân biệt.</p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Danh sách đề (quay 1 trong N) *</label>
                <p className="text-xs text-slate-500 mb-2">Thí sinh vào thi sẽ nhận ngẫu nhiên một trong các đề dưới đây.</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  <select
                    value={addExamSelect}
                    onChange={(e) => setAddExamSelect(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 min-w-[200px]"
                  >
                    <option value="">— Thêm đề —</option>
                    {exams
                      .filter((e) => !selectedExamIds.includes(e.id))
                      .map((e) => (
                        <option key={e.id} value={e.id}>{examOptionLabel(e)}</option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={addExamToMulti}
                    disabled={!addExamSelect}
                    className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
                  >
                    Thêm
                  </button>
                </div>
                <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {selectedExamIds.map((eid) => {
                    const exam = exams.find((e) => e.id === eid);
                    const noModule = !exam?.module_id || String(exam?.module_id).trim() === '';
                    return (
                      <li key={eid} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-slate-800">
                          <span className="block">{exam?.title ?? eid}</span>
                          {(exam?.description ?? '').trim() && (
                            <span className="block text-xs text-slate-500 mt-0.5">{(exam?.description ?? '').trim()}</span>
                          )}
                          {noModule && (
                            <span className="ml-0 mt-1 inline-block text-amber-600 font-medium text-xs" title="Chưa gắn mô-đun — đồng bộ TTDT sẽ lỗi">
                              (chưa mô-đun)
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeExamFromMulti(eid)}
                          className="text-red-600 hover:text-red-700 text-sm shrink-0 ml-2"
                        >
                          Xóa
                        </button>
                      </li>
                    );
                  })}
                  {selectedExamIds.length === 0 && (
                    <li className="px-3 py-4 text-slate-500 text-sm">Chưa thêm đề nào. Chọn đề ở dropdown trên rồi bấm Thêm.</li>
                  )}
                </ul>
                {useMultiExams && selectedExamIds.length > 0 && (
                  <div className="mt-2 rounded-lg border p-3 text-sm bg-slate-50 border-slate-200">
                    <p className="font-medium text-slate-700">Lưu ý đồng bộ điểm TTDT</p>
                    <p className="text-slate-600 mt-1">
                      Thí sinh vào thi sẽ được gán ngẫu nhiên một trong các đề trên. Để điểm đồng bộ sang TTDT không lỗi, <strong>mọi đề trong danh sách phải đã gắn mô-đun</strong> (vào Đề thi → Sửa từng đề → chọn Mô-đun → Cập nhật).
                    </p>
                    {hasMissingModule && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded text-amber-800">
                        <p className="font-semibold">Không thể lưu kỳ thi</p>
                        <p className="mt-1">Các đề sau chưa gắn mô-đun: <strong>{examTitlesWithoutModule.join(', ')}</strong></p>
                        <p className="mt-1 text-sm">Vui lòng vào <strong>Đề thi</strong> → Sửa từng đề trên → chọn <strong>Mô-đun</strong> → Cập nhật, rồi quay lại trang này để lưu kỳ thi.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {isEdit && (
          <div>
            <span className="block text-sm font-medium text-slate-700 mb-2">Chế độ đề thi</span>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="examModeEdit"
                  checked={!useMultiExams}
                  onChange={() => setUseMultiExams(false)}
                  className="text-indigo-600"
                />
                <span>Một đề</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="examModeEdit"
                  checked={useMultiExams}
                  onChange={() => setUseMultiExams(true)}
                  className="text-indigo-600"
                />
                <span>Nhiều đề (quay 1 trong N)</span>
              </label>
            </div>
            {!useMultiExams ? (
              <p className="text-sm text-slate-600">{exams.find((e) => e.id === exam_id) ? examOptionLabel(exams.find((e) => e.id === exam_id)!) : exam_id}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 mb-2">
                  <select
                    value={addExamSelect}
                    onChange={(e) => setAddExamSelect(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 min-w-[200px]"
                  >
                    <option value="">— Thêm đề —</option>
                    {exams
                      .filter((e) => !selectedExamIds.includes(e.id))
                      .map((e) => (
                        <option key={e.id} value={e.id}>{examOptionLabel(e)}</option>
                      ))}
                  </select>
                  <button type="button" onClick={addExamToMulti} disabled={!addExamSelect} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50">
                    Thêm
                  </button>
                </div>
                <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {selectedExamIds.map((eid) => {
                    const exam = exams.find((e) => e.id === eid);
                    const noModule = !exam?.module_id || String(exam?.module_id).trim() === '';
                    return (
                      <li key={eid} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm text-slate-800">
                          <span className="block">{exam?.title ?? eid}</span>
                          {(exam?.description ?? '').trim() && (
                            <span className="block text-xs text-slate-500 mt-0.5">{(exam?.description ?? '').trim()}</span>
                          )}
                          {noModule && (
                            <span className="ml-0 mt-1 inline-block text-amber-600 font-medium text-xs" title="Chưa gắn mô-đun">
                              (chưa mô-đun)
                            </span>
                          )}
                        </span>
                        <button type="button" onClick={() => removeExamFromMulti(eid)} className="text-red-600 hover:text-red-700 text-sm shrink-0 ml-2">Xóa</button>
                      </li>
                    );
                  })}
                  {selectedExamIds.length === 0 && <li className="px-3 py-4 text-slate-500 text-sm">Chưa có đề nào.</li>}
                </ul>
                {useMultiExams && selectedExamIds.length > 0 && (
                  <div className="mt-2 rounded-lg border p-3 text-sm bg-slate-50 border-slate-200">
                    <p className="font-medium text-slate-700">Đồng bộ điểm TTDT</p>
                    <p className="text-slate-600 mt-1">Mọi đề trong danh sách phải đã gắn mô-đun. Nếu thiếu, thí sinh quay trúng đề đó sẽ bị báo lỗi sau khi nộp bài.</p>
                    {hasMissingModule && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded text-amber-800">
                        <p className="font-semibold">Chưa thể cập nhật</p>
                        <p className="mt-1">Các đề chưa mô-đun: <strong>{examTitlesWithoutModule.join(', ')}</strong>. Vào Đề thi → Sửa từng đề → chọn Mô-đun rồi quay lại.</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
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
