import { useState } from 'react';
import { safariUrl, type InAppBrowser } from '../../platform/browser/in-app-browser';

interface InAppBrowserNoticeProps {
  browser: InAppBrowser;
  /** `block`: the page cannot go on here. `banner`: a one-line warning with the same way out. */
  variant: 'block' | 'banner';
  onBack?: () => void;
}

/** Tells a student who opened the page inside another app (Zalo, Facebook) how to reopen it in Safari. */
export function InAppBrowserNotice({ browser, variant, onBack }: InAppBrowserNoticeProps) {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const href = window.location.href;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
  };

  const actions = (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <a
        href={safariUrl(href)}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Mở bằng Safari
      </a>
      <button
        type="button"
        onClick={() => { void copy(); }}
        className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
      >
        {copied === 'yes' ? 'Đã chép địa chỉ' : 'Chép địa chỉ trang'}
      </button>
      {onBack && (
        <button type="button" onClick={onBack} className="min-h-11 rounded-xl px-4 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Quay lại
        </button>
      )}
    </div>
  );
  const address = copied === 'failed' && (
    <p className="mt-2 break-all text-sm text-slate-800">Không tự chép được. Giữ ngón tay lên địa chỉ này để chép: <span className="font-mono">{href}</span></p>
  );

  if (variant === 'banner') {
    return (
      <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <p>
          <strong>Bạn đang mở trang trong {browser.app}.</strong>{' '}
          {browser.blocksInlineCamera
            ? 'Ở đây camera không chạy đúng nên không vào thi được. Hãy mở bằng Safari rồi đăng nhập lại.'
            : 'Camera có thể không chạy đúng ở đây. Nếu gặp lỗi khi vào thi, hãy mở bằng Safari.'}
        </p>
        {actions}
        {address}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-4">
      <div role="alert" className="rounded-2xl border border-amber-300 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Hãy mở trang này bằng Safari</h1>
        <p className="mt-2 text-sm text-slate-700">
          Bạn đang mở trang trong {browser.app}. Trình duyệt bên trong {browser.app} trên iPhone bật camera ở chế độ toàn màn
          hình rồi dừng hình, nên không chụp được ảnh và không giám sát được bài thi. Bài thi chưa bắt đầu, bạn chưa mất
          lượt nào.
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-800">
          <li>Bấm <strong>Mở bằng Safari</strong> bên dưới.</li>
          <li>Nếu không mở được: bấm dấu <strong>⋯</strong> ở góc trên bên phải, chọn mở bằng trình duyệt.</li>
          <li>Hoặc bấm <strong>Chép địa chỉ trang</strong>, mở Safari và dán vào ô địa chỉ.</li>
          <li>Trong Safari, đăng nhập lại bằng tài khoản thi của bạn.</li>
        </ol>
        {actions}
        {address}
      </div>
    </div>
  );
}
