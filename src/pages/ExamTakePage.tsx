import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAttempt, updateAttemptAnswers, getQuestionsForAttempt, submitAttempt, logAuditEvent } from '../services/attemptService';
import { getExam } from '../services/examService';
import { getExamWindow } from '../services/examWindowService';
import { syncAttemptToTtdt, isTtdtSyncConfigured } from '../services/ttdtSyncService';
import { supabase } from '../lib/supabaseClient';
import { SortableOptionList } from '../components/SortableOptionList';
import { LabelOnImageDrop } from '../components/LabelOnImageDrop';
import type { Attempt, Exam, QuestionForStudent } from '../types';

function hashStringToSeed(s: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  const rnd = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ExamTakePage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<QuestionForStudent[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedRef = useRef<Record<string, string>>({});
  const timeUpSubmittedRef = useRef(false);
  const answersRef = useRef<Record<string, string>>({});
  answersRef.current = answers;
  const proctoringDoneRef = useRef(false);

  /** Proctoring cơ bản: chụp 1 ảnh webcam khi bắt đầu làm bài, upload Storage, ghi audit log. Tùy chọn — nếu từ chối camera vẫn cho làm bài. */
  useEffect(() => {
    if (!attemptId || !attempt || questions.length === 0 || proctoringDoneRef.current) return;
    proctoringDoneRef.current = true;
    let stream: MediaStream | null = null;
    const run = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await new Promise<void>((res, rej) => {
          video.onloadeddata = () => res();
          video.onerror = () => rej(new Error('Video not ready'));
        });
        video.play();
        await new Promise((r) => setTimeout(r, 500));
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
        if (!blob) return;
        const path = `proctoring/${attemptId}/start.jpg`;
        const { error: uploadErr } = await supabase.storage.from('exam-uploads').upload(path, blob, { upsert: true });
        if (uploadErr) return;
        const { data: urlData } = supabase.storage.from('exam-uploads').getPublicUrl(path);
        await logAuditEvent(attemptId, 'photo_taken', { url: urlData.publicUrl });
      } catch (_) {
        // User từ chối camera hoặc lỗi — không chặn làm bài
      } finally {
        if (stream) stream.getTracks().forEach((t) => t.stop());
      }
    };
    run();
  }, [attemptId, attempt?.id, questions.length]);

  const load = useCallback(async () => {
    if (!attemptId || !user?.id) return;
    const [a, e] = await Promise.all([getAttempt(attemptId), getAttempt(attemptId).then((at) => at && getExam(at.exam_id))]);
    if (!a || !e) {
      setError('Không tìm thấy bài làm hoặc đề thi.');
      return;
    }
    if (a.user_id !== user.id) {
      setError('Bạn không có quyền làm bài này.');
      return;
    }
    if (a.status === 'completed') {
      navigate(`/exam/${attemptId}/result`, { replace: true });
      return;
    }
    setAttempt(a);
    setExam(e);
    setAnswers((a.answers as Record<string, string>) ?? {});
    lastSavedRef.current = (a.answers as Record<string, string>) ?? {};
    const questionsList = await getQuestionsForAttempt(a.exam_id);
    setQuestions(questionsList);
    const endTime = a.started_at + e.duration_minutes * 60 * 1000;
    setRemainingMs(Math.max(0, endTime - Date.now()));
  }, [attemptId, user?.id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (remainingMs === null) return;
    const t = setInterval(() => {
      if (!attempt || !exam) return;
      const endTime = attempt.started_at + exam.duration_minutes * 60 * 1000;
      const r = Math.max(0, endTime - Date.now());
      setRemainingMs(r);
      if (r <= 0 && attempt.status === 'in_progress' && !timeUpSubmittedRef.current) {
        timeUpSubmittedRef.current = true;
        handleSubmit();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [remainingMs, attempt?.id, exam?.id]);

  const handleSubmit = async () => {
    if (!attemptId || !attempt || attempt.status !== 'in_progress') return;
    setSubmitting(true);
    setError('');
    const toSave = answersRef.current;
    try {
      await updateAttemptAnswers(attemptId, toSave);
      const result = await submitAttempt(attemptId);
      if (!result.ok) {
        setError(result.error ?? 'Chấm bài thất bại.');
        setSubmitting(false);
        return;
      }
      const updated = await getAttempt(attemptId);
      if (updated && exam && isTtdtSyncConfigured()) {
        const win = await getExamWindow(updated.window_id);
        await syncAttemptToTtdt(updated, exam, {
          studentId: user?.student_id ?? undefined,
          classId: win?.class_id ?? undefined,
        });
      }
      navigate(`/exam/${attemptId}/result`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi nộp bài.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!attemptId || Object.keys(answers).length === 0) return;
    autosaveRef.current = setInterval(async () => {
      if (JSON.stringify(answers) === JSON.stringify(lastSavedRef.current)) return;
      try {
        await updateAttemptAnswers(attemptId, answers);
        lastSavedRef.current = { ...answers };
      } catch (_) {}
    }, 10000);
    return () => {
      if (autosaveRef.current) clearInterval(autosaveRef.current);
    };
  }, [attemptId, answers]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && attemptId) {
        logAuditEvent(attemptId, 'visibility_hidden').catch(() => {});
      }
    };
    const onBlur = () => {
      if (attemptId) logAuditEvent(attemptId, 'focus_lost').catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [attemptId]);

  if (error && !attempt) return <p className="p-4 text-red-600">{error}</p>;
  if (!attempt || !exam) return <p className="p-4 text-slate-500">Đang tải...</p>;

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
        <span className="font-medium text-slate-800">{exam.title}</span>
        <span className={`font-mono text-lg ${remainingMs !== null && remainingMs < 60000 ? 'text-red-600' : 'text-slate-700'}`}>
          {remainingMs !== null ? formatRemaining(remainingMs) : '—'}
        </span>
      </div>

      {error && <p className="text-red-600 mb-2">{error}</p>}

      <p className="text-slate-500 text-sm mb-4">Trình duyệt sẽ ghi nhận khi bạn chuyển tab hoặc mất focus. Nên làm bài trong chế độ toàn màn hình.</p>

      <div className="space-y-6">
        {(() => {
          // Tráo thứ tự câu hỏi theo attemptId (ổn định cho thí sinh trong suốt lượt làm)
          const qSeed = hashStringToSeed(attemptId ?? 'seed');
          const shuffledQuestions = shuffleWithSeed(questions, qSeed);
          return shuffledQuestions.map((q, idx) => {
            const rawOpts = (Array.isArray(q.options) ? q.options as { id: string; text: string }[] : []);
            // Tráo đáp án cho trắc nghiệm (giữ id, chỉ tráo thứ tự hiển thị)
            const optSeed = hashStringToSeed(`${attemptId ?? 'seed'}|${q.id}|opts`);
            const opts = (q.question_type === 'single_choice' || q.question_type === 'multiple_choice')
              ? shuffleWithSeed(rawOpts, optSeed)
              : rawOpts;
          const isMultiple = q.question_type === 'multiple_choice';
          const isDragDrop = q.question_type === 'drag_drop';
          const isLabelOnImage = isDragDrop && q.image_url && opts.length === 4;
          const isEssay = q.question_type === 'video_paragraph' || q.question_type === 'main_idea';
          const currentSingle = answers[q.id] ?? '';
          let currentMultiple: string[] = [];
          let currentOrder: string[] = [];
          try {
            if (answers[q.id]?.startsWith('[')) {
              const parsed = JSON.parse(answers[q.id]) as string[];
              if (isDragDrop) currentOrder = parsed;
              else currentMultiple = parsed;
            } else if (answers[q.id]) {
              currentMultiple = [answers[q.id]];
              currentOrder = opts.length ? opts.map((o) => o.id) : [];
            }
          } catch {}
          if (isDragDrop && currentOrder.length === 0 && opts.length) currentOrder = opts.map((o) => o.id);
          const labelOnImageValue = isLabelOnImage
            ? (currentOrder.length >= 4 ? currentOrder : [...currentOrder, '', '', '', ''].slice(0, 4))
            : [];

          return (
            <div key={q.id} className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="font-medium text-slate-800 mb-2">
                Câu {idx + 1}. {q.stem}
                {isMultiple && <span className="text-slate-500 text-sm ml-1">(chọn nhiều đáp án đúng)</span>}
                {isDragDrop && <span className="text-slate-500 text-sm ml-1">(kéo thả sắp xếp đúng thứ tự)</span>}
                {isLabelOnImage && <span className="text-slate-500 text-sm ml-1">(kéo nhãn vào đúng ô trên hình)</span>}
                {isEssay && <span className="text-slate-500 text-sm ml-1">(tự luận)</span>}
              </p>
              {q.image_url && !isLabelOnImage && (
                <img src={q.image_url} alt="" className="max-w-full rounded mb-2 max-h-48 object-contain" />
              )}
              {isEssay && q.media_url && (
                <div className="mb-2">
                  <video src={q.media_url} controls className="max-w-full rounded max-h-64" />
                </div>
              )}
              {isEssay ? (
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  rows={5}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  placeholder="Nhập câu trả lời..."
                />
              ) : isLabelOnImage ? (
                (() => {
                  let r = q.rubric;
                  if (typeof r === 'string' && r.trim()) {
                    try {
                      r = JSON.parse(r) as unknown;
                    } catch {
                      r = undefined;
                    }
                  }
                  const zones =
                    r &&
                    typeof r === 'object' &&
                    r !== null &&
                    'zones' in r &&
                    Array.isArray((r as { zones?: unknown }).zones) &&
                    (r as { zones: { x: number; y: number }[] }).zones.length === 4
                      ? (r as { zones: { x: number; y: number }[] }).zones
                      : undefined;
                  return (
                    <LabelOnImageDrop
                      imageUrl={q.image_url!}
                      options={shuffleWithSeed(opts, hashStringToSeed(`${attemptId ?? 'seed'}|${q.id}|labels`))}
                      value={labelOnImageValue}
                      onChange={(zoneLabelIds) => setAnswers((prev) => ({ ...prev, [q.id]: JSON.stringify(zoneLabelIds) }))}
                      zones={zones}
                    />
                  );
                })()
              ) : isDragDrop && opts.length > 0 ? (
                <SortableOptionList
                  options={shuffleWithSeed(opts, hashStringToSeed(`${attemptId ?? 'seed'}|${q.id}|drag`))}
                  value={currentOrder}
                  onChange={(orderedIds) => setAnswers((prev) => ({ ...prev, [q.id]: JSON.stringify(orderedIds) }))}
                />
              ) : (
                <div className="space-y-2">
                  {opts.map((opt) =>
                    isMultiple ? (
                      <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={currentMultiple.includes(opt.id)}
                          onChange={() => {
                            const next = currentMultiple.includes(opt.id)
                              ? currentMultiple.filter((x) => x !== opt.id)
                              : [...currentMultiple, opt.id].sort();
                            setAnswers((prev) => ({ ...prev, [q.id]: JSON.stringify(next) }));
                          }}
                          className="w-4 h-4"
                        />
                        <span>{opt.text}</span>
                      </label>
                    ) : (
                      <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={q.id}
                          checked={currentSingle === opt.id}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                          className="w-4 h-4"
                        />
                        <span>{opt.text}</span>
                      </label>
                    )
                  )}
                </div>
              )}
            </div>
          );
          });
        })()}
      </div>

      <div className="mt-8 flex justify-between items-center">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Quay lại (bài làm đã được lưu tạm)
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || (remainingMs !== null && remainingMs <= 0)}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Đang nộp...' : 'Nộp bài'}
        </button>
      </div>
    </div>
  );
}
