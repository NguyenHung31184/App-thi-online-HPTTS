import type { ProctoringCameraStatus } from '../../domain/proctoring-evidence';

export function CameraRecoveryNotice({ status, restart }: { status: ProctoringCameraStatus; restart: () => void }) {
  if (status === 'ready' || status === 'stopped') return null;
  return (
    <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="status">
      {status === 'starting'
        ? 'Đang kết nối camera giám sát…'
        : 'Camera giám sát bị gián đoạn. Kiểm tra quyền camera rồi kết nối lại.'}
      {status !== 'starting' && (
        <button type="button" onClick={restart} className="mt-2 block min-h-11 rounded-lg bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
          Kết nối lại camera
        </button>
      )}
    </div>
  );
}
