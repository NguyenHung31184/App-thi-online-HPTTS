import type { QuestionReviewItem } from '../../domain/attempt-review';

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

function questionHtml(it: QuestionReviewItem, idx: number): string {
  const chosenText = it.chosen ? (it.options.find((o) => o.id === it.chosen)?.text ?? it.chosen) : '— (chưa chọn)';
  const correctText = it.options.find((o) => o.id === it.answer_key)?.text ?? it.answer_key;
  const rowBg = it.correct ? '#f0fdf4' : it.chosen ? '#fff1f2' : '#f8fafc';
  const rowBorder = it.correct ? '#bbf7d0' : it.chosen ? '#fecdd3' : '#e2e8f0';
  const statusColor = it.correct ? '#15803d' : '#dc2626';
  const statusText = it.correct ? '✓ Đúng' : it.chosen ? '✗ Sai' : '— Chưa trả lời';
  const chosenColor = it.correct ? '#15803d' : it.chosen ? '#dc2626' : '#94a3b8';

  return `
      <div style="border:1px solid ${rowBorder};border-radius:8px;padding:14px;margin-bottom:10px;background:${rowBg};page-break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:11px;color:#64748b;font-weight:600;">Câu ${idx + 1}</span>
          <span style="font-size:11px;color:#64748b;">${it.points} điểm</span>
        </div>
        <p style="font-size:13px;color:#1e293b;margin:0 0 10px 0;line-height:1.5;">${it.stem}</p>
        ${it.image_url ? `<img src="${it.image_url}" style="max-height:120px;border-radius:6px;border:1px solid #e2e8f0;margin-bottom:10px;display:block;" />` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;">
          <div>
            <p style="font-size:10px;text-transform:uppercase;color:#94a3b8;margin:0 0 3px 0;">Học viên đã chọn</p>
            <p style="color:${chosenColor};font-weight:600;margin:0;">${chosenText}</p>
          </div>
          <div>
            <p style="font-size:10px;text-transform:uppercase;color:#94a3b8;margin:0 0 3px 0;">Đáp án đúng</p>
            <p style="color:#15803d;font-weight:600;margin:0;">${correctText}</p>
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
    ? `<img src="${startPhotoUrl}" style="width:100px;height:128px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;" />`
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
      <p style="font-size:13px;color:#64748b;margin:0 0 16px 0;">${examTitle}</p>

      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:16px;background:#f8fafc;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1;">
            <p style="font-size:13px;margin:0 0 5px 0;"><strong style="display:inline-block;width:110px;color:#475569;">Học viên:</strong> ${studentDisplay}</p>
            ${studentDob ? `<p style="font-size:13px;margin:0 0 5px 0;"><strong style="display:inline-block;width:110px;color:#475569;">Ngày sinh:</strong> ${studentDob}</p>` : ''}
            ${studentCccd ? `<p style="font-size:13px;margin:0 0 5px 0;"><strong style="display:inline-block;width:110px;color:#475569;">CCCD:</strong> ${studentCccd}</p>` : ''}
            <p style="font-size:13px;margin:0 0 5px 0;"><strong style="display:inline-block;width:110px;color:#475569;">Nộp lúc:</strong> ${completedAtStr}</p>
            <p style="font-size:13px;margin:0;"><strong style="display:inline-block;width:110px;color:#475569;">Thời gian làm:</strong> ${durationStr}</p>
            ${disqualified ? '<p style="color:#b45309;font-weight:700;margin:8px 0 0 0;">⚠ Bài bị loại (disqualified)</p>' : ''}
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
        <p style="font-size:11px;color:#94a3b8;margin:0 0 12px 0;">Đáp án học viên đã chọn so với đáp án đúng.</p>
        ${questionsHtml}
      ` : ''}
    </div>`;
}

/** Prints the result as an A4 PDF with the center header, start photo and a box for the student's signature. */
export async function downloadResultPdf(opts: ResultPdfInput): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;
  const el = document.createElement('div');
  el.innerHTML = resultHtml(opts);
  document.body.appendChild(el);
  await html2pdf()
    .set({
      margin: [8, 8, 12, 8],
      filename: `ket-qua-${opts.examTitle.replace(/\s+/g, '-')}-${Date.now()}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    })
    .from(el)
    .save();
  document.body.removeChild(el);
}
