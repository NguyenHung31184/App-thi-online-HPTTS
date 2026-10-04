import { Link, useParams } from 'react-router-dom';
import { clock } from '../../domain/results';
import { useAttemptResult } from '../../queries/use-practical-exams';
import { StateBadge } from './StateBadge';

const box = 'bg-white rounded-lg border border-slate-200 p-4';

/** What the examiner recorded for one student: scores with deductions, cycles, protective equipment, photos. Read only. */
export default function ResultDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const query = useAttemptResult(attemptId);
  const result = query.data;

  if (query.isLoading) return <p className="text-slate-500">Đang tải...</p>;
  if (query.error) return <p className="text-red-600">Không tải được kết quả.</p>;
  if (!result) return <p className="text-slate-600">Không tìm thấy bài chấm này.</p>;

  const { row } = result;
  const locked = row.state === 'graded' || row.state === 'disqualified';
  return (
    <div className="space-y-4 max-w-4xl">
      <Link to={`/admin/practical-grading?session=${result.sessionId}`} className="text-sm text-slate-600 hover:text-slate-900">← Kết quả kỳ thi</Link>

      <section className={box}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{row.name}</h1>
            <p className="text-sm text-slate-600">{result.className} · {result.templateTitle}</p>
          </div>
          <StateBadge state={row.state} />
        </div>
        <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <dt className="text-slate-600">{row.state === 'grading' ? 'Điểm tạm tính' : 'Điểm'}</dt>
            <dd className="text-2xl font-semibold text-slate-900 tabular-nums">{row.total == null ? '—' : `${row.total}/100`}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Gửi TTDT</dt>
            <dd className="text-2xl font-semibold text-slate-900 tabular-nums">{row.outOf10 == null ? '—' : `${row.outOf10.toLocaleString('vi-VN')}/10`}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Kết quả (đạt từ {result.passScore})</dt>
            <dd className={`text-lg font-semibold ${row.passed == null ? 'text-slate-500' : row.passed ? 'text-emerald-700' : 'text-red-700'}`}>
              {row.passed == null ? '—' : row.passed ? 'Đạt' : 'Không đạt'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-600">TTDT</dt>
            <dd className="text-lg font-semibold text-slate-900">{!locked ? '—' : row.synced ? 'Đã gửi' : 'Chờ gửi'}</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-slate-600">
          {result.examiner ? `Giám khảo: ${result.examiner}` : 'Chưa có giám khảo khóa kết quả'}
          {row.gradedAt && ` · khóa lúc ${new Date(row.gradedAt).toLocaleString('vi-VN')}`}
        </p>
        {result.disqualifyReason && (
          <p className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800"><b>Loại thi:</b> {result.disqualifyReason}</p>
        )}
        {result.missingPpe.length > 0 && (
          <p className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900"><b>Thiếu bảo hộ:</b> {result.missingPpe.join(', ')}</p>
        )}
      </section>

      {row.state !== 'not_eligible' && (
        <section className={box}>
          <h2 className="font-semibold text-slate-800 mb-2">Điểm từng tiêu chí</h2>
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs font-medium text-slate-600 border-b border-slate-200">
              <tr><th className="py-2 pr-3 w-10">#</th><th className="py-2 pr-3">Tiêu chí</th><th className="py-2 pr-3">Lỗi đã trừ</th><th className="py-2 text-right">Điểm</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.criteria.map((c, i) => (
                <tr key={c.id} className="align-top">
                  <td className="py-2 pr-3 text-slate-500">C{i + 1}</td>
                  <td className="py-2 pr-3 text-slate-900">{c.name}</td>
                  <td className="py-2 pr-3 text-slate-700">
                    {c.isTime ? 'Tính theo khung thời gian' : c.deductions.length === 0 ? <span className="text-slate-400">Không trừ</span> : (
                      <ul className="space-y-0.5">{c.deductions.map((d, j) => <li key={j} className="text-red-700">{d.label} −{d.points}</li>)}</ul>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums font-medium">{c.score == null ? '—' : c.score}/{c.maxScore}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm text-slate-700">
            Thời gian chu kỳ: {result.cycleSeconds.length ? result.cycleSeconds.map(clock).join(', ') : 'chưa bấm giờ'}
          </p>
        </section>
      )}

      <section className={box}>
        <h2 className="font-semibold text-slate-800 mb-2">Ảnh minh chứng ({result.photos.length})</h2>
        {result.photos.length === 0 ? <p className="text-sm text-slate-600">Chưa có ảnh.</p> : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {result.photos.map((p) => (
              <li key={p.id}>
                {p.url
                  ? <a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.label || 'Ảnh minh chứng'} loading="lazy" className="w-full aspect-[4/3] object-cover rounded-lg border border-slate-200" /></a>
                  : <div className="w-full aspect-[4/3] rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">Không mở được ảnh</div>}
                <p className="mt-1 text-xs text-slate-600">{p.label || 'Không có chú thích'}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
