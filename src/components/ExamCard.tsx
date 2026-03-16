import type { ReactNode } from 'react';

interface ExamCardProps {
  title: string;
  subtitle?: string;
  meta?: string;
  footerLeft?: ReactNode;
  footerRight?: ReactNode;
  onClick?: () => void;
  actions?: ReactNode;
}

export function ExamCard({
  title,
  subtitle,
  meta,
  footerLeft,
  footerRight,
  onClick,
  actions,
}: ExamCardProps) {
  return (
    <div
      className="group rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-all cursor-pointer overflow-hidden flex flex-col"
      onClick={onClick}
    >
      <div className="h-24 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,_#ffffff_0,_transparent_55%)]" />
      </div>
      <div className="flex-1 px-4 pt-3 pb-3">
        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-slate-500 line-clamp-1">{subtitle}</p>}
        {meta && <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{meta}</p>}
      </div>
      <div className="px-4 pb-3 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-1">{footerLeft}</div>
        <div className="flex items-center gap-2">
          {footerRight}
          {actions}
        </div>
      </div>
    </div>
  );
}

