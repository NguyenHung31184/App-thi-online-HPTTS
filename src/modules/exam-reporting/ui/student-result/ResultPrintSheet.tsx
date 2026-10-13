import { SIGNATURE_STATEMENT } from '../../domain/signature';

export interface ResultPrintSheetProps {
  examTitle: string;
  isTrial: boolean;
  fullName: string;
  dob: string;
  cccd: string;
  completedAt: string;
  duration: string;
  /** Points earned, the maximum and the pass mark; null when the paper has no known maximum. */
  earned: number;
  max: number | null;
  passMark: number | null;
  passed: boolean;
  disqualified: boolean;
  startPhotoUrl: string | null;
  signatureUrl: string | null;
  attemptCode: string;
  printedAt: string;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-brand-200 py-[5pt] last:border-b-0">
      <dt className="w-[3.4cm] shrink-0 text-[9.5pt] text-slate-600">{label}</dt>
      <dd className="text-[11.5pt] font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-2 border-l-[4px] border-brand-500 pl-2 text-[10pt] font-bold uppercase tracking-wide text-brand-700">
      {children}
    </h2>
  );
}

/**
 * The student's result as a printed A4 sheet: shown only on paper, in place of the screen layout. Brand rules are
 * in DESIGN.md section 1 of the management app: original logo on white beside the company name in capitals, blue
 * for text and rules, cyan for decoration only, the official contact line at the foot. Every colour that carries
 * meaning is text or a border, so the sheet still reads when a phone prints without backgrounds.
 */
export function ResultPrintSheet(props: ResultPrintSheetProps) {
  const good = props.passed && !props.disqualified;
  const outcome = props.disqualified ? 'Bài bị hủy' : props.passed ? 'Đạt' : 'Chưa đạt';
  const tone = good ? 'border-green-700 text-green-700' : 'border-red-700 text-red-700';
  const share = (value: number | null) =>
    props.max && value != null ? `${Math.min(100, Math.max(0, (value / props.max) * 100))}%` : null;
  const earnedShare = share(props.earned);
  const passShare = share(props.passMark);

  return (
    <div className="hidden min-h-[25cm] flex-col text-[11pt] leading-snug text-slate-900 print:flex [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img src="/brand/hptts-logo.png" alt="HPTTS" className="h-[2cm] w-auto shrink-0" />
          <p className="text-[11.5pt] font-bold uppercase leading-tight text-brand-500">
            Công ty Cổ phần
            <br />
            Dịch vụ Kỹ thuật và Đào tạo Cảng Hải Phòng
          </p>
        </div>
        <p className="shrink-0 text-right text-[8.5pt] leading-relaxed text-slate-600">
          Mã lượt thi
          <br />
          <span className="text-[10pt] font-semibold tracking-wider text-slate-900">{props.attemptCode}</span>
        </p>
      </header>

      <div className="mt-3 border-y-[3px] border-brand-500 bg-brand-50 px-4 py-3 text-center">
        <h1 className="text-[19pt] font-bold uppercase tracking-[0.08em] text-brand-500">Phiếu kết quả bài thi</h1>
        <p className="mt-0.5 text-[12pt] font-semibold text-brand-900">{props.examTitle}</p>
        {props.isTrial && <p className="mt-0.5 text-[9pt] font-semibold text-brand-900">Kỳ thi thử, điểm không ghi vào hồ sơ đào tạo</p>}
      </div>

      <section className="mt-5 break-inside-avoid">
        <SectionTitle>Thông tin học viên</SectionTitle>
        <div className="flex items-stretch gap-5 rounded-lg border border-brand-200 p-4">
          {props.startPhotoUrl && (
            <img
              src={props.startPhotoUrl}
              alt="Ảnh khuôn mặt lúc vào thi"
              className="h-[4.4cm] w-[3.3cm] shrink-0 rounded-md border-2 border-brand-500 object-cover"
            />
          )}
          <dl className="flex flex-1 flex-col justify-center">
            <Fact label="Họ và tên" value={props.fullName} />
            <Fact label="Ngày sinh" value={props.dob} />
            <Fact label="Số CCCD" value={props.cccd} />
            <Fact label="Nộp bài lúc" value={props.completedAt} />
            <Fact label="Thời gian làm bài" value={props.duration} />
          </dl>
        </div>
      </section>

      <section className="mt-5 break-inside-avoid">
        <SectionTitle>Kết quả</SectionTitle>
        <div className="flex items-center gap-5 rounded-lg border-2 border-brand-500 p-4">
          <div className="flex-1">
            <p className="flex items-baseline gap-2">
              <span className="text-[34pt] font-bold leading-none text-brand-700">{round(props.earned)}</span>
              <span className="text-[14pt] font-semibold text-slate-600">/ {props.max ?? '—'} điểm</span>
            </p>
            {earnedShare && (
              <div className="relative mt-3 h-[10pt] rounded-full border border-brand-500 bg-white">
                <div className="h-full rounded-full bg-brand-500" style={{ width: earnedShare }} />
                {passShare && <div className="absolute -top-[4pt] h-[18pt] w-[2pt] bg-brand-900" style={{ left: passShare }} />}
              </div>
            )}
            <p className="mt-2 text-[9.5pt] text-slate-700">
              Ngưỡng đạt: <strong>{props.passMark != null ? round(props.passMark) : '—'}</strong> / {props.max ?? '—'} điểm
              {passShare && ' (vạch đậm trên thanh)'}
            </p>
          </div>
          <p className={`shrink-0 rounded-lg border-[3px] border-double px-5 py-3 text-center text-[20pt] font-bold uppercase leading-none ${tone}`}>
            {outcome}
          </p>
        </div>
      </section>

      <section className="mt-6 flex items-start justify-between gap-6 break-inside-avoid">
        <p className="max-w-[8cm] pt-1 text-[9pt] leading-relaxed text-slate-600">
          Phiếu được tạo từ hệ thống thi trực tuyến của HPTTS.
          <br />
          In lúc {props.printedAt}.
        </p>
        <div className="w-[7cm] text-center">
          <p className="text-[11pt] font-bold text-slate-900">Học viên ký xác nhận</p>
          <p className="mt-0.5 text-[8.5pt] italic text-slate-600">{SIGNATURE_STATEMENT}</p>
          {props.signatureUrl ? (
            <img src={props.signatureUrl} alt="Chữ ký của học viên" className="mx-auto mt-1 h-[2.6cm] w-auto object-contain" />
          ) : (
            <div className="mt-1 h-[2.6cm]" />
          )}
          <p className="text-[11pt] font-semibold">{props.fullName}</p>
        </div>
      </section>

      <footer className="mt-auto pt-6">
        <div className="border-t-[3px] border-brand-500 pt-2 text-center text-[8.5pt] leading-relaxed text-slate-700">
          <p className="font-semibold text-brand-700">Công ty Cổ phần Dịch vụ Kỹ thuật và Đào tạo Cảng Hải Phòng</p>
          <p>Số 5 đường Cù Chính Lan, P. Hồng Bàng, TP. Hải Phòng</p>
          <p>Điện thoại: 0824.588 558 · Email: dvkt@hptts.com.vn · Website: www.hptts.com.vn</p>
        </div>
      </footer>
    </div>
  );
}
