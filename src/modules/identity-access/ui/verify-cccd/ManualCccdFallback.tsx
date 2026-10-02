interface ManualCccdFallbackProps {
  manualCccd: string;
  setManualCccd: (v: string) => void;
  manualName: string;
  setManualName: (v: string) => void;
  manualDob: string;
  setManualDob: (v: string) => void;
  onSubmit: () => void;
  submitLabel: string;
}

/** Nhập CCCD + họ tên khi OCR lỗi — cùng API verify-cccd-for-exam như sau khi đọc ảnh. */
export function ManualCccdFallbackSection({
  manualCccd,
  setManualCccd,
  manualName,
  setManualName,
  manualDob,
  setManualDob,
  onSubmit,
  submitLabel,
}: ManualCccdFallbackProps) {
  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      <p className="text-slate-600 text-sm font-medium mb-1">Không đọc được ảnh / lỗi OCR?</p>
      <p className="text-slate-500 text-xs mb-3">
        Nhập <strong>số CCCD</strong> và <strong>họ tên đầy đủ</strong> đúng như trên thẻ. Ngày sinh (nếu có) giúp TTDT đối chiếu chặt hơn. Dữ liệu được gửi lên server giống hệt bước sau khi đọc ảnh thành công.
      </p>
      <div className="space-y-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Số CCCD (12 số)"
          value={manualCccd}
          onChange={(e) => setManualCccd(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="text"
          autoComplete="name"
          placeholder="Họ và tên đầy đủ (bắt buộc)"
          value={manualName}
          onChange={(e) => setManualName(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <input
          type="text"
          autoComplete="bday"
          placeholder="Ngày sinh (tùy chọn, VD: 11/05/1984)"
          value={manualDob}
          onChange={(e) => setManualDob(e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={onSubmit}
          className="w-full py-2.5 border-2 border-indigo-500 text-indigo-700 font-medium rounded-lg hover:bg-indigo-50 text-sm"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
