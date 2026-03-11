import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getPracticalAttempt,
  listPracticalPhotos,
  uploadPracticalPhoto,
  deletePracticalPhoto,
  submitPracticalAttempt,
} from '../services/practicalAttemptService';
import { getPracticalSessionWithTemplate } from '../services/practicalSessionService';
import type { PracticalSessionWithTemplate } from '../services/practicalSessionService';
import { listCriteriaByTemplate } from '../services/practicalTemplateService';
import type { PracticalAttemptPhoto, PracticalExamCriteria } from '../types';

export default function PracticalTakePage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [attempt, setAttempt] = useState<{ id: string; session_id: string; status: string } | null>(null);
  const [session, setSession] = useState<PracticalSessionWithTemplate | null>(null);
  const [criteria, setCriteria] = useState<PracticalExamCriteria[]>([]);
  const [photos, setPhotos] = useState<PracticalAttemptPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [uploadForCriteriaId, setUploadForCriteriaId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!attemptId || !user?.id) return;
    getPracticalAttempt(attemptId).then((a) => {
      if (!a) {
        setError('Không tìm thấy bài làm.');
        return;
      }
      if (a.user_id !== user.id) {
        setError('Bạn không có quyền làm bài này.');
        return;
      }
      if (a.status === 'submitted' || a.status === 'graded') {
        setError('Bài làm đã nộp.');
        return;
      }
      setAttempt(a);
      getPracticalSessionWithTemplate(a.session_id).then((s) => {
        setSession(s ?? null);
        if (s?.template_id) listCriteriaByTemplate(s.template_id).then(setCriteria);
      });
      listPracticalPhotos(attemptId).then(setPhotos);
    }).catch(() => setError('Lỗi tải dữ liệu.'));
  }, [attemptId, user?.id]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !attemptId) return;
    const criteriaId = uploadForCriteriaId;
    setUploadForCriteriaId(null);
    setUploading(true);
    setError('');
    try {
      const p = await uploadPracticalPhoto(attemptId, file, {
        criteria_id: criteriaId ?? null,
        label: criteriaId ? '' : file.name,
        order_index: photos.length,
      });
      setPhotos((prev) => [...prev, p]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải ảnh.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    try {
      await deletePracticalPhoto(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xóa ảnh.');
    }
  };

  const handleSubmit = async () => {
    if (!attemptId || !attempt) return;
    if (photos.length === 0) {
      setError('Vui lòng tải ít nhất một ảnh minh chứng trước khi nộp bài.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitPracticalAttempt(attemptId);
      setAttempt((prev) => (prev ? { ...prev, status: 'submitted' } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi nộp bài.');
    } finally {
      setSubmitting(false);
    }
  };

  if (error && !attempt) return <p className="p-4 text-red-600">{error}</p>;
  if (!attempt || !session) return <p className="p-4 text-slate-500">Đang tải...</p>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-semibold text-slate-800 mb-2">
        Thi thực hành: {session.template?.title ?? 'Nộp ảnh minh chứng'}
      </h1>
      <p className="text-slate-600 text-sm mb-4">
        Tải ảnh minh chứng theo từng tiêu chí (hoặc ảnh chung). Ít nhất 1 ảnh. Sau khi nộp bài bạn không thể sửa ảnh.
      </p>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <input
        type="file"
        accept="image/*"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelect}
      />

      <div className="space-y-4 mb-6">
        {criteria.map((c) => (
          <div key={c.id} className="bg-slate-50 rounded-lg p-4">
            <p className="font-medium text-slate-800">{c.name}</p>
            {c.description && <p className="text-sm text-slate-600 mt-1">{c.description}</p>}
            <p className="text-xs text-slate-500 mt-1">Điểm tối đa: {c.max_score}</p>
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                setUploadForCriteriaId(c.id);
                fileInputRef.current?.click();
              }}
              className="mt-2 px-3 py-1 bg-white border border-slate-300 rounded text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {uploading ? 'Đang tải...' : '+ Thêm ảnh cho tiêu chí này'}
            </button>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <h2 className="font-medium text-slate-800 mb-2">Ảnh đã tải ({photos.length})</h2>
        <button
          type="button"
          onClick={() => {
            setUploadForCriteriaId(null);
            fileInputRef.current?.click();
          }}
          disabled={uploading}
          className="mb-2 px-3 py-1 bg-slate-100 rounded text-sm hover:bg-slate-200 disabled:opacity-50"
        >
          + Thêm ảnh (chung)
        </button>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative border rounded overflow-hidden">
              <img src={p.file_url} alt="" className="w-24 h-24 object-cover" />
              <button
                type="button"
                onClick={() => handleRemovePhoto(p.id)}
                className="absolute top-0 right-0 bg-red-500 text-white text-xs px-1 rounded-bl"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Quay lại (chưa nộp)
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || photos.length === 0}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? 'Đang nộp...' : 'Nộp bài'}
        </button>
      </div>
    </div>
  );
}
