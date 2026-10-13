import { answerLines, matchingRightOf, type QuestionReviewItem } from '../../domain/attempt-review';

export interface ResultPdfInput {
  examTitle: string;
  studentDisplay: string;
  studentDob: string | null;
  studentCccd: string | null;
  completedAtStr: string;
  durationStr: string;
  disqualified: boolean;
  earned: number;
  denom: number | null;
  passValue: number | null;
  passed: boolean;
  startPhotoUrl: string | null;
  reviewItems: QuestionReviewItem[] | null;
}

/** The page is built as an HTML string, so every value from the database is escaped. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linesHtml(lines: string[]): string {
  return lines.map((line) => esc(line).replace(/\n/g, '<br />')).join('<br />');
}

function questionHtml(it: QuestionReviewItem, idx: number): string {
  const chosenText = linesHtml(answerLines(it.options, it.chosen, it.question_type, matchingRightOf(it.answer_key)));
  const correctText = linesHtml(answerLines(it.options, it.answer_key, it.question_type));
  const wrong = Boolean(it.chosen) && !it.correct && !it.manual;
  const rowBg = it.correct ? '#f0fdf4' : wrong ? '#fff1f2' : '#f8fafc';
  const rowBorder = it.correct ? '#bbf7d0' : wrong ? '#fecdd3' : '#e2e8f0';
  const statusColor = it.correct ? '#15803d' : it.manual && it.chosen ? '#475569' : '#dc2626';
  const statusText = it.correct ? '✓ Đúng' : !it.chosen ? '— Chưa trả lời' : it.manual ? 'Tự luận: giáo viên chấm' : '✗ Sai';
  const chosenColor = it.correct ? '#15803d' : wrong ? '#dc2626' : it.chosen ? '#1e293b' : '#94a3b8';

  return `
      <div style="border:1px solid ${rowBorder};border-radius:8px;padding:14px;margin-bottom:10px;background:${rowBg};page-break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:11px;color:#64748b;font-weight:600;">Câu ${idx + 1}</span>
          <span style="font-size:11px;color:#64748b;">${it.points} điểm</span>
        </div>
        <p style="font-size:13px;color:#1e293b;margin:0 0 10px 0;line-height:1.5;white-space:pre-wrap;">${esc(it.stem)}</p>
        ${it.image_url ? `<img src="${esc(it.image_url)}" style="max-height:120px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;display:block;" />` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;">
          <div>
            <p style="font-size:10px;text-transform:uppercase;color:#94a3b8;margin:0 0 3px 0;">${it.manual ? 'Học viên trả lời' : 'Học viên đã chọn'}</p>
            <p style="color:${chosenColor};font-weight:600;margin:0;line-height:1.5;">${chosenText}</p>
          </div>
          <div>
            <p style="font-size:10px;text-transform:uppercase;color:#94a3b8;margin:0 0 3px 0;">${it.manual ? 'Các ý cần có' : 'Đáp án đúng'}</p>
            <p style="color:#15803d;font-weight:600;margin:0;line-height:1.5;">${correctText}</p>
          </div>
        </div>
        <p style="font-size:11px;font-weight:700;color:${statusColor};margin:8px 0 0 0;">${statusText}</p>
      </div>`;
}

function resultHtml(opts: ResultPdfInput): string {
  const {
    examTitle, studentDisplay, studentDob, studentCccd, completedAtStr, durationStr,
    disqualified, earned, denom, passValue, passed, startPhotoUrl, reviewItems,
  } = opts;

  const resultColor = passed ? '#065f46' : '#991b1b';
  const resultBg = passed ? '#ecfdf5' : '#fef2f2';
  const resultBorder = passed ? '#a7f3d0' : '#fecaca';
  const resultText = disqualified ? 'Bị loại' : passed ? 'Đạt' : 'Chưa đạt';
  const questionsHtml = (reviewItems ?? []).map(questionHtml).join('');

  const photoHtml = startPhotoUrl
    ? `<img src="${esc(startPhotoUrl)}" style="width:100px;height:128px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;" />`
    : '';

  const signatureHtml = `
    <div style="text-align:center;flex-shrink:0;">
      <p style="font-size:10px;color:#94a3b8;margin:0 0 4px 0;">Chữ ký học viên</p>
      <div style="width:110px;height:128px;border:1px dashed #cbd5e1;border-radius:8px;"></div>
    </div>`;

  return `
    <div style="font-family:Arial,sans-serif;color:#1e293b;padding:0 8px;">
      <img src="/print-header.png" style="width:100%;display:block;margin-bottom:20px;" />

      <h1 style="font-size:18px;font-weight:700;margin:0 0 4px 0;">Kết quả bài thi</h1>
      <p style="font-size:13px;color:#64748b;margin:0 0 16px 0;">${esc(examTitle)}</p>

      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:16px;background:#f8fafc;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1;">
            <p style="font-size:13px;margin:0 0 5px 0;"><strong style="display:inline-block;width:110px;color:#475569;">Học viên:</strong> ${esc(studentDisplay)}</p>
            ${studentDob ? `<p style="font-size:13px;margin:0 0 5px 0;"><strong style="display:inline-block;width:110px;color:#475569;">Ngày sinh:</strong> ${esc(studentDob)}</p>` : ''}
            ${studentCccd ? `<p style="font-size:13px;margin:0 0 5px 0;"><strong style="display:inline-block;width:110px;color:#475569;">CCCD:</strong> ${esc(studentCccd)}</p>` : ''}
            <p style="font-size:13px;margin:0 0 5px 0;"><strong style="display:inline-block;width:110px;color:#475569;">Nộp lúc:</strong> ${esc(completedAtStr)}</p>
            <p style="font-size:13px;margin:0;"><strong style="display:inline-block;width:110px;color:#475569;">Thời gian làm:</strong> ${esc(durationStr)}</p>
            ${disqualified ? '<p style="color:#b45309;font-weight:700;margin:8px 0 0 0;">⚠ Bài bị hủy</p>' : ''}
          </div>
          <div style="display:flex;gap:12px;flex-shrink:0;">
            ${photoHtml ? `<div style="text-align:center;"><p style="font-size:10px;color:#94a3b8;margin:0 0 4px 0;">Ảnh lúc vào thi</p>${photoHtml}</div>` : ''}
            ${signatureHtml}
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;background:#f8fafc;">
          <p style="font-size:10px;color:#94a3b8;margin:0 0 4px 0;">ĐIỂM</p>
          <p style="font-size:22px;font-weight:700;margin:0 0 4px 0;">${Math.round(earned * 10) / 10}<span style="font-size:14px;font-weight:400;color:#94a3b8;"> / ${denom ?? '—'}</span></p>
          <p style="font-size:11px;color:#94a3b8;margin:0;">Ngưỡng đạt: ${passValue != null ? Math.round(passValue * 10) / 10 : '—'} / ${denom ?? '—'}</p>
        </div>
        <div style="border:1px solid ${resultBorder};border-radius:8px;padding:14px;background:${resultBg};">
          <p style="font-size:10px;color:#94a3b8;margin:0 0 4px 0;">KẾT QUẢ</p>
          <p style="font-size:22px;font-weight:700;color:${resultColor};margin:0;">${resultText}</p>
        </div>
      </div>

      ${reviewItems && reviewItems.length > 0 ? `
        <h2 style="font-size:14px;font-weight:700;margin:0 0 4px 0;">Chi tiết từng câu</h2>
        <p style="font-size:11px;color:#94a3b8;margin:0 0 12px 0;">Câu trả lời của học viên so với đáp án. Câu tự luận do giáo viên chấm theo các ý trong đáp án.</p>
        ${questionsHtml}
      ` : ''}
    </div>`;
}

/**
 * Saves the result as an A4 PDF with the center header, start photo and a box for the student's signature.
 * The page is handed to html2pdf as a detached element: it lays the copy out itself, so nothing is added to the
 * screen.
 */
export async function downloadResultPdf(opts: ResultPdfInput): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  const el = document.createElement('div');
  el.innerHTML = resultHtml(opts);
  try {
    await html2pdf()
      .set({
        margin: [8, 8, 12, 8],
        filename: `ket-qua-${opts.examTitle.replace(/\s+/g, '-')}-${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          // html2canvas cannot read the oklch() colours of the app's Tailwind stylesheet and stops on the first one.
          // The printed page is styled inline, so its copy of the document is drawn without any stylesheet.
          onclone: (copy: Document) => {
            copy.querySelectorAll('style, link[rel="stylesheet"]').forEach((sheet) => sheet.remove());
          },
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(el)
      .save();
  } finally {
    // On a failure html2pdf leaves its invisible full-screen layer in place, and that layer takes every click.
    document.querySelectorAll('.html2pdf__overlay').forEach((overlay) => overlay.remove());
  }
}
