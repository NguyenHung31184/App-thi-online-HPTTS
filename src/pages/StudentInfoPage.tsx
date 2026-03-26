import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function normalizeDob(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  // Accept YYYY-MM-DD directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Accept DD/MM/YYYY or DD-MM-YYYY
  const m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!m) return null;
  const dd = m[1]!.padStart(2, '0');
  const mm = m[2]!.padStart(2, '0');
  const yyyy = m[3]!;
  return `${yyyy}-${mm}-${dd}`;
}

export default function StudentInfoPage() {
  const navigate = useNavigate();
  const { studentSession, setStudentIdentity } = useAuth();
  const [name, setName] = useState(studentSession?.student_name ?? '');
  const [dob, setDob] = useState(studentSession?.student_dob ?? '');
  const [error, setError] = useState('');

  const dobHint = useMemo(() => {
    if (!dob.trim()) return 'VD: 2012-05-11 hoặc 11/05/2012';
    const n = normalizeDob(dob);
    return n ? `Sẽ lưu: ${n}` : 'Định dạng ngày sinh chưa đúng';
  }, [dob]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const n = name.trim();
    const normalizedDob = normalizeDob(dob);
    if (!n) {
      setError('Vui lòng nhập họ tên.');
      return;
    }
    if (!normalizedDob) {
      setError('Vui lòng nhập ngày sinh hợp lệ (YYYY-MM-DD hoặc DD/MM/YYYY).');
      return;
    }
    setStudentIdentity(n, normalizedDob);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
        <h1 className="text-2xl font-bold text-slate-800 text-center mb-2">Thông tin thí sinh</h1>
        <p className="text-slate-500 text-sm text-center mb-6">
          Nhập họ tên và ngày sinh để vào thi trắc nghiệm.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Họ tên</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Nguyễn Văn A"
              autoComplete="name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Ngày sinh</label>
            <input
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="2012-05-11"
              autoComplete="bday"
              required
            />
            <p className="mt-1 text-xs text-slate-500">{dobHint}</p>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:from-indigo-600 hover:via-blue-600 hover:to-indigo-700 shadow-lg shadow-indigo-500/25 transition-all"
          >
            Vào trang thi
          </button>
        </form>
      </div>
    </div>
  );
}

