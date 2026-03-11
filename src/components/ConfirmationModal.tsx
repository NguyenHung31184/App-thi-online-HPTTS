import type { ReactNode } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

/**
 * Modal xác nhận giống app quản lý TTDT: overlay tối, thẻ trắng, icon, tiêu đề, nội dung, Hủy + Xác nhận.
 * Dùng cho admin và học viên khi cần xác nhận trước khi xóa / thực hiện thao tác quan trọng.
 */
export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  isLoading?: boolean;
  confirmText?: string;
  confirmColor?: 'primary' | 'danger';
}

const buttonSecondary =
  'px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors disabled:opacity-50';

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  isLoading = false,
  confirmText = 'Xác nhận',
  confirmColor = 'danger',
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const buttonColorClass =
    confirmColor === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700';
  const iconBgClass = confirmColor === 'danger' ? 'bg-red-100' : 'bg-indigo-100';
  const iconColorClass = confirmColor === 'danger' ? 'text-red-600' : 'text-indigo-600';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full">
        <div className="p-6 text-center">
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${iconBgClass} mb-4`}
          >
            <Trash2 className={`h-6 w-6 ${iconColorClass}`} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm text-slate-500">{children}</p>
        </div>
        <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-center rounded-b-xl">
          <button type="button" onClick={onClose} disabled={isLoading} className={buttonSecondary}>
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50 ${buttonColorClass}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
