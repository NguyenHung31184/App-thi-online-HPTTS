import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getOccupation } from '../../services/occupationService';
import {
  getQuestionBankItem,
  createQuestionBankItem,
  updateQuestionBankItem,
  uploadQuestionBankImage,
} from '../../services/questionBankService';
import { ZonePositionPicker } from '../../components/ZonePositionPicker';
import { validateMediaUrl } from '../../utils/mediaUrlValidator';
import type { QuestionType, ModuleItem } from '../../types';
import { listModules } from '../../services/ttdtDataService';

const OPTION_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

/** Tọa độ mặc định 4 ô (x, y theo % 0–100) cho câu hỏi kéo nhãn lên ảnh. */
const DEFAULT_ZONE_POSITIONS: { x: number; y: number }[] = [
  { x: 10, y: 10 },
  { x: 70, y: 10 },
  { x: 10, y: 70 },
  { x: 70, y: 70 },
];

function emptyOptions(): { id: string; text: string }[] {
  return OPTION_IDS.map((id) => ({ id, text: '' }));
}

/** Chia đều tổng điểm cho các key; key cuối nhận phần dư để tổng chính xác. */
function distributeEssayPoints(
  keys: { text: string; points: number }[],
  totalPoints: number,
): { text: string; points: number }[] {
  if (keys.length === 0) return keys;
  const each = Math.round((totalPoints / keys.length) * 100) / 100;
  return keys.map((k, i) => ({
    ...k,
    points:
      i < keys.length - 1
        ? each
        : Math.round((totalPoints - each * (keys.length - 1)) * 100) / 100,
  }));
}

function parseAnswerKey(v: string, type: QuestionType): { single: string; multiple: string[]; order: string[] } {
  const s = (v || '').trim();
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s) as string[];
      if (type === 'drag_drop') return { single: 'A', multiple: [], order: Array.isArray(arr) ? arr : [] };
      return { single: arr[0] || 'A', multiple: Array.isArray(arr) ? arr : [], order: [] };
    } catch {
      return { single: s.slice(0, 1) || 'A', multiple: [], order: [] };
    }
  }
  return { single: s.slice(0, 1) || 'A', multiple: [], order: [] };
}

