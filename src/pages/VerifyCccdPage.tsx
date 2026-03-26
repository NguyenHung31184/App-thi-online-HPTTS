/**
 * Màn xác thực CCCD trước khi thi — tận dụng server OCR (proxy Chatbot).
 * Luồng: chụp/upload ảnh → upload lên Storage lấy URL → gọi OCR → hiển thị kết quả → Kiểm tra → gọi verify-cccd-for-exam.
 */
import { Link } from 'react-router-dom';

export default function VerifyCccdPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40 p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg p-6 border border-slate-100">
        <h1 className="text-xl font-bold text-slate-800 mb-2">Chế độ tối giản</h1>
        <p className="text-slate-600 text-sm mb-4">
          Màn hình xác thực CCCD đã được tắt. Thí sinh chỉ cần nhập họ tên và ngày sinh để vào thi trắc nghiệm.
        </p>
        <Link
          to="/student-info"
          className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
        >
          Đi tới trang nhập thông tin thí sinh
        </Link>
      </div>
    </div>
  );
}
