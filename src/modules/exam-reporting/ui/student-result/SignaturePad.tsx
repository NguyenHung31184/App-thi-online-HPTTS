import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { MIN_SIGNATURE_LENGTH, SIGNATURE_STATEMENT } from '../../domain/signature';

const WIDTH = 600;
const HEIGHT = 260;

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Không tạo được ảnh chữ ký.'))), 'image/png');
  });
}

/** A box to sign in with a finger, pen or mouse. `onSave` receives the signature as a PNG on white. */
export function SignaturePad({ onSave }: { onSave: (image: Blob) => Promise<void> }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [length, setLength] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    lastPoint.current = null;
    setLength(0);
    setError('');
  };

  useEffect(clear, []);

  // The canvas keeps a fixed drawing size; the pointer position is scaled from its size on screen.
  const pointOf = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * canvas.width,
      y: ((event.clientY - box.top) / box.height) * canvas.height,
    };
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (saving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    lastPoint.current = pointOf(event);
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const from = lastPoint.current;
    const ctx = event.currentTarget.getContext('2d');
    if (!from || !ctx) return;
    const to = pointOf(event);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    lastPoint.current = to;
    setLength((value) => value + Math.hypot(to.x - from.x, to.y - from.y));
  };

  const end = () => {
    lastPoint.current = null;
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    setError('');
    try {
      await onSave(await toBlob(canvas));
    } catch (cause) {
      setError(
        `Chưa lưu được chữ ký: ${cause instanceof Error ? cause.message : 'lỗi không rõ'}. Chữ ký vẫn còn trong ô, bấm "Xác nhận chữ ký" để thử lại.`,
      );
    } finally {
      setSaving(false);
    }
  };

  const signed = length >= MIN_SIGNATURE_LENGTH;

  return (
    <section aria-labelledby="signature-title" className="mt-6 rounded-lg border border-slate-300 bg-slate-50 p-4">
      <h2 id="signature-title" className="text-base font-semibold text-slate-900">
        Ký xác nhận kết quả
      </h2>
      <p className="mt-1 text-sm text-slate-700">{SIGNATURE_STATEMENT}</p>
      <p className="mt-1 text-sm text-slate-600">Dùng ngón tay ký vào ô bên dưới.</p>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label="Ô ký tên"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="mt-3 block w-full touch-none rounded-lg border-2 border-dashed border-slate-400 bg-white"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      />
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!signed || saving}
          className="min-h-11 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          {saving ? 'Đang lưu chữ ký…' : 'Xác nhận chữ ký'}
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={length === 0 || saving}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
        >
          Ký lại
        </button>
      </div>
      {!signed && length > 0 && <p className="mt-2 text-sm text-slate-600">Nét ký còn quá ngắn, hãy ký đầy đủ.</p>}
    </section>
  );
}