export default function AdminQuestionBankFormPage() {
  const { occupationId, qId } = useParams<{ occupationId: string; qId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isEdit = Boolean(qId);

  const [occupationName, setOccupationName] = useState('');
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [stem, setStem] = useState('');
  const [options, setOptions] = useState(emptyOptions());
  const [questionType, setQuestionType] = useState<QuestionType>('single_choice');
  const [answer_key, setAnswerKey] = useState('A');
  const [answerMultiple, setAnswerMultiple] = useState<string[]>([]);
  const [points, setPoints] = useState(2);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [mediaUrlError, setMediaUrlError] = useState<string>('');
  const [rubric, setRubric] = useState('');
  const [essayKeys, setEssayKeys] = useState<{ text: string; points: number }[]>([]);
  const [zonePositions, setZonePositions] = useState<{ x: number; y: number }[]>(() => [...DEFAULT_ZONE_POSITIONS]);
  /** Với drag_drop + ảnh: đáp án từng ô [id ô 1, id ô 2, id ô 3, id ô 4]. */
  const [zoneAnswers, setZoneAnswers] = useState<string[]>(() => ['A', 'B', 'C', 'D']);
  // true_false_multi: T/F per statement
  const [tfAnswers, setTfAnswers] = useState<string[]>([]);
  // matching: cột phải text array
  const [matchingRight, setMatchingRight] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!occupationId) return;
    getOccupation(occupationId).then((o) => o && setOccupationName(o.name)).catch(() => {});
  }, [occupationId]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initialModuleId = params.get('moduleId');
    if (initialModuleId) {
      setModuleId(initialModuleId);
    }
    let cancelled = false;
    listModules()
      .then((list) => {
        if (cancelled) return;
        setModules(list);
      })
      .catch(() => {
        if (cancelled) return;
        setModules([]);
      });
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  useEffect(() => {
    if (!isEdit || !occupationId || !qId) return;
    let cancelled = false;
    getQuestionBankItem(qId).then((q) => {
      if (cancelled || !q) return;
      setStem(q.stem);
      const loaded = Array.isArray(q.options)
        ? (q.options as { id: string; text: string }[]).length
          ? (q.options as { id: string; text: string }[])
          : emptyOptions()
        : emptyOptions();
      // Pad với slot trống để luôn có A–J trong state (cho UX mở rộng)
      const existingIds = new Set(loaded.map((o) => o.id));
      const padded = [...loaded];
      for (const id of OPTION_IDS) {
        if (!existingIds.has(id)) padded.push({ id, text: '' });
      }
      setOptions(padded);
      const parsed = parseAnswerKey(q.answer_key || 'A', q.question_type || 'single_choice');
      setAnswerKey(parsed.single);
      setAnswerMultiple(parsed.multiple.length ? parsed.multiple : [parsed.single]);
      const qType = (['single_choice', 'multiple_choice', 'drag_drop', 'video_paragraph', 'main_idea', 'true_false_multi', 'matching'] as QuestionType[]).includes(q.question_type)
        ? q.question_type
        : 'single_choice';
      setQuestionType(qType);
      if (qType === 'drag_drop' && Array.isArray(parsed.order) && parsed.order.length === 4) {
        setZoneAnswers(parsed.order);
      } else if (qType === 'drag_drop') {
        setZoneAnswers(['A', 'B', 'C', 'D']);
      }
      if (qType === 'true_false_multi') {
        try { const p = JSON.parse(q.answer_key || '[]'); if (Array.isArray(p)) setTfAnswers(p as string[]); } catch { /* ignore */ }
      }
      if (qType === 'matching') {
        try {
          const p = JSON.parse(q.answer_key || '{}') as { right?: string[]; map?: Record<string, string> };
          if (Array.isArray(p?.right)) {
            const rightArr = p.right;
            const mapObj = p.map ?? {};
            // Nếu map không tuần tự (import cũ): reorder để right[i] = text đúng của loaded[i]
            const reordered = loaded.map((opt) => {
              const idx = mapObj[opt.id];
              return (idx !== undefined && Number(idx) >= 1 && Number(idx) <= rightArr.length)
                ? rightArr[Number(idx) - 1]
                : (rightArr[loaded.indexOf(opt)] ?? '');
            });
            setMatchingRight(reordered);
          }
        } catch { /* ignore */ }
      }
      setPoints(q.points ?? 2);
      setTopic(q.topic ?? '');
      setDifficulty(q.difficulty ?? 'medium');
      setModuleId(q.module_id ?? moduleId ?? null);
      setExistingImageUrl(q.image_url ?? null);
      setExistingMediaUrl(q.media_url ?? null);
      setMediaUrl(q.media_url ?? '');
      setRubric(typeof q.rubric === 'string' ? q.rubric : (q.rubric ? JSON.stringify(q.rubric, null, 2) : ''));
      // Load essay keys từ answer_key (JSON array objects) — luôn chia đều lại điểm theo points câu hỏi
      if (qType === 'video_paragraph' || qType === 'main_idea') {
        try {
          const parsed: unknown = JSON.parse(q.answer_key || '[]');
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] !== null && typeof parsed[0] === 'object' && 'text' in (parsed[0] as object)) {
            setEssayKeys(distributeEssayPoints(parsed as { text: string; points: number }[], q.points ?? 2));
          } else {
            setEssayKeys([]);
          }
        } catch {
          setEssayKeys([]);
        }
      }
      let r: unknown = q.rubric;
      if (typeof r === 'string' && r.trim()) {
        try {
          r = JSON.parse(r);
        } catch {
          r = undefined;
        }
      }
      if (r && typeof r === 'object' && r !== null && 'zones' in r && Array.isArray((r as { zones?: unknown }).zones) && (r as { zones: { x: number; y: number }[] }).zones.length === 4) {
        setZonePositions((r as { zones: { x: number; y: number }[] }).zones.map((z) => ({ x: Number(z.x) || 10, y: Number(z.y) || 10 })));
      } else {
        setZonePositions([...DEFAULT_ZONE_POSITIONS]);
      }
    }).catch(() => setError('Không tải được câu hỏi.'));
    return () => { cancelled = true; };
  }, [isEdit, occupationId, qId]);

  const handleOptionChange = (id: string, text: string) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
  };
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImageFile(file ?? null);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  };
  const handleToggleMultiple = (optId: string) => {
    setAnswerMultiple((prev) =>
      prev.includes(optId) ? prev.filter((x) => x !== optId) : [...prev, optId].sort()
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!occupationId) return;
    setError('');
    setLoading(true);
    try {
      const isEssay = questionType === 'video_paragraph' || questionType === 'main_idea';
      const isTrueFalseMulti = questionType === 'true_false_multi';
      const isMatching = questionType === 'matching';
      const opts = options.filter((o) => o.text.trim() !== '');
      if (!isEssay && !isTrueFalseMulti && !isMatching && opts.length < 2) {
        setError('Cần ít nhất 2 đáp án.');
        setLoading(false);
        return;
      }
      const validIds = opts.map((o) => o.id);
      let finalAnswerKey: string;
      let optsToSave = opts;
      if (questionType === 'multiple_choice') {
        finalAnswerKey = JSON.stringify(validIds.filter((id) => answerMultiple.includes(id)).sort());
      } else if (questionType === 'drag_drop') {
        finalAnswerKey = JSON.stringify(zoneAnswers.slice(0, 4));
      } else if (isEssay) {
        const validKeys = essayKeys.filter((k) => k.text.trim() !== '' && k.points >= 0);
        finalAnswerKey = validKeys.length > 0 ? JSON.stringify(validKeys) : '';
        optsToSave = [];
      } else if (isTrueFalseMulti) {
        if (opts.length < 2) { setError('Cần ít nhất 2 phát biểu.'); setLoading(false); return; }
        const tf = opts.map((_, i) => (tfAnswers[i] === 'F' ? 'F' : 'T'));
        finalAnswerKey = JSON.stringify(tf);
      } else if (isMatching) {
        if (opts.length < 2) { setError('Cần ít nhất 2 cặp nối đôi.'); setLoading(false); return; }
        const right = opts.map((_, i) => (matchingRight[i] ?? '').trim());
        if (right.some((r) => r === '')) { setError('Nhập đủ nội dung cột phải cho mỗi cặp.'); setLoading(false); return; }
        const map: Record<string, string> = {};
        opts.forEach((o, i) => { map[o.id] = String(i + 1); });
        finalAnswerKey = JSON.stringify({ right, map });
      } else {
        finalAnswerKey = answer_key;
      }
      if (questionType === 'drag_drop' && opts.length === 4) {
        const za = zoneAnswers.slice(0, 4);
        const unique = new Set(za);
        if (unique.size !== 4 || za.some((id) => !validIds.includes(id))) {
          setError('Với câu kéo nhãn lên ảnh: mỗi ô phải chọn đúng một nhãn khác nhau (4 ô = 4 nhãn).');
          setLoading(false);
          return;
        }
      }
      if (questionType === 'single_choice' && !opts.some((o) => o.id === answer_key)) {
        setError('Đáp án đúng phải nằm trong danh sách đáp án đã nhập.');
        setLoading(false);
        return;
      }
      if (questionType === 'multiple_choice' && (answerMultiple.length === 0 || !validIds.some((id) => answerMultiple.includes(id)))) {
        setError('Chọn ít nhất một đáp án đúng.');
        setLoading(false);
        return;
      }

      let image_url: string | null = existingImageUrl;
      if (imageFile && occupationId) {
        image_url = await uploadQuestionBankImage(imageFile, occupationId, qId ?? undefined);
      }
      const rawMediaUrl = (mediaUrl || existingMediaUrl || '').trim();
      const mediaValidation = validateMediaUrl(rawMediaUrl);
      if (!mediaValidation.valid) {
        setMediaUrlError(mediaValidation.error ?? 'URL video không hợp lệ.');
        setLoading(false);
        return;
      }
      setMediaUrlError('');
      const media_url = rawMediaUrl || null;
      let rubricVal: unknown = rubric.trim() ? rubric.trim() : null;
      if (questionType === 'drag_drop' && opts.length === 4) {
        rubricVal = { zones: zonePositions };
      } else if (isEssay) {
        rubricVal = rubric.trim() ? rubric.trim() : null;
      }

      const baseUrl = `/admin/questions/occupation/${occupationId}`;
      const searchParams = new URLSearchParams(location.search);
      const returnModuleId = (moduleId ?? searchParams.get('moduleId')) || '';
      const returnToList = () => {
        // Nếu đi từ màn danh sách sang màn sửa, quay lại history sẽ giữ nguyên module/filter.
        if (!returnModuleId) {
          navigate(-1);
          return;
        }
        navigate({
          pathname: baseUrl,
          search: `?moduleId=${encodeURIComponent(returnModuleId)}`,
        });
      };
      if (isEdit && qId) {
        await updateQuestionBankItem(qId, {
          question_type: questionType,
          stem,
          options: optsToSave.length ? optsToSave : [{ id: 'A', text: '' }],
          answer_key: finalAnswerKey,
          points,
          topic,
          difficulty,
          module_id: moduleId,
          image_url,
          media_url: isEssay ? media_url : undefined,
          rubric: isEssay ? rubricVal : (questionType === 'drag_drop' && opts.length === 4 ? rubricVal : undefined),
        });
        returnToList();
      } else {
        await createQuestionBankItem({
          occupation_id: occupationId,
          question_type: questionType,
          stem,
          options: optsToSave.length ? optsToSave : [{ id: 'A', text: '' }],
          answer_key: finalAnswerKey,
          points,
          topic,
          difficulty,
          module_id: moduleId,
          image_url,
          media_url: isEssay ? media_url : undefined,
          rubric: isEssay ? rubricVal : (questionType === 'drag_drop' && opts.length === 4 ? rubricVal : undefined),
        });
        returnToList();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu câu hỏi.');
    } finally {
      setLoading(false);
    }
  };

  const displayImage = imagePreview || existingImageUrl;
  const typeLabels: Record<QuestionType, string> = {
    single_choice: 'Trắc nghiệm 1 đáp án',
    multiple_choice: 'Nhiều đáp án đúng',
    drag_drop: 'Sắp thứ tự (kéo thả)',
    true_false_multi: 'Đúng/Sai đa phát biểu',
    matching: 'Nối đôi',
    video_paragraph: 'Clip + Tự luận',
    main_idea: 'Phân tích ý chính',
  };
  const isEssay = questionType === 'video_paragraph' || questionType === 'main_idea';
  const isTrueFalseMultiView = questionType === 'true_false_multi';
  const isMatchingView = questionType === 'matching';
  const showOptions = !isEssay && !isTrueFalseMultiView && !isMatchingView;
  // UX tự động mở rộng: hiện tối thiểu 4 slot, thêm 1 slot trống sau slot cuối có nội dung, tối đa 10
  const filledCount = options.filter((o) => o.text.trim() !== '').length;
  const visibleOptionIds = OPTION_IDS.slice(0, Math.min(OPTION_IDS.length, Math.max(4, filledCount + 1)));

  return (
    <div>
      <p className="text-slate-500 text-sm">
        Nghề: {occupationName}
        {moduleId && (
          <>
            {' · '}
            <span>
              Mô-đun:{' '}
              {modules.find((m) => m.id === moduleId)?.name || 'Đang tải...'}
            </span>
          </>
        )}
      </p>
      <h1 className="text-xl font-semibold text-slate-800 mb-4">
        {isEdit ? 'Sửa câu hỏi' : 'Thêm câu hỏi'} — {typeLabels[questionType]}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Loại câu hỏi</label>
          <select
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value as QuestionType)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          >
            <option value="single_choice">Trắc nghiệm một đáp án đúng</option>
            <option value="multiple_choice">Trắc nghiệm nhiều đáp án đúng</option>
            <option value="drag_drop">Sắp thứ tự (kéo thả)</option>
            <option value="true_false_multi">Đúng/Sai đa phát biểu</option>
            <option value="matching">Nối đôi</option>
            <option value="video_paragraph">Clip + Tự luận</option>
            <option value="main_idea">Phân tích ý chính</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nội dung câu hỏi *</label>
          <textarea
            value={stem}
            onChange={(e) => setStem(e.target.value)}
            required
            rows={3}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
          />
        </div>
        {showOptions && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {questionType === 'drag_drop' ? '4 nhãn (tên các lựa chọn)' : 'Đáp án'}
            </label>
            {questionType === 'drag_drop' && (
              <p className="text-xs text-slate-500 mb-2">
                <strong>Kéo nhãn lên ảnh:</strong> Nếu bạn thêm <strong>ảnh minh họa</strong> và đúng <strong>4 mục</strong>, thí sinh sẽ kéo từng nhãn vào 4 ô trên ảnh (trái-trên, phải-trên, trái-dưới, phải-dưới). Thứ tự mục 1→4 = thứ tự ô. Gõ 4 nhãn, sau đó chọn đáp án từng ô bên dưới. “chỉ đúng bộ phận trên hình” (vd: ảnh xe nâng Forklift, 4 mũi tên, học viên kéo Càng nâng, Cabin… vào đúng ô).
              </p>
            )}
            {questionType === 'drag_drop' ? (
              ['A', 'B', 'C', 'D'].map((optId, idx) => (
                <div key={optId} className="flex items-center gap-2 mb-2">
                  <span className="text-slate-600 w-20">Nhãn {idx + 1}</span>
                  <input
                    type="text"
                    value={options.find((o) => o.id === optId)?.text ?? ''}
                    onChange={(e) => handleOptionChange(optId, e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
                    placeholder="VD: Càng nâng"
                  />
                </div>
              ))
            ) : (
              visibleOptionIds.map((optId) => (
                <div key={optId} className="flex items-center gap-2 mb-2">
                  <span className="w-6 font-medium text-slate-600">{optId}.</span>
                  <input
                    type="text"
                    value={options.find((o) => o.id === optId)?.text ?? ''}
                    onChange={(e) => handleOptionChange(optId, e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
                    placeholder={`Đáp án ${optId}`}
                  />
                  {questionType === 'single_choice' ? (
                    <label className="flex items-center gap-1">
                      <input type="radio" name="answer_key" checked={answer_key === optId} onChange={() => setAnswerKey(optId)} />
                      <span className="text-sm">Đúng</span>
                    </label>
                  ) : (
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={answerMultiple.includes(optId)} onChange={() => handleToggleMultiple(optId)} />
                      <span className="text-sm">Đúng</span>
                    </label>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {questionType === 'video_paragraph' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL video</label>
            <input
              type="url"
              value={mediaUrl || existingMediaUrl || ''}
              onChange={(e) => {
                setMediaUrl(e.target.value);
                const result = validateMediaUrl(e.target.value);
                setMediaUrlError(result.valid ? '' : (result.error ?? ''));
              }}
              className={`w-full border rounded-lg px-3 py-2 ${mediaUrlError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
              placeholder="https://youtube.com/... hoặc https://vimeo.com/..."
            />
            {mediaUrlError && (
              <p className="mt-1 text-sm text-red-600">{mediaUrlError}</p>
            )}
            {!mediaUrlError && (
              <p className="mt-1 text-xs text-slate-500">Chỉ chấp nhận: YouTube, Vimeo hoặc Supabase Storage của dự án.</p>
            )}
          </div>
        )}
        {isEssay && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Keys chấm ý (tự động)
              </label>
              <p className="text-xs text-slate-500 mb-2">
                Hệ thống tự cộng điểm mỗi key xuất hiện trong bài làm (so khớp chuỗi con, không phân biệt hoa/thường).
                Tổng điểm keys nên bằng điểm câu ({points} điểm). Để trống nếu muốn GV chấm thủ công.
              </p>
              {essayKeys.map((k, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <span className="text-slate-400 text-xs w-5 text-right flex-shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    value={k.text}
                    onChange={(e) => {
                      const updated = [...essayKeys];
                      updated[idx] = { ...updated[idx], text: e.target.value };
                      setEssayKeys(updated);
                    }}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder={`Key ${idx + 1} (VD: tai nạn)`}
                  />
                  <span className="text-slate-500 text-xs whitespace-nowrap">{k.points}đ</span>
                  <button
                    type="button"
                    onClick={() => {
                      const remaining = essayKeys.filter((_, i) => i !== idx);
                      setEssayKeys(distributeEssayPoints(remaining, points));
                    }}
                    className="text-red-500 hover:text-red-700 text-sm px-1"
                  >
                    Xóa
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    const next = [...essayKeys, { text: '', points: 0 }];
                    setEssayKeys(distributeEssayPoints(next, points));
                  }}
                  className="text-indigo-600 hover:underline text-sm"
                >
                  + Thêm key
                </button>
                {essayKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEssayKeys(distributeEssayPoints(essayKeys, points))}
                    className="text-slate-500 hover:text-slate-700 text-xs underline"
                  >
                    Chia đều lại
                  </button>
                )}
                {essayKeys.length > 0 && (
                  <span className={`text-xs ${Math.abs(essayKeys.reduce((s, k) => s + k.points, 0) - points) < 0.01 ? 'text-green-600' : 'text-amber-600'}`}>
                    Tổng: {Math.round(essayKeys.reduce((s, k) => s + k.points, 0) * 100) / 100} / {points} điểm
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rubric / gợi ý chấm (cho GV khi chấm lại)</label>
              <textarea value={rubric} onChange={(e) => setRubric(e.target.value)} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="Tiêu chí hoặc gợi ý bổ sung cho giáo viên..." />
            </div>
          </div>
        )}

        {/* Đúng/Sai đa phát biểu */}
        {isTrueFalseMultiView && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phát biểu và Đúng/Sai</label>
            <p className="text-xs text-slate-500 mb-2">Nhập từng phát biểu, chọn Đúng hoặc Sai. Khi chấm: điểm phân bổ đều theo số phát biểu đúng.</p>
            {visibleOptionIds.map((optId, idx) => (
              <div key={optId} className="flex items-center gap-2 mb-2">
                <span className="w-8 font-medium text-slate-600">{optId}.</span>
                <input type="text" value={options.find((o) => o.id === optId)?.text ?? ''}
                  onChange={(e) => handleOptionChange(optId, e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
                  placeholder={`Phát biểu ${optId}`} />
                <select
                  title={`Đáp án phát biểu ${optId}`}
                  value={tfAnswers[idx] === 'F' ? 'F' : 'T'}
                  onChange={(e) => setTfAnswers((prev) => {
                    const next = [...prev];
                    while (next.length <= idx) next.push('T');
                    next[idx] = e.target.value;
                    return next;
                  })}
                  className="w-28 border border-slate-300 rounded-lg px-2 py-2 text-sm flex-shrink-0">
                  <option value="T">✓ Đúng</option>
                  <option value="F">✗ Sai</option>
                </select>
              </div>
            ))}
          </div>
        )}

        {/* Nối đôi */}
        {isMatchingView && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cặp nối đôi (Cột trái ↔ Cột phải đúng)</label>
            <p className="text-xs text-slate-500 mb-2">Mỗi hàng = một cặp đúng. Khi thi, cột phải sẽ được hiển thị xáo trộn. Điểm phân bổ đều theo số cặp đúng.</p>
            {visibleOptionIds.map((optId, idx) => (
              <div key={optId} className="flex items-center gap-2 mb-2">
                <span className="w-8 font-medium text-slate-600">{optId}.</span>
                <input type="text" value={options.find((o) => o.id === optId)?.text ?? ''}
                  onChange={(e) => handleOptionChange(optId, e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
                  placeholder={`Cột trái ${optId}`} />
                <span className="text-slate-400 flex-shrink-0">↔</span>
                <input type="text" value={matchingRight[idx] ?? ''}
                  onChange={(e) => setMatchingRight((prev) => {
                    const next = [...prev];
                    while (next.length <= idx) next.push('');
                    next[idx] = e.target.value;
                    return next;
                  })}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
                  placeholder={`Cột phải ${idx + 1}`} />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Điểm</label>
            <input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Độ khó</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2">
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Chủ đề</label>
          <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2" placeholder="VD: An toàn hàng hải" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ảnh minh họa</label>
          <input type="file" accept="image/*" onChange={handleImageChange} className="block mb-2" />
          {displayImage && <img src={displayImage} alt="Preview" className="max-w-xs rounded border border-slate-200" />}
        </div>
        {questionType === 'drag_drop' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Đáp án – chọn nhãn đúng cho từng ô trên ảnh</label>
            <p className="text-xs text-slate-500 mb-2">Ô 1, Ô 2, Ô 3, Ô 4 tương ứng 4 vị trí bạn đặt trên ảnh. Mỗi ô chọn đúng một nhãn.</p>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((idx) => {
                const opts = options.filter((o) => o.text.trim() !== '');
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-slate-600 w-10">Ô {idx + 1}</span>
                    <select
                      value={zoneAnswers[idx] ?? ['A', 'B', 'C', 'D'][idx]}
                      onChange={(e) => {
                        const v = e.target.value;
                        setZoneAnswers((prev) => {
                          const next = [...prev];
                          while (next.length <= idx) next.push('A');
                          next[idx] = v;
                          return next;
                        });
                      }}
                      className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                    >
                      {opts.length >= 4 ? opts.map((o) => (
                        <option key={o.id} value={o.id}>{o.text || o.id}</option>
                      )) : (
                        ['A', 'B', 'C', 'D'].map((id) => (
                          <option key={id} value={id}>{options.find((x) => x.id === id)?.text || id}</option>
                        ))
                      )}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {questionType === 'drag_drop' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vị trí 4 ô trên ảnh (%)</label>
            {displayImage ? (
              <div className="mb-3">
                <ZonePositionPicker
                  imageUrl={displayImage}
                  zonePositions={zonePositions}
                  setZonePositions={setZonePositions}
                />
              </div>
            ) : (
              <p className="text-xs text-amber-600 mb-2">Hãy chọn ảnh minh họa trước để kéo 4 chấm đặt vị trí ô trên ảnh.</p>
            )}
            <p className="text-xs text-slate-500 mb-2">Hoặc nhập tay X, Y (% từ trái và từ trên của ảnh):</p>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-slate-600 w-10">Ô {idx + 1}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={zonePositions[idx]?.x ?? 10}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setZonePositions((prev) => {
                        const next = [...prev];
                        if (!next[idx]) next[idx] = { x: 10, y: 10 };
                        next[idx] = { ...next[idx], x: isNaN(v) ? 10 : Math.max(0, Math.min(100, v)) };
                        return next;
                      });
                    }}
                    className="w-16 border border-slate-300 rounded px-2 py-1 text-sm"
                    placeholder="X"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={zonePositions[idx]?.y ?? 10}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setZonePositions((prev) => {
                        const next = [...prev];
                        if (!next[idx]) next[idx] = { x: 10, y: 10 };
                        next[idx] = { ...next[idx], y: isNaN(v) ? 10 : Math.max(0, Math.min(100, v)) };
                        return next;
                      });
                    }}
                    className="w-16 border border-slate-300 rounded px-2 py-1 text-sm"
                    placeholder="Y"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm câu hỏi'}
          </button>
          <button
            type="button"
            onClick={() => {
              const baseUrl = `/admin/questions/occupation/${occupationId}`;
              const searchParams = new URLSearchParams(location.search);
              const returnModuleId = (moduleId ?? searchParams.get('moduleId')) || '';
              if (!returnModuleId) {
                navigate(-1);
                return;
              }
              navigate({ pathname: baseUrl, search: `?moduleId=${encodeURIComponent(returnModuleId)}` });
            }}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Hủy
          </button>
        </div>
      </form>
    </div>
  );
}
