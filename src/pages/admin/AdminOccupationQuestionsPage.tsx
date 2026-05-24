import { useEffect, useState } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getOccupation } from '../../services/occupationService';
import {
  listQuestionsByOccupation,
  listQuestionsWithoutModule,
  deleteQuestionBankItem,
  deleteQuestionBankItemsBulk,
  getQuestionBankItem,
  updateQuestionBankItem,
  uploadQuestionBankImage,
} from '../../services/questionBankService';
import type { Occupation, QuestionBankItem, ModuleItem } from '../../types';
import type { QuestionType } from '../../types';
import { listModulesByOccupationId } from '../../services/ttdtDataService';
import ConfirmationModal from '../../components/ConfirmationModal';
import { ZonePositionPicker } from '../../components/ZonePositionPicker';
import { validateMediaUrl } from '../../utils/mediaUrlValidator';

const NO_MODULE_ID = '__no_module__';
const OPTION_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const DEFAULT_ZONE_POSITIONS: { x: number; y: number }[] = [
  { x: 10, y: 10 }, { x: 70, y: 10 }, { x: 10, y: 70 }, { x: 70, y: 70 },
];

function emptyOptions() {
  return OPTION_IDS.map((id) => ({ id, text: '' }));
}

function parseAnswerKey(v: string, type: QuestionType) {
  const s = (v || '').trim();
  if (s.startsWith('[')) {
    try {
      const arr = JSON.parse(s) as string[];
      if (type === 'drag_drop') return { single: 'A', multiple: [] as string[], order: Array.isArray(arr) ? arr : [] };
      return { single: arr[0] || 'A', multiple: Array.isArray(arr) ? arr : [], order: [] as string[] };
    } catch {
      return { single: s.slice(0, 1) || 'A', multiple: [] as string[], order: [] as string[] };
    }
  }
  return { single: s.slice(0, 1) || 'A', multiple: [] as string[], order: [] as string[] };
}

// ── Inline edit form ──────────────────────────────────────────────────────────

