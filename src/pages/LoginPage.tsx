import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const username = email.trim();
    const loginEmail = username.includes('@') ? username : `${username}@hptts.vn`;
    const { error: err, user } = await signIn(loginEmail, password);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      const role = user?.role;
      if (role === 'admin') {
        // Admin: vào thẳng khu quản trị với sidebar đầy đủ (Đề thi, Kỳ thi, Báo cáo, Đồng bộ điểm...)
        navigate('/admin/dashboard', { replace: true });
      } else if (role === 'teacher' || role === 'proctor') {
        // Giáo viên: vào khu quản trị với sidebar giới hạn (Dashboard, Đề thi, Soạn câu hỏi, Báo cáo), bỏ qua CCCD
        navigate('/admin/dashboard', { replace: true });
      } else {
        // Mặc định: thí sinh → đi thẳng đến bước xác thực CCCD
        navigate('/verify-cccd', { replace: true });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">App Thi Online</h1>
        <p className="text-slate-500 text-sm text-center mb-6">Đăng nhập để tiếp tục</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Mã học viên hoặc email
            </label>
            <input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:via-blue-600 hover:to-indigo-700 shadow-lg shadow-indigo-500/25 disabled:opacity-50 transition-all"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-400 text-center">
          Trước khi thi có thể cần xác thực CCCD (màn hình kế tiếp).
        </p>
      </div>
    </div>
  );
}
