import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { getExam } from '../../services/examService';
import { createQuestionsBulk } from '../../services/questionService';
import { uploadQuestionImage } from '../../services/questionService';
import {
  parseFileToRows,
  importRowToQuestionPayload,
  auditSingleChoicePayloads,
  parseZipToRows,
  type ImportRow,
  type ZipParsedRow,
} from '../../services/questionImportService';

type Tab = 'excel' | 'zip';

export default function AdminQuestionImportPage() {
  const { id: examId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [examTitle, setExamTitle] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('excel');

  // ── Excel tab state ──────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [auditIssues, setAuditIssues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null);
  const [error, setError] = useState('');

  // ── ZIP tab state ────────────────────────────────────────────────────────
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipRows, setZipRows] = useState<ZipParsedRow[]>([]);
  const [zipWarnings, setZipWarnings] = useState<string[]>([]);
  const [zipParsing, setZipParsing] = useState(false);
  const [zipImporting, setZipImporting] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);
  const [zipResult, setZipResult] = useState<{
    created: number;
    errors: string[];
    uploadWarnings: string[];
  } | null>(null);
  const [zipError, setZipError] = useState('');

  useEffect(() => {
    if (!examId) return;
    getExam(examId).then((exam) => exam && setExamTitle(exam.title)).catch(() => {});
  }, [examId]);

  // ── Excel handlers ───────────────────────────────────────────────────────

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
      setRows(parsed);
      if (parsed.length === 0) {
        setError('Không có dòng dữ liệu nào (kiểm tra "Dòng đầu là tiêu đề").');
      } else {
        const payloads = parsed.map(importRowToQuestionPayload);
        const issues = auditSingleChoicePayloads(payloads);
        setAuditIssues(issues.map((x) => x.message));
      }
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

  const handleDownloadExcelTemplate = () => {
    const header = [
      'Nội dung câu hỏi', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D',
      'Đáp án đúng (A/B/C/D hoặc 1/2/3/4)', 'Chủ đề',
      'Độ khó (easy/medium/hard hoặc Dễ/Trung bình/Khó)', 'Điểm',
    ];
    const exampleRow = [
      'Máy nâng dùng để làm gì?', 'Nâng hàng', 'Lái xe', 'Đóng gói', 'Kiểm tra hàng',
      'A', 'Kiến thức cơ bản', 'medium', '1',
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, exampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cau_hoi');
    XLSX.writeFile(wb, 'Mau_nhap_cau_hoi.xlsx');
  };

  // ── ZIP handlers ─────────────────────────────────────────────────────────

  const handleZipFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setZipFile(f ?? null);
    setZipRows([]);
    setZipWarnings([]);
    setZipResult(null);
    setZipError('');
  };

  const handleZipParse = async () => {
    if (!zipFile) return;
    setZipParsing(true);
    setZipError('');
    setZipWarnings([]);
    setZipRows([]);
    setZipResult(null);
    try {
      const { rows: parsed, warnings } = await parseZipToRows(zipFile);
      setZipRows(parsed);
      setZipWarnings(warnings);
      if (parsed.length === 0) {
        setZipError('Không có câu hỏi nào được đọc từ file Excel trong zip.');
      }
    } catch (e) {
      setZipError(e instanceof Error ? e.message : 'Lỗi giải nén hoặc đọc file');
    } finally {
      setZipParsing(false);
    }
  };

  const handleZipImport = async () => {
    if (!examId || zipRows.length === 0) return;
    setZipImporting(true);
    setZipResult(null);

    const rowsWithImage = zipRows.filter((r) => r.imageBlob !== null);
    let uploadedCount = 0;
    const uploadWarnings: string[] = [];

    setZipProgress({ current: 0, total: rowsWithImage.length });

    const payloads: Array<ReturnType<typeof importRowToQuestionPayload> & { image_url: string | null }> = [];

    for (const row of zipRows) {
      const base = importRowToQuestionPayload(row);
      let image_url: string | null = null;

      if (row.imageBlob) {
        const imageFile = new File([row.imageBlob], row.imageFile, {
          type: row.imageBlob.type || 'image/jpeg',
        });

        // Thử upload, retry 1 lần nếu thất bại
        let uploaded = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            image_url = await uploadQuestionImage(imageFile, examId);
            uploaded = true;
            break;
          } catch {
            if (attempt === 1) {
              uploadWarnings.push(
                `Ảnh "${row.imageFile}": upload thất bại sau 2 lần thử → câu hỏi import không có ảnh.`,
              );
            }
          }
        }

        if (!uploaded) image_url = null;
        uploadedCount++;
        setZipProgress({ current: uploadedCount, total: rowsWithImage.length });
      }

      payloads.push({ ...base, image_url });
    }

    try {
      const res = await createQuestionsBulk(examId, payloads);
      setZipResult({ ...res, uploadWarnings });
      if (res.created > 0) setZipRows([]);
    } catch (e) {
      setZipError(e instanceof Error ? e.message : 'Lỗi nhập câu hỏi vào database');
    } finally {
      setZipImporting(false);
      setZipProgress(null);
    }
  };

  const handleDownloadZipTemplate = async () => {
    const zip = new JSZip();

    const header = [
      'Nội dung câu hỏi', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D',
      'Đáp án đúng (A/B/C/D hoặc 1/2/3/4)', 'Điểm', 'image_file', 'Chủ đề',
      'Độ khó (easy/medium/hard hoặc Dễ/Trung bình/Khó)',
    ];
    const example1 = [
      'Máy nâng dùng để làm gì?', 'Nâng hàng', 'Lái xe', 'Đóng gói', 'Kiểm tra hàng',
      'A', '1', 'cau1.jpg', 'Kiến thức cơ bản', 'medium',
    ];
    const example2 = [
      'Tốc độ nâng tối đa là bao nhiêu?', '1 m/s', '2 m/s', '3 m/s', '4 m/s',
      'B', '2', '', 'An toàn', 'easy',
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, example1, example2]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cau_hoi');
    const xlsBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    zip.file('questions.xlsx', xlsBuffer);
    zip.folder('images');

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Mau_import_zip.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const excelColumns = ['Nội dung', 'A', 'B', 'C', 'D', 'Đáp án', 'Chủ đề', 'Độ khó', 'Điểm'] as const;
  const excelPreview = rows.slice(0, 20);

  const zipHasImages = zipRows.some((r) => r.imageBlob !== null);
  const zipRowsWithImageCount = zipRows.filter((r) => r.imageFile).length;
  const zipPreview = zipRows.slice(0, 20);

  return (
    <div>
      <p className="text-slate-500 text-sm">
        <Link to={`/admin/exams/${examId}/questions`} className="hover:underline">← Câu hỏi</Link>
        {' · '}
        <span className="font-medium text-slate-700">Import câu hỏi hàng loạt</span>
      </p>
      <h1 className="text-xl font-semibold text-slate-800 mt-2 mb-4">
        Nhập ngân hàng câu hỏi vào đề: {examTitle || '...'}
      </h1>

      {/* Tab selector */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('excel')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
            activeTab === 'excel'
              ? 'bg-white border-slate-200 text-indigo-700'
              : 'bg-slate-50 border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Excel / CSV
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('zip')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors ${
            activeTab === 'zip'
              ? 'bg-white border-slate-200 text-indigo-700'
              : 'bg-slate-50 border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          📦 Import từ ZIP (Excel + ảnh)
        </button>
      </div>

      {/* ── Tab: Excel / CSV ────────────────────────────────────────────── */}
      {activeTab === 'excel' && (
        <div className="space-y-4 max-w-2xl">
          <p className="text-slate-600">
            File Excel/CSV cần có các cột theo thứ tự:{' '}
            <strong>Nội dung câu hỏi, Đáp án A, B, C, D, Đáp án đúng (A/B/C/D hoặc 1/2/3/4), Chủ đề, Độ khó, Điểm</strong>.
            Cột 7–9 có thể để trống.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadExcelTemplate}
              className="text-indigo-700 hover:underline text-sm"
            >
              Tải file mẫu (Excel .xlsx)
            </button>
          </div>
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
          {auditIssues.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 text-amber-900 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Rà soát phát hiện {auditIssues.length} vấn đề:</p>
              <ul className="list-disc pl-5 space-y-1">
                {auditIssues.slice(0, 8).map((m, i) => <li key={i}>{m}</li>)}
              </ul>
              {auditIssues.length > 8 && (
                <p className="text-xs mt-2">… và {auditIssues.length - 8} vấn đề khác.</p>
              )}
            </div>
          )}
          {result && (
            <p className="text-green-700">
              Đã thêm <strong>{result.created}</strong> câu hỏi.
              {result.errors.length > 0 && (
                <span className="block text-amber-700 mt-1">
                  Một số dòng lỗi: {result.errors.slice(0, 3).join('; ')}
                </span>
              )}
            </p>
          )}

          {rows.length > 0 && (
            <>
              <p className="text-slate-600">Xem trước {excelPreview.length} / {rows.length} dòng:</p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      {excelColumns.map((c) => (
                        <th key={c} className="px-2 py-1 text-left border-b border-slate-200">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((r, i) => (
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
      )}

      {/* ── Tab: ZIP ────────────────────────────────────────────────────── */}
      {activeTab === 'zip' && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600 space-y-1">
            <p className="font-medium text-slate-700">Cấu trúc file .zip cần có:</p>
            <pre className="font-mono text-xs bg-white border border-slate-100 rounded p-2 leading-relaxed">
{`import.zip
├── questions.xlsx   ← cột "image_file" chứa tên file ảnh
└── images/
    ├── cau1.jpg
    └── cau2.png`}
            </pre>
            <p>Cột <code className="bg-slate-100 px-1 rounded">image_file</code> để trống nếu câu hỏi không có ảnh.</p>
          </div>

          <button
            type="button"
            onClick={handleDownloadZipTemplate}
            className="text-indigo-700 hover:underline text-sm"
          >
            Tải file mẫu ZIP (questions.xlsx + thư mục images/)
          </button>

          <div className="flex flex-wrap items-center gap-4">
            <input
              type="file"
              accept=".zip"
              onChange={handleZipFileChange}
              className="block"
            />
            <button
              type="button"
              onClick={handleZipParse}
              disabled={!zipFile || zipParsing}
              className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              {zipParsing ? 'Đang giải nén...' : 'Đọc ZIP & xem trước'}
            </button>
          </div>

          {zipError && <p className="text-red-600">{zipError}</p>}

          {zipWarnings.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 text-amber-900 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Cảnh báo ({zipWarnings.length}):</p>
              <ul className="list-disc pl-5 space-y-1">
                {zipWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {zipResult && (
            <div className={`rounded-lg p-3 text-sm ${zipResult.created > 0 ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
              <p className="font-medium">Đã nhập <strong>{zipResult.created}</strong> / {zipRows.length + zipResult.created} câu hỏi.</p>
              {zipResult.errors.length > 0 && (
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  {zipResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {zipResult.errors.length > 5 && <li>… và {zipResult.errors.length - 5} lỗi khác.</li>}
                </ul>
              )}
              {zipResult.uploadWarnings.length > 0 && (
                <div className="mt-2 text-amber-700">
                  <p className="font-medium">Upload ảnh:</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {zipResult.uploadWarnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Progress bar */}
          {zipImporting && zipProgress && zipProgress.total > 0 && (
            <div className="space-y-1">
              <p className="text-sm text-slate-600">
                Đang upload ảnh {zipProgress.current} / {zipProgress.total}…
              </p>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(zipProgress.current / zipProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          {zipImporting && (!zipProgress || zipProgress.total === 0) && (
            <p className="text-sm text-slate-600">Đang nhập câu hỏi vào database…</p>
          )}

          {zipRows.length > 0 && (
            <>
              <p className="text-slate-600">
                Xem trước {zipPreview.length} / {zipRows.length} câu
                {zipRowsWithImageCount > 0 && (
                  <span className="text-indigo-600 ml-1">
                    ({zipRowsWithImageCount} câu có ảnh
                    {zipHasImages ? ` — ${zipRows.filter((r) => r.imageBlob).length} ảnh đọc được` : ''})
                  </span>
                )}
                :
              </p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-2 py-1 text-left border-b border-slate-200">Nội dung</th>
                      <th className="px-2 py-1 text-left border-b border-slate-200">A</th>
                      <th className="px-2 py-1 text-left border-b border-slate-200">B</th>
                      <th className="px-2 py-1 text-left border-b border-slate-200">Đáp án</th>
                      <th className="px-2 py-1 text-left border-b border-slate-200">Điểm</th>
                      <th className="px-2 py-1 text-left border-b border-slate-200">Ảnh</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zipPreview.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-2 py-1 max-w-xs truncate" title={r.stem}>{r.stem}</td>
                        <td className="px-2 py-1 max-w-[100px] truncate">{r.optionA}</td>
                        <td className="px-2 py-1 max-w-[100px] truncate">{r.optionB}</td>
                        <td className="px-2 py-1">{r.answer}</td>
                        <td className="px-2 py-1">{r.points}</td>
                        <td className="px-2 py-1">
                          {r.imageFile ? (
                            r.imageBlob ? (
                              <span className="text-green-600 text-xs font-medium">✓ {r.imageFile}</span>
                            ) : (
                              <span className="text-amber-600 text-xs" title={r.imageWarning ?? ''}>
                                ⚠ {r.imageFile}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleZipImport}
                  disabled={zipImporting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {zipImporting
                    ? zipProgress && zipProgress.total > 0
                      ? `Uploading ảnh ${zipProgress.current}/${zipProgress.total}…`
                      : 'Đang nhập…'
                    : `Nhập ${zipRows.length} câu${zipHasImages ? ` + ${zipRows.filter((r) => r.imageBlob).length} ảnh` : ''} vào đề này`}
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
      )}
    </div>
  );
}
