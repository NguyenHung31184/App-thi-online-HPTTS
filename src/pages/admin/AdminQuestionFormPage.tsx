import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExam } from '../../services/examService';
import {
  getQuestion,
  createQuestion,
  updateQuestion,
  uploadQuestionImage,
} from '../../services/questionService';
import { ZonePositionPicker } from '../../components/ZonePositionPicker';
import { validateMediaUrl } from '../../utils/mediaUrlValidator';
import { validateQuestion } from '../../utils/questionValidation';
import type { QuestionType } from '../../types';

const ALL_OPTION_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const;
type OptionId = typeof ALL_OPTION_IDS[number];

const ALL_TYPES: QuestionType[] = [
  'single_choice', 'multiple_choice', 'drag_drop',
  'true_false_multi', 'matching', 'video_paragraph', 'main_idea',
];

function defaultOptions(count = 4): { id: string; text: string }[] {
  return ALL_OPTION_IDS.slice(0, count).map((id) => ({ id, text: '' }));
}

function getNextId(existing: string[]): OptionId | null {
  for (const id of ALL_OPTION_IDS) {
    if (!existing.includes(id)) return id;
  }
  return null;
}

function defaultZonePositions(count: number): { x: number; y: number }[] {
  const cols = 3;
  return Array.from({ length: count }, (_, i) => ({
    x: 10 + (i % cols) * 30,
    y: 10 + Math.floor(i / cols) * 35,
  }));
}

function defaultMatchMap(optionIds: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  optionIds.forEach((id, i) => { map[id] = String(i + 1); });
  return map;
}

