/**
 * Màn xác thực CCCD trước khi thi — tận dụng server OCR (proxy Chatbot).
 * Luồng: chụp/upload ảnh → upload lên Storage lấy URL → gọi OCR → hiển thị kết quả → Kiểm tra → gọi verify-cccd-for-exam.
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeCccdByImageUrl } from '../services/ocrService';
import { verifyCccdForExam } from '../services/verifyCccdService';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import type { OcrCccdResult } from '../types';

export default function VerifyCccdPage() {
  const navigate = useNavigate();
  const { setStudentInfo } = useAuth();
  const [step, setStep] = useState<'upload' | 'ocr' | 'verify' | 'done'>('upload');
  const [verifiedClasses, setVerifiedClasses] = useState<{ id: string; name: string }[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<OcrCccdResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualCccd, setManualCccd] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualDob, setManualDob] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh (JPEG, PNG).');
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
    setStep('upload');
  };

  /** Bước 1: Upload ảnh lên Supabase Storage, lấy URL rồi gọi OCR (proxy Chatbot). */
  const handleRunOcr = async () => {
    if (!imageFile) return;
    setError('');
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        setError('Chưa cấu hình Supabase. Cần Supabase + bucket "exam-uploads" để tải ảnh lên và gọi OCR.');
        setLoading(false);
        return;
      }
      const bucket = 'exam-uploads';
      const fileName = `cccd/${Date.now()}_${imageFile.name}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(fileName, imageFile, { upsert: true });

      if (uploadErr) {
        setError('Không thể tải ảnh lên. Bạn đã cấu hình Storage bucket "exam-uploads" chưa?');
        setLoading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(uploadData.path);
      const publicUrl = urlData.publicUrl;

      const result = await analyzeCccdByImageUrl(publicUrl);
      if (!result.success || !result.data) {
        setError(result.error || 'Không đọc được thông tin từ ảnh CCCD.');
        setLoading(false);
        return;
      }

      setOcrData(result.data);
      setStep('ocr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi gọi OCR.');
    }
    setLoading(false);
  };

  /** Dùng số CCCD nhập tay để chuyển sang bước kiểm tra (khi OCR lỗi hoặc user chọn nhập tay). */
  const handleUseManualCccd = () => {
    const cccd = manualCccd.replace(/\s/g, '').trim();
    setError('');
    if (!cccd) {
      setError('Vui lòng nhập số CCCD.');
      return;
    }
    setOcrData({
      id_card_number: cccd,
      full_name: manualName.trim() || undefined,
      name: manualName.trim() || undefined,
      dob: manualDob.trim() || undefined,
      date_of_birth: manualDob.trim() || undefined,
    });
    setStep('ocr');
  };

  /** Bước 2: Gọi TTDT verify-cccd-for-exam với số CCCD đã đọc hoặc nhập tay. */
  const handleVerify = async () => {
    if (!ocrData?.id_card_number) return;
    setError('');
    setLoading(true);
    try {
      const result = await verifyCccdForExam({
        id_card_number: ocrData.id_card_number,
        name: ocrData.full_name ?? ocrData.name,
        dob: ocrData.dob ?? ocrData.date_of_birth,
      });

      if (!result.success) {
        setError(result.error || 'Kiểm tra CCCD thất bại.');
        setLoading(false);
        return;
      }

      if (!result.data?.valid) {
        setError(result.data?.message || 'Số CCCD không thuộc danh sách được thi.');
        setLoading(false);
        return;
      }

      if (result.data.student_id) {
        setStudentInfo(result.data.student_id, result.data.student_code ?? '', result.data.student_name);
      }
      setVerifiedClasses(result.data.classes ?? []);
      setStep('done');
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi kiểm tra CCCD.');
    }
    setLoading(false);
  };

  const handleSkip = () => navigate('/dashboard', { replace: true });

  return (
    <div className="min-h-screen bg-slate-100 p-4 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Xác thực CCCD trước khi thi</h1>
        <p className="text-slate-500 text-sm mb-6">
          Rà soát học viên theo CCCD: kiểm tra số CCCD có đúng lớp được phép thi hay không. Chỉ học viên đúng lớp mới được cho vào thi. Chụp hoặc tải ảnh mặt trước CCCD để hệ thống đọc và kiểm tra với danh sách lớp.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {step === 'upload' && (
          <>
            {!imagePreviewUrl ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
                >
                  Chọn ảnh CCCD (mặt trước)
                </button>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-slate-500 text-sm mb-2">Hoặc nhập tay số CCCD:</p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Số CCCD"
                      value={manualCccd}
                      onChange={(e) => setManualCccd(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Họ tên (tùy chọn)"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Ngày sinh (tùy chọn, VD: 11/05/1984)"
                      value={manualDob}
                      onChange={(e) => setManualDob(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleUseManualCccd}
                      className="w-full py-2 border border-indigo-400 text-indigo-600 rounded-lg hover:bg-indigo-50 text-sm"
                    >
                      Kiểm tra số CCCD này
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <img
                  src={imagePreviewUrl}
                  alt="CCCD"
                  className="w-full max-h-64 object-contain rounded-lg border border-slate-200 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700"
                  >
                    Chọn ảnh khác
                  </button>
                  <button
                    type="button"
                    onClick={handleRunOcr}
                    disabled={loading}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {loading ? 'Đang đọc...' : 'Đọc CCCD'}
                  </button>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <p className="text-slate-500 text-sm mb-2">Hoặc nhập tay số CCCD (khi không đọc được ảnh):</p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Số CCCD"
                      value={manualCccd}
                      onChange={(e) => setManualCccd(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Họ tên (tùy chọn)"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Ngày sinh (tùy chọn, VD: 11/05/1984)"
                      value={manualDob}
                      onChange={(e) => setManualDob(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleUseManualCccd}
                      className="w-full py-2 border border-indigo-400 text-indigo-600 rounded-lg hover:bg-indigo-50 text-sm"
                    >
                      Dùng số CCCD này để kiểm tra
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {step === 'ocr' && ocrData && (
          <>
            <div className="space-y-2 p-4 bg-slate-50 rounded-xl mb-4 text-sm">
              <p><span className="font-medium text-slate-500">Số CCCD:</span> {ocrData.id_card_number ?? '—'}</p>
              <p><span className="font-medium text-slate-500">Họ tên:</span> {ocrData.full_name ?? ocrData.name ?? '—'}</p>
              <p><span className="font-medium text-slate-500">Ngày sinh:</span> {ocrData.dob ?? ocrData.date_of_birth ?? '—'}</p>
              <p><span className="font-medium text-slate-500">Ngày cấp:</span> {ocrData.id_card_issue_date ?? ocrData.issue_date ?? '—'}</p>
              <p><span className="font-medium text-slate-500">Nơi cấp:</span> {ocrData.id_card_issue_place ?? ocrData.issue_place ?? '—'}</p>
              <p className="text-slate-500 italic">Bấm &quot;Kiểm tra & vào thi&quot; để xem lớp đang tham gia và vào trang thi.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700"
              >
                Chọn ảnh khác
              </button>
              <button
                type="button"
                onClick={handleVerify}
                disabled={loading}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Đang kiểm tra...' : 'Kiểm tra & vào thi'}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm">
              <p className="font-medium text-green-800 mb-2">Xác thực thành công</p>
              <p><span className="text-slate-600">Số CCCD:</span> {ocrData?.id_card_number ?? '—'}</p>
              <p><span className="text-slate-600">Họ tên:</span> {ocrData?.full_name ?? ocrData?.name ?? '—'}</p>
              <p><span className="text-slate-600">Ngày sinh:</span> {ocrData?.dob ?? ocrData?.date_of_birth ?? '—'}</p>
              {verifiedClasses.length > 0 ? (
                <p className="mt-2">
                  <span className="text-slate-600 font-medium">Lớp đang tham gia:</span>{' '}
                  {verifiedClasses.map((c) => c.name).join(', ')}
                </p>
              ) : (
                <p className="mt-2 text-amber-700">Chưa gắn lớp nào trong hệ thống. Liên hệ quản trị để được gắn lớp và thấy kỳ thi.</p>
              )}
            </div>
            <p className="text-center text-green-600 font-medium">Đang chuyển đến trang thi...</p>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        <button
          type="button"
          onClick={handleSkip}
          className="mt-4 w-full py-2 text-slate-500 text-sm hover:text-slate-700"
        >
          Bỏ qua (đã đăng nhập và được phép thi)
        </button>
      </div>
    </div>
  );
}
