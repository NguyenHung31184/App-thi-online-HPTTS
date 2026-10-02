/**
 * CCCD check before an exam: photo (camera or file) → OCR through the server proxy → server check against the class
 * lists. Typing the number and name skips the photo and goes through the same server check.
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OcrCccdResult } from '../../../../types';
import { manualCccdInput, verifyFailure } from '../../domain/cccd';
import { useAuth } from '../../queries/auth-context';
import { useOcrAvailable, useReadCccdCard, useVerifyCccd } from '../../queries/use-cccd-check';
import CccdCameraCapture from './CccdCameraCapture';
import { ManualCccdFallbackSection } from './ManualCccdFallback';

export default function VerifyCccdPage() {
  const navigate = useNavigate();
  const { setStudentInfo, user } = useAuth();
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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrAvailable = useOcrAvailable();
  const readCard = useReadCccdCard();
  const verify = useVerifyCccd();

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

  /** Step 1: the photo goes straight to the OCR proxy, no Storage upload first. */
  const handleRunOcr = async () => {
    if (!imageFile) return;
    setError('');
    setLoading(true);
    try {
      if (!ocrAvailable) {
        setError('Chưa cấu hình dịch vụ đọc CCCD. Vui lòng nhập tay số CCCD bên dưới.');
        setLoading(false);
        return;
      }

      const result = await readCard.mutateAsync(imageFile);
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

  /** Typed CCCD and name go through the same server check as after OCR. */
  const handleUseManualCccd = () => {
    setError('');
    const typed = manualCccdInput(manualCccd, manualName, manualDob);
    if ('error' in typed) {
      setError(typed.error);
      return;
    }
    setOcrData(typed.data);
    setStep('ocr');
  };

  /** Step 2: the server checks the CCCD read or typed against the TTDT class lists. */
  const handleVerify = async () => {
    if (!ocrData?.id_card_number) return;
    setError('');
    setLoading(true);
    try {
      const result = await verify.mutateAsync({ card: ocrData, examAccountEmail: user?.email ?? undefined });
      const failure = verifyFailure(result);
      if (failure || !result.data) {
        setError(failure ?? 'Kiểm tra CCCD thất bại.');
        setLoading(false);
        return;
      }

      if (result.data.student_id) {
        setStudentInfo(result.data.student_id, result.data.student_code ?? '', result.data.student_name, {
          student_dob: ocrData.dob ?? ocrData.date_of_birth,
          id_card_number: ocrData.id_card_number,
        });
      }
      setVerifiedClasses(result.data.classes ?? []);
      setStep('done');
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi kiểm tra CCCD.');
    }
    setLoading(false);
  };

  /** Nhận file từ camera (đã crop+encode) → set vào state, bỏ qua FileReader vì có URL tạm */
  const handleCameraCapture = (file: File) => {
    setIsCameraOpen(false);
    setError('');
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
    setStep('upload');
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 flex items-center justify-center">
      {/* Camera modal — hiện đè lên toàn màn hình */}
      <CccdCameraCapture
        isOpen={isCameraOpen}
        onCancel={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Xác thực CCCD trước khi thi</h1>
        <p className="text-slate-500 text-sm mb-6">
          Hệ thống gửi <strong>số CCCD</strong> và <strong>họ tên</strong> (và ngày sinh nếu có) lên TTDT để đối chiếu với danh sách học viên/lớp. Bạn có thể <strong>chụp ảnh thẻ</strong> để đọc tự động, hoặc <strong>nhập tay</strong> nếu OCR lỗi — cùng một bước kiểm tra phía server.
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
                {/* Nút chụp camera có khung hướng dẫn */}
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="w-full py-5 mb-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                >
                  <span>📷</span> Chụp CCCD bằng camera (có khung)
                </button>

                {/* Divider */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 border-t border-slate-200" />
                  <span className="text-xs text-slate-400">hoặc</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                >
                  Chọn ảnh từ thư viện / file
                </button>
                <ManualCccdFallbackSection
                  manualCccd={manualCccd}
                  setManualCccd={setManualCccd}
                  manualName={manualName}
                  setManualName={setManualName}
                  manualDob={manualDob}
                  setManualDob={setManualDob}
                  onSubmit={handleUseManualCccd}
                  submitLabel="Kiểm tra bằng CCCD + họ tên (không cần ảnh)"
                />
              </>
            ) : (
              <>
                <img
                  src={imagePreviewUrl}
                  alt="CCCD"
                  className="w-full max-h-64 object-contain rounded-lg border border-slate-200 mb-4"
                />
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="flex-1 py-2 border border-indigo-400 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors text-sm"
                  >
                    📷 Chụp lại
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 text-sm hover:bg-slate-50 transition-colors"
                  >
                    Chọn ảnh khác
                  </button>
                  <button
                    type="button"
                    onClick={handleRunOcr}
                    disabled={loading}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
                  >
                    {loading ? 'Đang đọc...' : 'Đọc CCCD'}
                  </button>
                </div>
                <ManualCccdFallbackSection
                  manualCccd={manualCccd}
                  setManualCccd={setManualCccd}
                  manualName={manualName}
                  setManualName={setManualName}
                  manualDob={manualDob}
                  setManualDob={setManualDob}
                  onSubmit={handleUseManualCccd}
                  submitLabel="Bỏ qua ảnh — kiểm tra bằng CCCD + họ tên nhập tay"
                />
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

      </div>
    </div>
  );
}
