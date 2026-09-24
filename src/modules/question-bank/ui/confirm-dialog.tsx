import { useEffect, useId, useRef, type ReactNode } from 'react';
import { focusRing } from './labels';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A native modal dialog: the browser traps focus, closes on Escape and returns focus to the opener. */
export function ConfirmDialog({ open, title, children, confirmLabel, tone = 'primary', pending = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const confirmClass = tone === 'danger' ? 'bg-rose-700 hover:bg-rose-800' : 'bg-indigo-700 hover:bg-indigo-800';
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/50"
    >
      {open && (
        <>
          <div className="p-5">
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            <div className="mt-2 space-y-2 text-sm text-slate-700">{children}</div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            {/* showModal() focuses the first control, so focus starts on the safe choice. */}
            <button type="button" onClick={onCancel} disabled={pending} className={`min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${focusRing}`}>
              Hủy
            </button>
            <button type="button" onClick={onConfirm} disabled={pending} className={`min-h-11 rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60 ${confirmClass} ${focusRing}`}>
              {pending ? 'Đang xử lý…' : confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
