import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { getOccupation } from '../../services/occupationService';
import { createQuestionBankBulk, listQuestionsByOccupation } from '../../services/questionBankService';
import { parseFileToRows, importRowToQuestionPayload, auditSingleChoicePayloads } from '../../services/questionImportService';
import * as XLSX from 'xlsx';

type QuestionPayload = ReturnType<typeof importRowToQuestionPayload>;

export default function AdminQuestionBankImportPage() {
  const { occupationId } = useParams<{ occupationId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [occupationName, setOccupationName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [rows, setRows] = useState<QuestionPayload[]>([]);
  const [auditIssues, setAuditIssues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [error, setError] = useState('');
  const [moduleId, setModuleId] = useState<string | null>(null);

  useEffect(() => {
    if (!occupationId) return;
    const params = new URLSearchParams(location.search);
    const mId = params.get('moduleId');
    setModuleId(mId);
    getOccupation(occupationId).then((o) => o && setOccupationName(o.name)).catch(() => {});
  }, [occupationId, location.search]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setRows([]);
    setAuditIssues([]);
    setResult(null);
    setError('');
  };

  const handleParse = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setAuditIssues([]);
    try {
      const parsed = await parseFileToRows(file, { firstRowIsHeader });
      const payloads = parsed.map((r) => importRowToQuestionPayload(r));
      setRows(payloads);
      if (payloads.length === 0) setError('Không có dòng dữ liệu nào (kiểm tra "Dòng đầu là tiêu đề").');

      if (occupationId && payloads.length > 0) {
        try {
          const existing = await listQuestionsByOccupation(occupationId, moduleId);
          const issues = auditSingleChoicePayloads(payloads, existing as unknown as QuestionPayload[]);
          setAuditIssues(issues.map((x) => x.message));
        } catch {
          // Nếu không tải được existing, vẫn audit nội bộ file
          const issues = auditSingleChoicePayloads(payloads);
          setAuditIssues(issues.map((x) => x.message));
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi đọc file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!occupationId || rows.length === 0) return;
    setImporting(true);
    setError('');
    setResult(null);
    try {
      const res = await createQuestionBankBulk(occupationId, moduleId ?? null, rows);
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

  const handleDownloadTemplate = () => {
    const header = [
      'Nội dung câu hỏi',
      'Đáp án A',
      'Đáp án B',
      'Đáp án C',
      'Đáp án D',
      'Đáp án đúng (A/B/C/D hoặc 1/2/3/4)',
      'Chủ đề',
      'Độ khó (easy/medium/hard hoặc Dễ/Trung bình/Khó)',
      'Điểm',
    ];
    const exampleRow = [
      'Máy nâng dùng để làm gì?',
      'Nâng hàng',
      'Lái xe',
      'Đóng gói',
      'Kiểm tra hàng',
      'A',
      'Kiến thức cơ bản',
      'medium',
      '1',
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cau_hoi');
    XLSX.writeFile(wb, 'Mau_nhap_cau_hoi.xlsx');
  };

  return (
    <div>
      <p className="text-slate-500 text-sm">
        <Link to={`/admin/questions/occupation/${occupationId}`} className="hover:underline">← Ngân hàng câu hỏi</Link>
        {' · '}
        <span className="font-medium text-slate-700">Import từ Excel / CSV</span>
      </p>
      <h1 className="text-xl font-semibold text-slate-800 mt-2 mb-4">
        Nhập câu hỏi vào ngân hàng: {occupationName || '...'}
      </h1>

      <p className="text-slate-600 mb-4 max-w-2xl">
        File Excel/CSV cần có các cột: <strong>Nội dung câu hỏi, Đáp án A, B, C, D, Đáp án đúng (A/B/C/D), Chủ đề, Độ khó, Điểm</strong>. Cột 7–9 có thể để trống.
      </p>

      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="text-indigo-700 hover:underline text-sm"
          >
            Tải file mẫu (Excel .xlsx)
          </button>
          <span className="text-slate-400 text-xs">•</span>
          <span className="text-slate-500 text-xs">Mẹo: mở file CSV bằng Excel rồi copy/paste câu hỏi vào.</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="block" />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={firstRowIsHeader} onChange={(e) => setFirstRowIsHeader(e.target.checked)} />
            Dòng đầu là tiêu đề
          </label>
          <button type="button" onClick={handleParse} disabled={!file || loading} className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50">
            {loading ? 'Đang đọc...' : 'Đọc file & xem trước'}
          </button>
        </div>

        {error && <p className="text-red-600">{error}</p>}
        {auditIssues.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 text-amber-900 rounded-lg p-3 text-sm">
            <p className="font-medium mb-1">Rà soát phát hiện {auditIssues.length} vấn đề:</p>
            <ul className="list-disc pl-5 space-y-1">
              {auditIssues.slice(0, 8).map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
            {auditIssues.length > 8 && <p className="text-xs mt-2">… và {auditIssues.length - 8} vấn đề khác.</p>}
          </div>
        )}
        {result && (
          <p className="text-green-700">
            Đã thêm <strong>{result.created}</strong> câu hỏi.
            {result.errors.length > 0 && <span className="block text-amber-700 mt-1">Một số dòng lỗi: {result.errors.slice(0, 3).join('; ')}</span>}
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
                      <td className="px-2 py-1 max-w-[120px] truncate">{r.options[0]?.text}</td>
                      <td className="px-2 py-1 max-w-[120px] truncate">{r.options[1]?.text}</td>
                      <td className="px-2 py-1 max-w-[120px] truncate">{r.options[2]?.text}</td>
                      <td className="px-2 py-1 max-w-[120px] truncate">{r.options[3]?.text}</td>
                      <td className="px-2 py-1">{r.answer_key}</td>
                      <td className="px-2 py-1">{r.topic}</td>
                      <td className="px-2 py-1">{r.difficulty}</td>
                      <td className="px-2 py-1">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleImport} disabled={importing} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {importing ? 'Đang nhập...' : `Nhập ${rows.length} câu vào ngân hàng`}
              </button>
              <button type="button" onClick={() => navigate(`/admin/questions/occupation/${occupationId}`)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
                Xong
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