export default function AdminQuestionFormPage() {
  const { id: examId, qId } = useParams<{ id: string; qId?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(qId);

  const [examTitle, setExamTitle] = useState('');
  const [stem, setStem] = useState('');
  const [options, setOptions] = useState<{ id: string; text: string }[]>(defaultOptions(4));
  const [questionType, setQuestionType] = useState<QuestionType>('single_choice');

  // single_choice
  const [answer_key, setAnswerKey] = useState('A');
  // multiple_choice
  const [answerMultiple, setAnswerMultiple] = useState<string[]>([]);
  // drag_drop
  const [zoneCount, setZoneCount] = useState(4);
  const [zonePositions, setZonePositions] = useState<{ x: number; y: number }[]>(defaultZonePositions(4));
  const [zoneAnswers, setZoneAnswers] = useState<string[]>(['A', 'B', 'C', 'D']);
  // true_false_multi: one T/F per option (by index)
  const [tfAnswers, setTfAnswers] = useState<('T' | 'F')[]>(['T', 'T', 'T', 'T']);
  // matching
  const [rightItems, setRightItems] = useState<string[]>(['', '', '', '']);
  const [matchMap, setMatchMap] = useState<Record<string, string>>(defaultMatchMap(['A', 'B', 'C', 'D']));

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Resize drag_drop arrays when zoneCount changes
  useEffect(() => {
    if (questionType !== 'drag_drop') return;
    setOptions((prev) =>
      ALL_OPTION_IDS.slice(0, zoneCount).map((id) => ({
        id,
        text: prev.find((o) => o.id === id)?.text ?? '',
      }))
    );
    setZonePositions((prev) => {
      const next = [...prev];
      while (next.length < zoneCount) next.push({ x: 10 + (next.length % 3) * 30, y: 10 + Math.floor(next.length / 3) * 35 });
      return next.slice(0, zoneCount);
    });
    setZoneAnswers((prev) => {
      const next = [...prev];
      while (next.length < zoneCount) next.push(ALL_OPTION_IDS[next.length] ?? 'A');
      return next.slice(0, zoneCount);
    });
  }, [zoneCount, questionType]);

  useEffect(() => {
    if (!examId) return;
    getExam(examId).then((exam) => {
      if (exam) setExamTitle(exam.title);
    }).catch(() => {});
  }, [examId]);

  useEffect(() => {
    if (!isEdit || !examId || !qId) return;
    let cancelled = false;
    getQuestion(qId).then((q) => {
      if (cancelled || !q) return;
      setStem(q.stem);

      const qType: QuestionType = ALL_TYPES.includes(q.question_type as QuestionType)
        ? (q.question_type as QuestionType)
        : 'single_choice';
      setQuestionType(qType);

      const rawOpts: { id: string; text: string }[] =
        Array.isArray(q.options) && (q.options as { id: string; text: string }[]).length > 0
          ? (q.options as { id: string; text: string }[])
          : defaultOptions(4);
      setOptions(rawOpts);

      const ak = (q.answer_key || '').trim();

      if (qType === 'single_choice') {
        setAnswerKey(ak || rawOpts[0]?.id || 'A');
      } else if (qType === 'multiple_choice') {
        try { setAnswerMultiple(JSON.parse(ak) as string[]); } catch { setAnswerMultiple([]); }
      } else if (qType === 'drag_drop') {
        let order: string[] = [];
        try { order = JSON.parse(ak) as string[]; } catch { order = []; }
        // Nếu options nhiều hơn answer_key → dùng options.length để hiện đủ nhãn
        const count = Math.max(order.length, rawOpts.length) || 4;
        setZoneCount(count);
        // Nếu lệch nhau: giữ thứ tự đúng đã có, thêm nhãn còn thiếu vào cuối
        const fullOrder = [...order];
        const existingOrderSet = new Set(order);
        for (const opt of rawOpts) {
          if (!existingOrderSet.has(opt.id) && fullOrder.length < count) fullOrder.push(opt.id);
        }
        setZoneAnswers(fullOrder.length ? fullOrder : ALL_OPTION_IDS.slice(0, count) as unknown as string[]);
        let r: unknown = q.rubric;
        if (typeof r === 'string' && r.trim()) { try { r = JSON.parse(r); } catch { r = undefined; } }
        if (r && typeof r === 'object' && 'zones' in r && Array.isArray((r as { zones: { x: number; y: number }[] }).zones)) {
          const savedZones = (r as { zones: { x: number; y: number }[] }).zones.map((z) => ({ x: Number(z.x) || 10, y: Number(z.y) || 10 }));
          // Nếu zones ít hơn count thì padding thêm
          while (savedZones.length < count) savedZones.push({ x: 10 + (savedZones.length % 3) * 30, y: 10 + Math.floor(savedZones.length / 3) * 35 });
          setZonePositions(savedZones);
        } else {
          setZonePositions(defaultZonePositions(count));
        }
      } else if (qType === 'true_false_multi') {
        try {
          const arr = JSON.parse(ak) as ('T' | 'F')[];
          setTfAnswers(Array.isArray(arr) ? arr : rawOpts.map(() => 'T' as const));
        } catch { setTfAnswers(rawOpts.map(() => 'T' as const)); }
      } else if (qType === 'matching') {
        try {
          const parsed = JSON.parse(ak) as { right?: string[]; map?: Record<string, string> };
          setRightItems(parsed.right ?? rawOpts.map(() => ''));
          setMatchMap(parsed.map ?? defaultMatchMap(rawOpts.map((o) => o.id)));
        } catch {
          setRightItems(rawOpts.map(() => ''));
          setMatchMap(defaultMatchMap(rawOpts.map((o) => o.id)));
        }
      }

      const isEssay = qType === 'video_paragraph' || qType === 'main_idea';
      if (isEssay) {
        setRubric(typeof q.rubric === 'string' ? q.rubric : (q.rubric ? JSON.stringify(q.rubric, null, 2) : ''));
      }
      setPoints(q.points ?? 2);
      setTopic(q.topic ?? '');
      setDifficulty(q.difficulty ?? 'medium');
      setExistingImageUrl(q.image_url ?? null);
      setExistingMediaUrl(q.media_url ?? null);
      setMediaUrl(q.media_url ?? '');
    }).catch(() => setError('Không tải được câu hỏi.'));
    return () => { cancelled = true; };
  }, [isEdit, examId, qId]);

  const handleOptionChange = (id: string, text: string) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));
  };

  const handleAddOption = () => {
    const existingIds = options.map((o) => o.id);
    const nextId = getNextId(existingIds);
    if (!nextId) return;
    setOptions((prev) => [...prev, { id: nextId, text: '' }]);
    if (questionType === 'true_false_multi') setTfAnswers((prev) => [...prev, 'T']);
    if (questionType === 'matching') {
      const newIdx = options.length;
      setRightItems((prev) => [...prev, '']);
      setMatchMap((prev) => ({ ...prev, [nextId]: String(newIdx + 1) }));
    }
  };

  const handleRemoveOption = (id: string) => {
    const idx = options.findIndex((o) => o.id === id);
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((o) => o.id !== id));
    if (answer_key === id) setAnswerKey(options.find((o) => o.id !== id)?.id ?? 'A');
    setAnswerMultiple((prev) => prev.filter((x) => x !== id));
    if (questionType === 'true_false_multi' && idx >= 0) {
      setTfAnswers((prev) => prev.filter((_, i) => i !== idx));
    }
    if (questionType === 'matching') {
      if (idx >= 0) setRightItems((prev) => prev.filter((_, i) => i !== idx));
      setMatchMap((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
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

  const handleTypeChange = (newType: QuestionType) => {
    setQuestionType(newType);
    const newOpts = defaultOptions(4);
    setOptions(newOpts);
    setAnswerKey('A');
    setAnswerMultiple([]);
    setZoneCount(4);
    setZoneAnswers(['A', 'B', 'C', 'D']);
    setZonePositions(defaultZonePositions(4));
    setTfAnswers(['T', 'T', 'T', 'T']);
    setRightItems(['', '', '', '']);
    setMatchMap(defaultMatchMap(['A', 'B', 'C', 'D']));
  };

  // Tính validation real-time từ state hiện tại để hiện cảnh báo sớm (không chờ Save)
  const liveValidation = useMemo(() => {
    if (!isEdit) return null;
    const isEssay = questionType === 'video_paragraph' || questionType === 'main_idea';
    const opts = options.filter((o) => o.text.trim() !== '');
    let effectiveAk = '';
    if (questionType === 'single_choice') {
      effectiveAk = answer_key;
    } else if (questionType === 'multiple_choice') {
      effectiveAk = JSON.stringify([...answerMultiple].sort());
    } else if (questionType === 'drag_drop') {
      effectiveAk = JSON.stringify(zoneAnswers.slice(0, zoneCount));
    } else if (questionType === 'true_false_multi') {
      effectiveAk = JSON.stringify(opts.map((_, i) => tfAnswers[i] ?? 'T'));
    } else if (questionType === 'matching') {
      effectiveAk = JSON.stringify({ right: rightItems.slice(0, opts.length), map: matchMap });
    } else if (isEssay) {
      effectiveAk = '';
    }
    return validateQuestion({ question_type: questionType, stem, options: opts, answer_key: effectiveAk, points });
  }, [isEdit, questionType, stem, options, answer_key, answerMultiple, zoneAnswers, zoneCount, tfAnswers, rightItems, matchMap, points]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!examId) return;
    setError('');
    setLoading(true);
    try {
      const isEssay = questionType === 'video_paragraph' || questionType === 'main_idea';
      const opts = options.filter((o) => o.text.trim() !== '');

      if (!isEssay && opts.length < 2) {
        setError('Cần ít nhất 2 đáp án / phát biểu.');
        setLoading(false);
        return;
      }

      const validIds = opts.map((o) => o.id);
      let finalAnswerKey: string;
      let optsToSave = opts;

      if (questionType === 'single_choice') {
        if (!opts.some((o) => o.id === answer_key)) {
          setError('Đáp án đúng phải nằm trong danh sách đáp án đã nhập.');
          setLoading(false);
          return;
        }
        finalAnswerKey = answer_key;
      } else if (questionType === 'multiple_choice') {
        const validSelected = validIds.filter((id) => answerMultiple.includes(id));
        if (validSelected.length === 0) {
          setError('Chọn ít nhất một đáp án đúng.');
          setLoading(false);
          return;
        }
        finalAnswerKey = JSON.stringify(validSelected.sort());
      } else if (questionType === 'drag_drop') {
        const za = zoneAnswers.slice(0, zoneCount);
        const unique = new Set(za);
        if (unique.size !== zoneCount || za.some((id) => !validIds.includes(id))) {
          setError(`Mỗi ô phải chọn đúng một nhãn khác nhau (${zoneCount} ô = ${zoneCount} nhãn khác nhau).`);
          setLoading(false);
          return;
        }
        finalAnswerKey = JSON.stringify(za);
      } else if (questionType === 'true_false_multi') {
        const tfAligned = opts.map((_, i) => tfAnswers[i] ?? 'T');
        finalAnswerKey = JSON.stringify(tfAligned);
      } else if (questionType === 'matching') {
        const validRight = rightItems.slice(0, opts.length);
        if (validRight.some((r) => !r.trim())) {
          setError('Vui lòng nhập đủ nội dung cột phải cho tất cả các cặp.');
          setLoading(false);
          return;
        }
        finalAnswerKey = JSON.stringify({ right: validRight, map: matchMap });
      } else if (isEssay) {
        finalAnswerKey = '';
        optsToSave = [];
      } else {
        finalAnswerKey = answer_key;
      }

      let image_url: string | null = existingImageUrl;
      if (imageFile && examId) {
        image_url = await uploadQuestionImage(imageFile, examId, qId ?? undefined);
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

      let rubricVal: unknown = null;
      if (questionType === 'drag_drop') {
        rubricVal = { zones: zonePositions.slice(0, zoneCount) };
      } else if (isEssay) {
        rubricVal = rubric.trim() ? rubric.trim() : null;
      }

      const payload = {
        question_type: questionType,
        stem,
        options: optsToSave.length ? optsToSave : [{ id: 'A', text: '' }],
        answer_key: finalAnswerKey,
        points,
        topic,
        difficulty,
        image_url,
        media_url: isEssay ? media_url : undefined,
        rubric: rubricVal ?? undefined,
      };

      if (isEdit && qId) {
        await updateQuestion(qId, payload);
      } else {
        await createQuestion({ exam_id: examId, ...payload });
      }
      navigate(`/admin/exams/${examId}/questions`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu câu hỏi.');
    } finally {
      setLoading(false);
    }
  };

  const displayImage = imagePreview || existingImageUrl;
  const isEssay = questionType === 'video_paragraph' || questionType === 'main_idea';

  const typeLabels: Record<QuestionType, string> = {
    single_choice: 'Trắc nghiệm 1 đáp án',
    multiple_choice: 'Nhiều đáp án đúng',
    drag_drop: 'Sắp thứ tự (kéo thả)',
    video_paragraph: 'Clip + Tự luận',
    main_idea: 'Phân tích ý chính',
    true_false_multi: 'Đúng/Sai đa phát biểu',
    matching: 'Nối đôi',
  };

  return (
    <div>
      <p className="text-slate-500 text-sm">Đề thi: {examTitle}</p>
      <h1 className="text-xl font-semibold text-slate-800 mb-4">
        {isEdit ? 'Sửa câu hỏi' : 'Thêm câu hỏi'} — {typeLabels[questionType]}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {/* Cảnh báo sớm — hiện ngay khi mở form sửa, cập nhật real-time khi admin chỉnh */}
        {isEdit && liveValidation && !liveValidation.ok && (
          <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-1">
            <p className="text-sm font-semibold text-amber-800">
              Câu hỏi có {liveValidation.issues.length} vấn đề cần sửa trước khi lưu:
            </p>
            {liveValidation.issues.map((issue, i) => (
              <p key={i} className="text-xs text-amber-700">• {issue.message} — <span className="italic">{issue.fix}</span></p>
            ))}
          </div>
        )}

        {/* ─── Loại câu hỏi ─── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Loại câu hỏi</label>
          <select
            value={questionType}
            onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
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

        {/* ─── Nội dung câu hỏi ─── */}
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

        {/* ─── drag_drop: chọn số nhãn ─── */}
        {questionType === 'drag_drop' && (
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Số nhãn / ô:</label>
            <select
              value={zoneCount}
              onChange={(e) => setZoneCount(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-24"
            >
              {[2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        )}

        {/* ─── Đáp án: single / multiple / true_false_multi ─── */}
        {(questionType === 'single_choice' || questionType === 'multiple_choice' || questionType === 'true_false_multi') && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {questionType === 'true_false_multi' ? 'Các phát biểu' : 'Đáp án'}
            </label>
            {questionType === 'true_false_multi' && (
              <p className="text-xs text-slate-500 mb-2">Nhập từng phát biểu và bấm T (Đúng) / F (Sai).</p>
            )}
            {options.map((opt, optIdx) => (
              <div key={opt.id} className="flex items-center gap-2 mb-2">
                <span className="w-6 font-medium text-slate-600 text-sm flex-shrink-0">{opt.id}.</span>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 min-w-0"
                  placeholder={questionType === 'true_false_multi' ? `Phát biểu ${opt.id}` : `Đáp án ${opt.id}`}
                />
                {questionType === 'single_choice' && (
                  <label className="flex items-center gap-1 flex-shrink-0">
                    <input type="radio" name="answer_key" checked={answer_key === opt.id} onChange={() => setAnswerKey(opt.id)} />
                    <span className="text-sm">Đúng</span>
                  </label>
                )}
                {questionType === 'multiple_choice' && (
                  <label className="flex items-center gap-1 flex-shrink-0">
                    <input type="checkbox" checked={answerMultiple.includes(opt.id)} onChange={() => handleToggleMultiple(opt.id)} />
                    <span className="text-sm">Đúng</span>
                  </label>
                )}
                {questionType === 'true_false_multi' && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setTfAnswers((prev) => { const n = [...prev]; n[optIdx] = 'T'; return n; })}
                      className={`px-2 py-1 text-xs rounded font-bold border transition-colors ${tfAnswers[optIdx] === 'T' ? 'bg-green-500 text-white border-green-500' : 'border-slate-300 text-slate-600 hover:bg-green-50'}`}
                    >T</button>
                    <button
                      type="button"
                      onClick={() => setTfAnswers((prev) => { const n = [...prev]; n[optIdx] = 'F'; return n; })}
                      className={`px-2 py-1 text-xs rounded font-bold border transition-colors ${tfAnswers[optIdx] === 'F' ? 'bg-red-500 text-white border-red-500' : 'border-slate-300 text-slate-600 hover:bg-red-50'}`}
                    >F</button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveOption(opt.id)}
                  disabled={options.length <= 2}
                  title="Xóa đáp án này"
                  className="text-red-400 hover:text-red-600 disabled:opacity-30 text-xl leading-none px-1 flex-shrink-0"
                >−</button>
              </div>
            ))}
            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1 mt-1"
              >
                <span className="text-lg leading-none">+</span>
                Thêm {questionType === 'true_false_multi' ? 'phát biểu' : 'đáp án'}
              </button>
            )}
          </div>
        )}

        {/* ─── drag_drop: nhãn ─── */}
        {questionType === 'drag_drop' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{zoneCount} nhãn</label>
            <p className="text-xs text-slate-500 mb-2">Gõ tên nhãn bên dưới. Phần Đáp án bên dưới chọn nhãn đúng cho từng ô trên ảnh.</p>
            {ALL_OPTION_IDS.slice(0, zoneCount).map((optId, idx) => (
              <div key={optId} className="flex items-center gap-2 mb-2">
                <span className="text-slate-600 w-20 text-sm flex-shrink-0">Nhãn {idx + 1}</span>
                <input
                  type="text"
                  value={options.find((o) => o.id === optId)?.text ?? ''}
                  onChange={(e) => handleOptionChange(optId, e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
                  placeholder={`Nhãn ${optId}`}
                />
              </div>
            ))}
          </div>
        )}

        {/* ─── matching ─── */}
        {questionType === 'matching' && (
          <div className="space-y-4">
            {/* Left column */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cột trái (A, B, C...)</label>
              {options.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2 mb-2">
                  <span className="w-6 font-medium text-slate-600 text-sm flex-shrink-0">{opt.id}.</span>
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
                    placeholder={`Mục trái ${opt.id}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(opt.id)}
                    disabled={options.length <= 2}
                    title="Xóa cặp này"
                    className="text-red-400 hover:text-red-600 disabled:opacity-30 text-xl leading-none px-1 flex-shrink-0"
                  >−</button>
                </div>
              ))}
            </div>

            {/* Right column */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cột phải (1, 2, 3...)</label>
              <p className="text-xs text-slate-500 mb-2">Thứ tự sẽ bị trộn ngẫu nhiên khi hiển thị cho học viên.</p>
              {options.map((_, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <span className="w-6 font-medium text-slate-500 text-sm flex-shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    value={rightItems[idx] ?? ''}
                    onChange={(e) => setRightItems((prev) => {
                      const n = [...prev];
                      while (n.length <= idx) n.push('');
                      n[idx] = e.target.value;
                      return n;
                    })}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
                    placeholder={`Mục phải ${idx + 1}`}
                  />
                </div>
              ))}
            </div>

            {/* Mapping */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Đáp án đúng — mỗi mục cột trái khớp với số nào ở cột phải?</label>
              {options.map((opt, optIdx) => (
                <div key={opt.id} className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-slate-700 w-48 truncate flex-shrink-0">
                    {opt.id}: {opt.text || <span className="text-slate-400 italic">chưa nhập</span>}
                  </span>
                  <span className="text-slate-400">→</span>
                  <select
                    value={matchMap[opt.id] ?? String(optIdx + 1)}
                    onChange={(e) => setMatchMap((prev) => ({ ...prev, [opt.id]: e.target.value }))}
                    className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  >
                    {options.map((_, i) => (
                      <option key={i} value={String(i + 1)}>
                        {i + 1}: {rightItems[i] || `Mục phải ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center gap-1"
              >
                <span className="text-lg leading-none">+</span> Thêm cặp nối
              </button>
            )}
          </div>
        )}

        {/* ─── video_paragraph: URL ─── */}
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
            {mediaUrlError && <p className="mt-1 text-sm text-red-600">{mediaUrlError}</p>}
            {!mediaUrlError && <p className="mt-1 text-xs text-slate-500">Chỉ chấp nhận: YouTube, Vimeo hoặc Supabase Storage của dự án.</p>}
          </div>
        )}

        {/* ─── Essay rubric ─── */}
        {isEssay && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Rubric / gợi ý chấm (cho GV)</label>
            <textarea
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="Tiêu chí hoặc gợi ý đáp án..."
            />
          </div>
        )}

        {/* ─── Điểm + Độ khó ─── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Điểm</label>
            <input
              type="number"
              min={1}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Độ khó</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
            >
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
          </div>
        </div>

        {/* ─── Chủ đề ─── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Chủ đề</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="VD: An toàn hàng hải"
          />
        </div>

        {/* ─── Ảnh minh họa ─── */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ảnh minh họa</label>
          <input type="file" accept="image/*" onChange={handleImageChange} className="block mb-2" />
          {displayImage && (
            <img src={displayImage} alt="Preview" className="max-w-xs rounded border border-slate-200" />
          )}
        </div>

        {/* ─── drag_drop: chọn đáp án cho từng ô ─── */}
        {questionType === 'drag_drop' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Đáp án – chọn nhãn đúng cho từng ô trên ảnh</label>
            <p className="text-xs text-slate-500 mb-2">Mỗi ô chọn đúng một nhãn khác nhau.</p>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: zoneCount }, (_, idx) => {
                const activeOpts = options.filter((o) => o.text.trim() !== '');
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-slate-600 w-10 text-sm flex-shrink-0">Ô {idx + 1}</span>
                    <select
                      value={zoneAnswers[idx] ?? ALL_OPTION_IDS[idx]}
                      onChange={(e) => {
                        const v = e.target.value;
                        setZoneAnswers((prev) => {
                          const next = [...prev];
                          while (next.length <= idx) next.push(ALL_OPTION_IDS[next.length] ?? 'A');
                          next[idx] = v;
                          return next;
                        });
                      }}
                      className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                    >
                      {(activeOpts.length >= zoneCount ? activeOpts : ALL_OPTION_IDS.slice(0, zoneCount).map((id) => ({
                        id,
                        text: options.find((x) => x.id === id)?.text || id,
                      }))).map((o) => (
                        <option key={o.id} value={o.id}>{o.text || o.id}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── drag_drop: vị trí ô trên ảnh ─── */}
        {questionType === 'drag_drop' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vị trí {zoneCount} ô trên ảnh (%)</label>
            {displayImage ? (
              <div className="mb-3">
                <ZonePositionPicker
                  imageUrl={displayImage}
                  zonePositions={zonePositions}
                  setZonePositions={setZonePositions}
                  count={zoneCount}
                />
              </div>
            ) : (
              <p className="text-xs text-amber-600 mb-2">Hãy chọn ảnh minh họa trước để kéo chấm đặt vị trí ô.</p>
            )}
            <p className="text-xs text-slate-500 mb-2">Hoặc nhập tay X, Y (% từ trái và từ trên của ảnh):</p>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: zoneCount }, (_, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-slate-600 w-10 text-sm flex-shrink-0">Ô {idx + 1}</span>
                  <input
                    type="number" min={0} max={100}
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
                    type="number" min={0} max={100}
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
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm câu hỏi'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/admin/exams/${examId}/questions`)}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Hủy
          </button>
        </div>
      </form>
    </div>
  );
}
