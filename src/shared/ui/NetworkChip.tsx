import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Header chip from the browser's online/offline state; shown on every width only when offline. */
export function NetworkChip() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  return (
    <span
      role="status"
      className={`items-center min-h-9 px-3 rounded-full border text-xs font-semibold ${online ? 'hidden sm:inline-flex border-slate-200 bg-white text-slate-700' : 'inline-flex border-red-300 bg-red-50 text-red-800'}`}
    >
      {online ? 'Mạng: đang kết nối' : 'Mất mạng'}
    </span>
  );
}
