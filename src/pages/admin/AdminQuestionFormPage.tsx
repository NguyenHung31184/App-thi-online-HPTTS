import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExam } from '../../services/examService';
import {
  getQuestion,
  createQuestion,
  updateQuestion,
  uploadQuestionImage,
} from '../../services/questionService';
import type { Question, QuestionType } from '../../types';

const OPTION_IDS = ['A', 'B', 'C', 'D', 'E'];

function emptyOptions(): { id: string; text: string }[] {
  return OPTION_IDS.map((id) => ({ id, text: '' }));
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

export default function AdminQuestionFormPage() {
  const { id: examId, qId } = useParams<{ id: string; qId?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(qId);

  const [examTitle, setExamTitle] = useState('');
  const [stem, setStem] = useState('');
  const [options, setOptions] = useState(emptyOptions());
  const [questionType, setQuestionType] = useState<QuestionType>('single_choice');
  const [answer_key, setAnswerKey] = useState('A');
  const [answerMultiple, setAnswerMultiple] = useState<string[]>([]);
  const [points, setPoints] = useState(1);
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [rubric, setRubric] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const opts = Array.isArray(q.options)
        ? (q.options as { id: string; text: string }[]).length
          ? (q.options as { id: string; text: string }[])
          : emptyOptions()
        : emptyOptions();
      setOptions(opts.length ? opts : emptyOptions());
      const parsed = parseAnswerKey(q.answer_key || 'A', q.question_type || 'single_choice');
      setAnswerKey(parsed.single);
      setAnswerMultiple(parsed.multiple.length ? parsed.multiple : [parsed.single]);
      const qType = (['single_choice', 'multiple_choice', 'drag_drop', 'video_paragraph', 'main_idea'] as QuestionType[]).includes(q.question_type)
        ? q.question_type
        : 'single_choice';
      setQuestionType(qType);
      setPoints(q.points ?? 1);
      setTopic(q.topic ?? '');
      setDifficulty(q.difficulty ?? 'medium');
      setExistingImageUrl(q.image_url ?? null);
      setExistingMediaUrl(q.media_url ?? null);
      setMediaUrl(q.media_url ?? '');
      setRubric(typeof q.rubric === 'string' ? q.rubric : (q.rubric ? JSON.stringify(q.rubric, null, 2) : ''));
    }).catch(() => setError('Không tải được câu hỏi.'));
    return () => { cancelled = true; };
  }, [isEdit, examId, qId]);

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

  const moveOption = (index: number, dir: -1 | 1) => {
    setOptions((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examId) return;
    setError('');
    setLoading(true);
    try {
      const isEssay = questionType === 'video_paragraph' || questionType === 'main_idea';
      const opts = options.filter((o) => o.text.trim() !== '');
      if (!isEssay && opts.length < 2) {
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
        finalAnswerKey = JSON.stringify(opts.map((o) => o.id));
      } else if (isEssay) {
        finalAnswerKey = '';
        optsToSave = [];
      } else {
        finalAnswerKey = answer_key;
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
      if (imageFile && examId) {
        image_url = await uploadQuestionImage(imageFile, examId, qId ?? undefined);
      }
      const media_url = (mediaUrl || existingMediaUrl || '').trim() || null;
      const rubricVal = rubric.trim() ? rubric.trim() : null;

      if (isEdit && qId) {
        await updateQuestion(qId, {
          question_type: questionType,
          stem,
          options: optsToSave.length ? optsToSave : [{ id: 'A', text: '' }],
          answer_key: finalAnswerKey,
          points,
          topic,
          difficulty,
          image_url,
          media_url: isEssay ? media_url : undefined,
          rubric: isEssay ? rubricVal : undefined,
        });
        navigate(`/admin/exams/${examId}/questions`);
      } else {
        await createQuestion({
          exam_id: examId,
          question_type: questionType,
          stem,
          options: optsToSave.length ? optsToSave : [{ id: 'A', text: '' }],
          answer_key: finalAnswerKey,
          points,
          topic,
          difficulty,
          image_url,
          media_url: isEssay ? media_url : undefined,
          rubric: isEssay ? rubricVal : undefined,
        });
        navigate(`/admin/exams/${examId}/questions`);
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
    video_paragraph: 'Clip + Tự luận',
    main_idea: 'Phân tích ý chính',
  };
  const isEssay = questionType === 'video_paragraph' || questionType === 'main_idea';
  const showOptions = !isEssay;

  return (
    <div>
      <p className="text-slate-500 text-sm">Đề thi: {examTitle}</p>
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
            {questionType === 'drag_drop' ? 'Các mục (thứ tự bên dưới = thứ tự đúng)' : 'Đáp án'}
          </label>
          {questionType === 'drag_drop' ? (
            options.map((opt, idx) => (
              <div key={opt.id} className="flex items-center gap-2 mb-2">
                <span className="text-slate-500 w-8">{idx + 1}.</span>
                <input
                  type="text"
                  value={opt.text}
                  onChange={(e) => handleOptionChange(opt.id, e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
                  placeholder={`Mục ${idx + 1}`}
                />
                <button type="button" onClick={() => moveOption(idx, -1)} disabled={idx === 0} className="px-2 py-1 border rounded text-sm disabled:opacity-40">↑</button>
                <button type="button" onClick={() => moveOption(idx, 1)} disabled={idx === options.length - 1} className="px-2 py-1 border rounded text-sm disabled:opacity-40">↓</button>
              </div>
            ))
          ) : (
          OPTION_IDS.map((optId) => (
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
                  <input
                    type="radio"
                    name="answer_key"
                    checked={answer_key === optId}
                    onChange={() => setAnswerKey(optId)}
                  />
                  <span className="text-sm">Đúng</span>
                </label>
              ) : (
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={answerMultiple.includes(optId)}
                    onChange={() => handleToggleMultiple(optId)}
                  />
                  <span className="text-sm">Đúng</span>
                </label>
              )}
            </div>
          ))
          )
        }
        </div>
        )}
        {questionType === 'video_paragraph' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL video</label>
            <input
              type="url"
              value={mediaUrl || existingMediaUrl || ''}
              onChange={(e) => setMediaUrl(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              placeholder="https://..."
            />
          </div>
        )}
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
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Ảnh minh họa</label>
          <input type="file" accept="image/*" onChange={handleImageChange} className="block mb-2" />
          {displayImage && (
            <img
              src={displayImage}
              alt="Preview"
              className="max-w-xs rounded border border-slate-200"
            />
          )}
        </div>
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