function InlineEditForm({
  question,
  occupationId,
  onSave,
  onCancel,
}: {
  question: QuestionBankItem;
  occupationId: string;
  onSave: (updated: QuestionBankItem) => void;
  onCancel: () => void;
}) {
  const parsed = parseAnswerKey(question.answer_key || 'A', question.question_type || 'single_choice');

  const [stem, setStem] = useState(question.stem);
  const [questionType, setQuestionType] = useState<QuestionType>(
    (['single_choice', 'multiple_choice', 'drag_drop', 'video_paragraph', 'main_idea', 'true_false_multi', 'matching'] as QuestionType[]).includes(question.question_type)
      ? question.question_type : 'single_choice'
  );
  const [options, setOptions] = useState<{ id: string; text: string }[]>(() => {
    const loaded = Array.isArray(question.options) ? (question.options as { id: string; text: string }[]) : [];
    const base = loaded.length ? loaded : emptyOptions();
    // Pad với slot trống để luôn có A–J trong state (cho UX mở rộng)
    const existingIds = new Set(base.map((o) => o.id));
    const padded = [...base];
    for (const id of OPTION_IDS) {
      if (!existingIds.has(id)) padded.push({ id, text: '' });
    }
    return padded;
  });
  const [answerKey, setAnswerKey] = useState(parsed.single || 'A');
  const [answerMultiple, setAnswerMultiple] = useState<string[]>(parsed.multiple.length ? parsed.multiple : [parsed.single]);
  const [zoneAnswers, setZoneAnswers] = useState<string[]>(
    questionType === 'drag_drop' && parsed.order.length === 4 ? parsed.order : ['A', 'B', 'C', 'D']
  );
  const [zonePositions, setZonePositions] = useState<{ x: number; y: number }[]>(() => {
    let r: unknown = question.rubric;
    if (typeof r === 'string' && r.trim()) { try { r = JSON.parse(r); } catch { r = undefined; } }
    if (r && typeof r === 'object' && r !== null && 'zones' in r) {
      const zones = (r as { zones: { x: number; y: number }[] }).zones;
      if (Array.isArray(zones) && zones.length === 4) return zones.map((z) => ({ x: Number(z.x) || 10, y: Number(z.y) || 10 }));
    }
    return [...DEFAULT_ZONE_POSITIONS];
  });
  const [points, setPoints] = useState(question.points ?? 2);
  const [topic, setTopic] = useState(question.topic ?? '');
  const [difficulty, setDifficulty] = useState(question.difficulty ?? 'medium');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const existingImageUrl = question.image_url ?? null;
  const [mediaUrl, setMediaUrl] = useState(question.media_url ?? '');
  const [mediaUrlError, setMediaUrlError] = useState('');
  const [rubric, setRubric] = useState(
    typeof question.rubric === 'string' ? question.rubric : (question.rubric ? JSON.stringify(question.rubric, null, 2) : '')
  );
  // true_false_multi: mảng "T"/"F" tương ứng với từng option
  const [tfAnswers, setTfAnswers] = useState<string[]>(() => {
    if (question.question_type !== 'true_false_multi') return [];
    try { const p = JSON.parse(question.answer_key || '[]'); if (Array.isArray(p)) return p as string[]; } catch { /* ignore */ }
    return [];
  });
  // matching: cột phải (text) + map ghép đôi (auto A→1, B→2,...)
  const [matchingRight, setMatchingRight] = useState<string[]>(() => {
    if (question.question_type !== 'matching') return [];
    try {
      const p = JSON.parse(question.answer_key || '{}') as { right?: string[] };
      if (Array.isArray(p?.right)) return p.right;
    } catch { /* ignore */ }
    return [];
  });
  const [essayKeys, setEssayKeys] = useState<{ text: string; points: number }[]>(() => {
    const qType = (['single_choice', 'multiple_choice', 'drag_drop', 'video_paragraph', 'main_idea'] as QuestionType[]).includes(question.question_type)
      ? question.question_type : 'single_choice';
    if (qType !== 'video_paragraph' && qType !== 'main_idea') return [];
    try {
      const parsed: unknown = JSON.parse(question.answer_key || '[]');
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0] !== null && typeof parsed[0] === 'object' && 'text' in (parsed[0] as object)) {
        return parsed as { text: string; points: number }[];
      }
    } catch { /* ignore */ }
    return [];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEssay = questionType === 'video_paragraph' || questionType === 'main_idea';
  const isTrueFalseMulti = questionType === 'true_false_multi';
  const isMatching = questionType === 'matching';
  const displayImage = imagePreview || existingImageUrl;
  // UX tự động mở rộng: hiện tối thiểu 4 slot, thêm 1 slot trống sau slot cuối có nội dung, tối đa 10
  const filledCount = options.filter((o) => o.text.trim() !== '').length;
  const visibleOptionIds = OPTION_IDS.slice(0, Math.min(OPTION_IDS.length, Math.max(4, filledCount + 1)));

  const handleOptionChange = (id: string, text: string) =>
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, text } : o)));

  const handleToggleMultiple = (optId: string) =>
    setAnswerMultiple((prev) => prev.includes(optId) ? prev.filter((x) => x !== optId) : [...prev, optId].sort());

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const opts = options.filter((o) => o.text.trim() !== '');
      if (!isEssay && !isTrueFalseMulti && !isMatching && opts.length < 2) { setError('Cần ít nhất 2 đáp án.'); setSaving(false); return; }
      const validIds = opts.map((o) => o.id);
      let finalAnswerKey: string;
      let optsToSave = opts;
      if (questionType === 'multiple_choice') {
        finalAnswerKey = JSON.stringify(validIds.filter((id) => answerMultiple.includes(id)).sort());
      } else if (questionType === 'drag_drop') {
        const za = zoneAnswers.slice(0, 4);
        const unique = new Set(za);
        if (opts.length === 4 && (unique.size !== 4 || za.some((id) => !validIds.includes(id)))) {
          setError('Với câu kéo nhãn: mỗi ô phải chọn đúng một nhãn khác nhau.'); setSaving(false); return;
        }
        finalAnswerKey = JSON.stringify(za);
      } else if (isEssay) {
        const validKeys = essayKeys.filter((k) => k.text.trim() !== '' && k.points >= 0);
        finalAnswerKey = validKeys.length > 0 ? JSON.stringify(validKeys) : '';
        optsToSave = [];
      } else if (isTrueFalseMulti) {
        if (opts.length < 2) { setError('Cần ít nhất 2 phát biểu.'); setSaving(false); return; }
        const tf = opts.map((_, i) => (tfAnswers[i] === 'F' ? 'F' : 'T'));
        finalAnswerKey = JSON.stringify(tf);
      } else if (isMatching) {
        if (opts.length < 2) { setError('Cần ít nhất 2 cặp nối đôi.'); setSaving(false); return; }
        const right = opts.map((_, i) => (matchingRight[i] ?? '').trim());
        if (right.some((r) => r === '')) { setError('Nhập đủ nội dung cột phải cho mỗi cặp.'); setSaving(false); return; }
        const map: Record<string, string> = {};
        opts.forEach((o, i) => { map[o.id] = String(i + 1); });
        finalAnswerKey = JSON.stringify({ right, map });
      } else {
        if (!opts.some((o) => o.id === answerKey)) { setError('Đáp án đúng phải nằm trong danh sách đáp án đã nhập.'); setSaving(false); return; }
        finalAnswerKey = answerKey;
      }
      if (questionType === 'multiple_choice' && (answerMultiple.length === 0 || !validIds.some((id) => answerMultiple.includes(id)))) {
        setError('Chọn ít nhất một đáp án đúng.'); setSaving(false); return;
      }

      let image_url: string | null = existingImageUrl;
      if (imageFile) image_url = await uploadQuestionBankImage(imageFile, occupationId, question.id);

      const rawMediaUrl = (mediaUrl || '').trim();
      const mediaValidation = validateMediaUrl(rawMediaUrl);
      if (!mediaValidation.valid) { setMediaUrlError(mediaValidation.error ?? 'URL video không hợp lệ.'); setSaving(false); return; }
      setMediaUrlError('');

      let rubricVal: unknown = rubric.trim() ? rubric.trim() : null;
      if (questionType === 'drag_drop' && opts.length === 4) rubricVal = { zones: zonePositions };
      else if (isEssay) rubricVal = rubric.trim() ? rubric.trim() : null;

      const updated = await updateQuestionBankItem(question.id, {
        question_type: questionType,
        stem,
        options: optsToSave.length ? optsToSave : [{ id: 'A', text: '' }],
        answer_key: finalAnswerKey,
        points,
        topic,
        difficulty,
        image_url,
        media_url: isEssay ? (rawMediaUrl || null) : undefined,
        rubric: isEssay ? rubricVal : (questionType === 'drag_drop' && opts.length === 4 ? rubricVal : undefined),
      });
      toast.success('Đã lưu câu hỏi.');
      onSave(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu câu hỏi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 pt-3 border-t border-indigo-100 space-y-3">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Loại câu hỏi */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Loại câu hỏi</label>
          <select value={questionType} onChange={(e) => setQuestionType(e.target.value as QuestionType)}
            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
            <option value="single_choice">Trắc nghiệm 1 đáp án</option>
            <option value="multiple_choice">Nhiều đáp án đúng</option>
            <option value="drag_drop">Sắp thứ tự (kéo thả)</option>
            <option value="true_false_multi">Đúng/Sai đa phát biểu</option>
            <option value="matching">Nối đôi</option>
            <option value="video_paragraph">Clip + Tự luận</option>
            <option value="main_idea">Phân tích ý chính</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Điểm</label>
            <input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))}
              title="Điểm số" className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Độ khó</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
              title="Độ khó" className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm">
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chủ đề */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Chủ đề</label>
        <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" placeholder="VD: An toàn hàng hải" />
      </div>

      {/* Nội dung câu hỏi */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Nội dung câu hỏi *</label>
        <textarea value={stem} onChange={(e) => setStem(e.target.value)} required rows={3}
          title="Nội dung câu hỏi" className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
      </div>

      {/* Đáp án — trắc nghiệm, kéo thả */}
      {!isEssay && !isTrueFalseMulti && !isMatching && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {questionType === 'drag_drop' ? '4 nhãn' : 'Đáp án'}
          </label>
          {(questionType === 'drag_drop' ? ['A', 'B', 'C', 'D'] : visibleOptionIds).map((optId, idx) => (
            <div key={optId} className="flex items-center gap-2 mb-1.5">
              <span className="w-14 text-xs text-slate-500 flex-shrink-0">
                {questionType === 'drag_drop' ? `Nhãn ${idx + 1}` : `${optId}.`}
              </span>
              <input type="text" value={options.find((o) => o.id === optId)?.text ?? ''}
                onChange={(e) => handleOptionChange(optId, e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                placeholder={questionType === 'drag_drop' ? `Nhãn ${idx + 1}` : `Đáp án ${optId}`} />
              {questionType === 'single_choice' && (
                <label className="flex items-center gap-1 flex-shrink-0 text-xs">
                  <input type="radio" name={`answer_${question.id}`} checked={answerKey === optId} onChange={() => setAnswerKey(optId)} />
                  Đúng
                </label>
              )}
              {questionType === 'multiple_choice' && (
                <label className="flex items-center gap-1 flex-shrink-0 text-xs">
                  <input type="checkbox" checked={answerMultiple.includes(optId)} onChange={() => handleToggleMultiple(optId)} />
                  Đúng
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Đúng/Sai đa phát biểu */}
      {isTrueFalseMulti && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Phát biểu và Đúng/Sai</label>
          <p className="text-xs text-slate-400 mb-2">Nhập từng phát biểu, chọn Đúng hoặc Sai cho mỗi cái.</p>
          {visibleOptionIds.map((optId, idx) => (
            <div key={optId} className="flex items-center gap-2 mb-1.5">
              <span className="w-8 text-xs text-slate-500 flex-shrink-0">{optId}.</span>
              <input type="text" value={options.find((o) => o.id === optId)?.text ?? ''}
                onChange={(e) => handleOptionChange(optId, e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
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
                className="w-24 border border-slate-300 rounded-lg px-1 py-1.5 text-sm flex-shrink-0">
                <option value="T">✓ Đúng</option>
                <option value="F">✗ Sai</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Nối đôi */}
      {isMatching && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Cặp nối đôi (Cột trái ↔ Cột phải)</label>
          <p className="text-xs text-slate-400 mb-2">Mỗi hàng là một cặp đúng. Khi thi, cột phải sẽ được hiển thị xáo trộn.</p>
          {visibleOptionIds.map((optId, idx) => (
            <div key={optId} className="flex items-center gap-2 mb-1.5">
              <span className="w-8 text-xs text-slate-500 flex-shrink-0">{optId}.</span>
              <input type="text" value={options.find((o) => o.id === optId)?.text ?? ''}
                onChange={(e) => handleOptionChange(optId, e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                placeholder={`Cột trái ${optId}`} />
              <span className="text-slate-400 text-sm flex-shrink-0">↔</span>
              <input type="text"
                value={matchingRight[idx] ?? ''}
                onChange={(e) => setMatchingRight((prev) => {
                  const next = [...prev];
                  while (next.length <= idx) next.push('');
                  next[idx] = e.target.value;
                  return next;
                })}
                className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                placeholder={`Cột phải ${idx + 1}`} />
            </div>
          ))}
        </div>
      )}

      {/* Drag drop zone answers */}
      {questionType === 'drag_drop' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Đáp án từng ô trên ảnh</label>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((idx) => {
              const validOpts = options.filter((o) => o.text.trim() !== '');
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-10 flex-shrink-0">Ô {idx + 1}</span>
                  <select value={zoneAnswers[idx] ?? ['A', 'B', 'C', 'D'][idx]}
                    title={`Đáp án ô ${idx + 1}`}
                    onChange={(e) => setZoneAnswers((prev) => { const next = [...prev]; while (next.length <= idx) next.push('A'); next[idx] = e.target.value; return next; })}
                    className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm">
                    {(validOpts.length >= 4 ? validOpts : options).map((o) => (
                      <option key={o.id} value={o.id}>{o.text || o.id}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          {displayImage && (
            <div className="mt-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Vị trí ô trên ảnh</label>
              <ZonePositionPicker imageUrl={displayImage} zonePositions={zonePositions} setZonePositions={setZonePositions} />
            </div>
          )}
        </div>
      )}

      {/* Video URL */}
      {questionType === 'video_paragraph' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">URL video</label>
          <input type="url" value={mediaUrl} onChange={(e) => { setMediaUrl(e.target.value); const r = validateMediaUrl(e.target.value); setMediaUrlError(r.valid ? '' : (r.error ?? '')); }}
            className={`w-full border rounded-lg px-2 py-1.5 text-sm ${mediaUrlError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
            placeholder="https://youtube.com/..." />
          {mediaUrlError && <p className="mt-1 text-xs text-red-600">{mediaUrlError}</p>}
        </div>
      )}

      {/* Essay keys + Rubric */}
      {isEssay && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Keys chấm ý (tự động)</label>
            <p className="text-xs text-slate-400 mb-1.5">
              Hệ thống cộng điểm từng key xuất hiện trong bài (substring, không phân biệt hoa/thường). Để trống = GV chấm thủ công.
            </p>
            {essayKeys.map((k, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-1.5">
                <input
                  type="text"
                  value={k.text}
                  onChange={(e) => {
                    const updated = [...essayKeys];
                    updated[idx] = { ...updated[idx], text: e.target.value };
                    setEssayKeys(updated);
                  }}
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  placeholder={`Key ${idx + 1} (VD: tai nạn)`}
                />
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={k.points}
                  onChange={(e) => {
                    const updated = [...essayKeys];
                    updated[idx] = { ...updated[idx], points: Number(e.target.value) };
                    setEssayKeys(updated);
                  }}
                  className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                  placeholder="Đ"
                />
                <span className="text-slate-400 text-xs">đ</span>
                <button
                  type="button"
                  onClick={() => setEssayKeys((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-red-500 hover:text-red-700 text-xs px-1"
                >
                  Xóa
                </button>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEssayKeys((prev) => [...prev, { text: '', points: 2 }])}
                className="text-indigo-600 hover:underline text-xs"
              >
                + Thêm key
              </button>
              {essayKeys.length > 0 && (
                <span className={`text-xs ${essayKeys.reduce((s, k) => s + k.points, 0) === points ? 'text-green-600' : 'text-amber-600'}`}>
                  Tổng: {essayKeys.reduce((s, k) => s + k.points, 0)} / {points} điểm
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Rubric / gợi ý (cho GV)</label>
            <textarea value={rubric} onChange={(e) => setRubric(e.target.value)} rows={2}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" placeholder="Tiêu chí hoặc gợi ý bổ sung..." />
          </div>
        </div>
      )}

      {/* Ảnh minh họa */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Ảnh minh họa</label>
        <input type="file" accept="image/*" title="Chọn ảnh minh họa" onChange={(e) => { const f = e.target.files?.[0]; setImageFile(f ?? null); setImagePreview(f ? URL.createObjectURL(f) : null); }} className="block text-sm mb-1" />
        {displayImage && <img src={displayImage} alt="Preview" className="max-h-36 rounded border border-slate-200 object-contain" />}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
          {saving ? 'Đang lưu...' : 'Lưu'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm">
          Hủy
        </button>
      </div>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminOccupationQuestionsPage() {
  const { occupationId } = useParams<{ occupationId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [occupation, setOccupation] = useState<Occupation | null>(null);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteOne, setConfirmDeleteOne] = useState<{ id: string } | null>(null);
  const [confirmDeleteBulk, setConfirmDeleteBulk] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<QuestionBankItem | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [filterType, setFilterType] = useState<string>('');

  const load = async (moduleId: string | null) => {
    if (!occupationId) return;
    setLoading(true);
    setError('');
    try {
      const [occ, list] = await Promise.all([
        getOccupation(occupationId),
        moduleId === NO_MODULE_ID
          ? listQuestionsWithoutModule(occupationId)
          : listQuestionsByOccupation(occupationId, moduleId || undefined),
      ]);
      setOccupation(occ ?? null);
      setQuestions(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi tải dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!occupationId) return;
    const params = new URLSearchParams(location.search);
    const mId = params.get('moduleId');
    setSelectedModuleId(mId || null);
    load(mId === NO_MODULE_ID ? NO_MODULE_ID : mId);
  }, [occupationId, location.search]);

  useEffect(() => {
    if (!occupationId) return;
    let cancelled = false;
    listModulesByOccupationId(occupationId).then((list) => {
      if (!cancelled) setModules(list);
    }).catch(() => { if (!cancelled) setModules([]); });
    return () => { cancelled = true; };
  }, [occupationId]);

  const handleStartEdit = async (q: QuestionBankItem) => {
    if (editingId === q.id) { setEditingId(null); setEditingData(null); return; }
    setEditingId(q.id);
    setEditingData(null);
    setLoadingEdit(true);
    try {
      const fresh = await getQuestionBankItem(q.id);
      setEditingData(fresh ?? q);
    } catch {
      setEditingData(q);
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleSaved = (updated: QuestionBankItem) => {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    setEditingId(null);
    setEditingData(null);
  };

  const handleDelete = async (qId: string) => setConfirmDeleteOne({ id: qId });

  const doDeleteOne = async () => {
    if (!confirmDeleteOne) return;
    try {
      setDeleting(true);
      await deleteQuestionBankItem(confirmDeleteOne.id);
      setQuestions((prev) => prev.filter((q) => q.id !== confirmDeleteOne.id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(confirmDeleteOne.id); return next; });
      if (editingId === confirmDeleteOne.id) { setEditingId(null); setEditingData(null); }
      setConfirmDeleteOne(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectOne = (id: string) =>
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const toggleSelectAllVisible = () =>
    setSelectedIds((prev) => {
      const visibleIds = questions.map((q) => q.id);
      const allSelected = visibleIds.every((id) => prev.has(id));
      if (allSelected) { const next = new Set(prev); visibleIds.forEach((id) => next.delete(id)); return next; }
      return new Set([...prev, ...visibleIds]);
    });

  const doDeleteBulk = async () => {
    const ids = questions.map((q) => q.id).filter((id) => selectedIds.has(id));
    if (!ids.length) { setConfirmDeleteBulk(false); return; }
    try {
      setDeleting(true);
      await deleteQuestionBankItemsBulk(ids);
      setQuestions((prev) => prev.filter((q) => !selectedIds.has(q.id)));
      setSelectedIds(new Set());
      if (editingId && selectedIds.has(editingId)) { setEditingId(null); setEditingData(null); }
      setConfirmDeleteBulk(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi xóa hàng loạt.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !occupationId) return <p className="text-slate-500">Đang tải...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!occupation) return <p className="text-red-600">Không tìm thấy nghề đào tạo.</p>;

  const handleModuleChange = (mId: string) => {
    setEditingId(null); setEditingData(null);
    const params = new URLSearchParams(location.search);
    if (mId) params.set('moduleId', mId); else params.delete('moduleId');
    navigate({ pathname: `/admin/questions/occupation/${occupationId}`, search: params.toString() ? `?${params.toString()}` : '' });
  };

  const isNoModuleView = selectedModuleId === NO_MODULE_ID;
  const canAddOrImport = selectedModuleId && selectedModuleId !== NO_MODULE_ID;

  const visibleQuestions = filterType
    ? questions.filter((q) => q.question_type === filterType)
    : questions;

  const TYPE_OPTIONS = [
    { value: '', label: 'Tất cả loại' },
    { value: 'single_choice', label: 'Trắc nghiệm 1 ĐA' },
    { value: 'multiple_choice', label: 'Trắc nghiệm nhiều ĐA' },
    { value: 'drag_drop', label: 'Kéo thả / sắp xếp' },
    { value: 'true_false_multi', label: 'Đúng/Sai đa phát biểu' },
    { value: 'matching', label: 'Nối đôi' },
    { value: 'main_idea', label: 'Tự luận (chấm key)' },
    { value: 'video_paragraph', label: 'Tự luận + video' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link to="/admin/questions" className="text-slate-500 hover:text-slate-700 text-sm">← Soạn câu hỏi</Link>
          <h1 className="text-xl font-semibold text-slate-800 mt-1">Ngân hàng câu hỏi: {occupation.name}</h1>
          <p className="text-sm text-slate-600 mt-1">
            Bước 1: chọn <strong>mô-đun</strong> thuộc nghề này. Bước 2: soạn/import câu hỏi cho mô-đun đó.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select title="Chọn mô-đun" className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
            value={selectedModuleId ?? ''}
            onChange={(e) => handleModuleChange(e.target.value || '')}>
            <option value="">-- Chọn mô-đun --</option>
            <option value={NO_MODULE_ID}>— Câu chưa gắn mô-đun (lang thang) —</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>{m.code ? `${m.code} — ${m.name}` : m.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Link
              to={`/admin/questions/occupation/${occupationId}/new${canAddOrImport ? `?moduleId=${selectedModuleId}` : ''}`}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              onClick={(e) => { if (!canAddOrImport) { e.preventDefault(); toast.info(isNoModuleView ? 'Chọn mô-đun cụ thể để thêm câu hỏi.' : 'Hãy chọn mô-đun trước.'); } }}>
              Thêm câu hỏi
            </Link>
            <Link
              to={`/admin/questions/occupation/${occupationId}/import${canAddOrImport ? `?moduleId=${selectedModuleId}` : ''}`}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
              onClick={(e) => { if (!canAddOrImport) { e.preventDefault(); toast.info(isNoModuleView ? 'Chọn mô-đun cụ thể để import.' : 'Hãy chọn mô-đun trước.'); } }}>
              Import từ Excel
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {!selectedModuleId && (
          <p className="text-slate-500 text-sm">Vui lòng chọn mô-đun ở góc phải trên để xem và soạn câu hỏi.</p>
        )}
        {selectedModuleId === NO_MODULE_ID && (
          <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm">
            <strong>Câu hỏi chưa gắn mô-đun (lang thang)</strong> — Chọn từng câu hoặc <strong>Chọn tất cả</strong> rồi xóa để dọn dẹp.
          </p>
        )}
        {selectedModuleId && selectedModuleId !== NO_MODULE_ID && questions.length === 0 && (
          <p className="text-slate-500">Mô-đun này chưa có câu hỏi. Bấm "Thêm câu hỏi" hoặc "Import từ Excel".</p>
        )}
        {isNoModuleView && questions.length === 0 && (
          <p className="text-slate-500">Không có câu hỏi nào chưa gắn mô-đun trong nghề này.</p>
        )}

        {selectedModuleId && questions.length > 0 && (
          <>
            {/* Toolbar: filter + chọn/xóa hàng loạt */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <select
                  title="Lọc theo loại câu hỏi"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 bg-white"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button type="button" onClick={toggleSelectAllVisible}
                  className="px-2 py-1 border border-slate-300 rounded text-xs hover:bg-slate-50">
                  {visibleQuestions.every((q) => selectedIds.has(q.id)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
                <span>
                  Đang chọn <strong>{visibleQuestions.filter((q) => selectedIds.has(q.id)).length}</strong>
                  {' '}/ {visibleQuestions.length}
                  {filterType ? ` (lọc từ ${questions.length})` : ''} câu hỏi
                </span>
              </div>
              <button type="button"
                disabled={!visibleQuestions.some((q) => selectedIds.has(q.id))}
                onClick={() => setConfirmDeleteBulk(true)}
                className="px-3 py-1.5 rounded bg-red-50 text-red-700 border border-red-200 text-xs disabled:opacity-40 hover:bg-red-100">
                Xóa các câu đã chọn
              </button>
            </div>

            {visibleQuestions.length === 0 && (
              <p className="text-slate-400 text-sm py-4 text-center">Không có câu hỏi nào thuộc loại đã chọn.</p>
            )}

            {/* Danh sách câu hỏi */}
            {visibleQuestions.map((q, idx) => {
              const isExpanded = editingId === q.id;
              return (
                <div key={q.id}
                  className={`bg-white border rounded-lg transition-all ${isExpanded ? 'border-indigo-300 shadow-sm' : 'border-slate-200'}`}>
                  {/* Row header */}
                  <div className="p-4 flex justify-between items-start">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <input type="checkbox" title={`Chọn câu ${idx + 1}`} className="mt-1 h-4 w-4 text-indigo-600 border-slate-300 rounded"
                        checked={selectedIds.has(q.id)} onChange={() => toggleSelectOne(q.id)} />
                      <button type="button" onClick={() => handleStartEdit(q)}
                        className="flex-1 min-w-0 text-left group">
                        <p className="font-medium text-slate-800 group-hover:text-indigo-700 transition-colors">
                          Câu {idx + 1}. {q.stem.slice(0, 120)}{q.stem.length > 120 ? '...' : ''}
                        </p>
                        <p className="text-sm text-slate-500 mt-1">
                          Chủ đề: {q.topic || '—'} | Độ khó: {q.difficulty} | Điểm: {q.points}
                        </p>
                      </button>
                    </div>
                    <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                      <button type="button" onClick={() => handleStartEdit(q)}
                        className={`text-sm font-medium transition-colors ${isExpanded ? 'text-indigo-600' : 'text-indigo-500 hover:text-indigo-700'}`}>
                        {isExpanded ? '▲ Đóng' : 'Sửa'}
                      </button>
                      <button type="button" onClick={() => handleDelete(q.id)}
                        className="text-red-500 hover:text-red-700 text-sm">
                        Xóa
                      </button>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {isExpanded && (
                    <div className="px-4 pb-4">
                      {loadingEdit && !editingData ? (
                        <p className="text-slate-400 text-sm pt-2">Đang tải...</p>
                      ) : editingData ? (
                        <InlineEditForm
                          question={editingData}
                          occupationId={occupationId}
                          onSave={handleSaved}
                          onCancel={() => { setEditingId(null); setEditingData(null); }}
                        />
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      <ConfirmationModal isOpen={!!confirmDeleteOne} onClose={() => setConfirmDeleteOne(null)}
        onConfirm={doDeleteOne} title="Xóa câu hỏi" isLoading={deleting} confirmText="Xóa">
        Xóa câu hỏi này khỏi ngân hàng?
      </ConfirmationModal>
      <ConfirmationModal isOpen={confirmDeleteBulk} onClose={() => setConfirmDeleteBulk(false)}
        onConfirm={doDeleteBulk} title="Xóa nhiều câu hỏi" isLoading={deleting} confirmText="Xóa">
        Xóa {questions.filter((q) => selectedIds.has(q.id)).length} câu hỏi đã chọn khỏi ngân hàng? Thao tác này không thể hoàn tác.
      </ConfirmationModal>
    </div>
  );
}
