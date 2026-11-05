import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../platform/supabase/client';
import { APP_LABELS, fetchAppTargets, openApp } from '../../platform/auth/app-handoff';

/**
 * Header buttons to the other HPTTS apps this account may open (granted in the management app's permission tab).
 * Nothing shows while loading, on error, or when the account has no other app.
 */
export function AppSwitcher({ userId }: { userId: string | undefined }) {
  const [error, setError] = useState('');
  const targets = useQuery({
    queryKey: ['app-handoff', 'targets', userId ?? 'none'],
    queryFn: () => fetchAppTargets(supabase, 'thi'),
    enabled: Boolean(userId),
    staleTime: 10 * 60_000,
    retry: false,
  });
  if (!targets.data?.length) return null;
  return (
    <>
      {targets.data.map((target) => (
        <button
          key={target}
          type="button"
          onClick={() => {
            setError('');
            openApp(supabase, target).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Không mở được app.'));
          }}
          title={error || `Mở ${APP_LABELS[target]}, không cần đăng nhập lại`}
          className="hidden sm:inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {APP_LABELS[target].split(' (')[0]}
        </button>
      ))}
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </>
  );
}
