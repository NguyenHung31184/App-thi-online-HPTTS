import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const tones = {
  default: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
  blue: 'text-sky-600 hover:text-sky-800 hover:bg-sky-50',
  indigo: 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50',
  red: 'text-red-500 hover:text-red-700 hover:bg-red-50',
} as const;

interface IconActionProps {
  to?: string;
  onClick?: () => void;
  title: string;
  tone?: keyof typeof tones;
  children: ReactNode;
}

/** The icon button of the exam cards: a link when `to` is given, otherwise a button. */
export default function IconAction({ to, onClick, title, tone = 'default', children }: IconActionProps) {
  const cls = `w-7 h-7 inline-flex items-center justify-center rounded-lg transition-colors ${tones[tone]}`;
  if (to) return <Link to={to} title={title} aria-label={title} className={cls}>{children}</Link>;
  return <button type="button" onClick={onClick} title={title} aria-label={title} className={cls}>{children}</button>;
}
