import { SIGNATURE_STATEMENT } from '../../domain/signature';

export interface ResultPrintSheetProps {
  examTitle: string;
  isTrial: boolean;
  fullName: string;
  dob: string;
  cccd: string;
  completedAt: string;
  duration: string;
  score: string;
  passMark: string;
  passed: boolean;
  disqualified: boolean;
  startPhotoUrl: string | null;
  signatureUrl: string | null;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-slate-200 py-1.5">
      <dt className="w-36 shrink-0 text-slate-600">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

/**
 * The student's result as a printed sheet: shown only on paper, in place of the screen layout. Brand rules are in
 * DESIGN.md section 1 of the management app: original logo on white beside the company name in capitals, blue for
 * text and rules, cyan for decoration only, the official contact line at the foot.
 */
export function ResultPrintSheet(props: ResultPrintSheetProps) {
  const outcome = props.disqualified ? 'Bài bị hủy' : props.passed ? 'Đạt' : 'Chưa đạt';
  const outcomeColor = props.passed && !props.disqualified ? 'text-green-700 border-green-700' : 'text-red-700 border-red-700';

  return (
    <div className="hidden print:block text-[11pt] leading-snug text-slate-900 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
      <header className="flex items-center gap-4 border-b-[3px] border-brand-500 pb-3">
        <img src="/brand/hptts-logo.png" alt="HPTTS" className="h-[1.9cm] w-auto shrink-0" />
        <p className="text-[12pt] font-bold uppercase leading-tight text-brand-500">
          Công ty Cổ phần
          <br />
          Dịch vụ Kỹ thuật và Đào tạo Cảng Hải Phòng
        </p>
      </header>

      <div className="mt-6 text-center">
        <h1 className="text-[18pt] font-bold uppercase tracking-wide text-brand-500">Phiếu kết quả bài thi</h1>
        <p className="mt-1 text-[12pt] font-semibold text-slate-900">{props.examTitle}</p>
        {props.isTrial && (
          <p className="mt-2 inline-block rounded-full border border-brand-900 bg-brand-cyan-100 px-3 py-0.5 text-[9pt] font-semibold text-brand-900">
            Kỳ thi thử, điểm không ghi vào hồ sơ đào tạo
          </p>
        )}
      </div>

      <section className="mt-6 flex items-start gap-6">
        <dl className="flex-1">
          <Fact label="Họ và tên" value={props.fullName} />
          <Fact label="Ngày sinh" value={props.dob} />
          <Fact label="Số CCCD" value={props.cccd} />
          <Fact label="Nộp bài lúc" value={props.completedAt} />
          <Fact label="Thời gian làm bài" value={props.duration} />
        </dl>
        {props.startPhotoUrl && (
          <figure className="shrink-0 text-center">
            <img
              src={props.startPhotoUrl}
              alt="Ảnh khuôn mặt lúc vào thi"
              className="h-[4cm] w-[3cm] rounded border-2 border-brand-500 object-cover"
            />
            <figcaption className="mt-1 text-[8pt] text-slate-600">Ảnh lúc vào thi</figcaption>
          </figure>
        )}
      </section>

      <section className="mt-6 grid grid-cols-3 overflow-hidden rounded-lg border-2 border-brand-500 break-inside-avoid">
        <div className="bg-brand-50 p-4">
          <p className="text-[9pt] font-semibold uppercase text-brand-700">Điểm</p>
          <p className="mt-1 text-[24pt] font-bold leading-none text-brand-700">{props.score}</p>
        </div>
        <div className="border-l-2 border-brand-500 p-4">
          <p className="text-[9pt] font-semibold uppercase text-brand-700">Ngưỡng đạt</p>
          <p className="mt-1 text-[16pt] font-bold leading-none text-slate-900">{props.passMark}</p>
        </div>
        <div className="border-l-2 border-brand-500 p-4">
          <p className="text-[9pt] font-semibold uppercase text-brand-700">Kết quả</p>
          <p className={`mt-1 inline-block rounded border-2 px-2 py-0.5 text-[15pt] font-bold leading-tight ${outcomeColor}`}>
            {outcome}
          </p>
        </div>
      </section>

      <section className="mt-8 flex justify-end break-inside-avoid">
        <div className="w-[7cm] text-center">
          <p className="font-semibold text-slate-900">Học viên ký xác nhận</p>
          <p className="mt-0.5 text-[8.5pt] italic text-slate-600">{SIGNATURE_STATEMENT}</p>
          {props.signatureUrl ? (
            <img src={props.signatureUrl} alt="Chữ ký của học viên" className="mx-auto mt-2 h-[2.8cm] w-auto object-contain" />
          ) : (
            <div className="mt-2 h-[2.8cm]" />
          )}
          <p className="mt-1 border-t border-slate-400 pt-1 font-semibold">{props.fullName}</p>
        </div>
      </section>

      <footer className="mt-10 border-t-[3px] border-brand-500 pt-2 text-center text-[8.5pt] text-slate-700">
        <p>Số 5 đường Cù Chính Lan, P. Hồng Bàng, TP. Hải Phòng</p>
        <p>Điện thoại: 0824.588 558 · Email: dvkt@hptts.com.vn · Website: www.hptts.com.vn</p>
      </footer>
    </div>
  );
}
