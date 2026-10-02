export function ResponseModal({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/50">
      <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <div className="font-semibold text-slate-800">{title}</div>
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-full border border-slate-200 hover:bg-slate-50">
            Đóng
          </button>
        </div>
        <div className="p-4">
          <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-auto max-h-[60vh] whitespace-pre-wrap break-words text-slate-800">
{content}
          </pre>
        </div>
      </div>
    </div>
  );
}
