import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getExam } from '../../services/examService';
import { createQuestionsBulk } from '../../services/questionService';
import { parseFileToRows, importRowToQuestionPayload, type ImportRow } from '../../services/questionImportService';

export default function AdminQuestionImportPage() {
  const { id: examId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [examTitle, setExamTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!examId) return;
    getExam(examId).then((exam) => exam && setExamTitle(exam.title)).catch(() => {});
  }, [examId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setRows([]);
    setResult(null);
    setError('');
  };

  const handleParse = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const parsed = await parseFileToRows(file, { firstRowIsHeader });
      setRows(parsed);
      if (parsed.length === 0) setError('Không có dòng dữ liệu nào (kiểm tra "Dòng đầu là tiêu đề").');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi đọc file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!examId || rows.length === 0) return;
    setImporting(true);
    setError('');
    setResult(null);
    try {
      const payloads = rows.map(importRowToQuestionPayload);
      const res = await createQuestionsBulk(examId, payloads);
      setResult(res);
      if (res.created > 0) setRows([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi nhập câu hỏi');
    } finally {
      setImporting(false);
    }
  };

  const previewRows = rows.slice(0, 20);
  const columns = ['Nội dung', 'A', 'B', 'C', 'D', 'Đáp án', 'Chủ đề', 'Độ khó', 'Điểm'] as const;

  return (
    <div>
      <p className="text-slate-500 text-sm">
        <Link to={`/admin/exams/${examId}/questions`} className="hover:underline">← Câu hỏi</Link>
        {' · '}
        <span className="font-medium text-slate-700">Import từ Excel / CSV</span>
      </p>
      <h1 className="text-xl font-semibold text-slate-800 mt-2 mb-4">
        Nhập ngân hàng câu hỏi vào đề: {examTitle || '...'}
      </h1>

      <p className="text-slate-600 mb-4 max-w-2xl">
        File Excel/CSV cần có các cột theo thứ tự: <strong>Nội dung câu hỏi, Đáp án A, B, C, D, Đáp án đúng (A/B/C/D hoặc 1/2/3/4), Chủ đề, Độ khó, Điểm</strong>.
        Cột 7–9 có thể để trống. Xem <code className="bg-slate-100 px-1 rounded">docs/HUONG_DAN_SOAN_DE_VA_IMPORT_CAU_HOI.md</code>.
      </p>

      <div className="space-y-4 max-w-2xl">
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="block"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={firstRowIsHeader}
              onChange={(e) => setFirstRowIsHeader(e.target.checked)}
            />
            Dòng đầu là tiêu đề
          </label>
          <button
            type="button"
            onClick={handleParse}
            disabled={!file || loading}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? 'Đang đọc...' : 'Đọc file & xem trước'}
          </button>
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {result && (
          <p className="text-green-700">
            Đã thêm <strong>{result.created}</strong> câu hỏi.
            {result.errors.length > 0 && (
              <span className="block text-amber-700 mt-1">Một số dòng lỗi: {result.errors.slice(0, 3).join('; ')}</span>
            )}
          </p>
        )}

        {rows.length > 0 && (
          <>
            <p className="text-slate-600">Xem trước {previewRows.length} / {rows.length} dòng:</p>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    {columns.map((c) => (
                      <th key={c} className="px-2 py-1 text-left border-b border-slate-200">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-2 py-1 max-w-xs truncate" title={r.stem}>{r.stem}</td>
                      <td className="px-2 py-1 max-w-[120px] truncate">{r.optionA}</td>
                      <td className="px-2 py-1 max-w-[120px] truncate">{r.optionB}</td>
                      <td className="px-2 py-1 max-w-[120px] truncate">{r.optionC}</td>
                      <td className="px-2 py-1 max-w-[120px] truncate">{r.optionD}</td>
                      <td className="px-2 py-1">{r.answer}</td>
                      <td className="px-2 py-1">{r.topic}</td>
                      <td className="px-2 py-1">{r.difficulty}</td>
                      <td className="px-2 py-1">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {importing ? 'Đang nhập...' : `Nhập ${rows.length} câu vào đề này`}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/admin/exams/${examId}/questions`)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Xong
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
