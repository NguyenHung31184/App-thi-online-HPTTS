import { useCallback, useState } from 'react';

/** Runs a file export once at a time, with a busy flag for the button and a message when it fails. */
export function useFileExport() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (build: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await build();
    } catch (reason) {
      setError(`Không tạo được file Excel${reason instanceof Error && reason.message ? `: ${reason.message}` : ''}. Bấm xuất lại.`);
    } finally {
      setBusy(false);
    }
  }, []);
  return { run, busy, error };
}
