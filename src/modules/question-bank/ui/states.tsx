import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { focusRing } from './labels';

export function LoadingState({ children }: { children: ReactNode }) {
  return <p role="status" className="py-6 text-sm text-slate-600">{children}</p>;
}

export function ErrorState({ title, detail, action, onRetry }: { title: string; detail?: string; action?: ReactNode; onRetry?: () => void }) {
  return (
    <section role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5">
      <h2 className="font-semibold text-rose-900">{title}</h2>
      {detail && <p className="mt-1 text-sm text-rose-800">{detail}</p>}
      {(action || onRetry) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {onRetry && (
            <button type="button" onClick={onRetry} className={`inline-flex min-h-11 items-center rounded-lg bg-rose-800 px-3 text-sm font-semibold text-white hover:bg-rose-900 ${focusRing}`}>
              Tải lại
            </button>
          )}
          {action}
        </div>
      )}
    </section>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <h2 className="font-semibold text-slate-800">{title}</h2>
      {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
    </section>
  );
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={`inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 ${focusRing}`}>
      {children}
    </Link>
  );
}
