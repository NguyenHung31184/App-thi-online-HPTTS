import { Component, type ReactNode } from 'react';

export default class RouteLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (this.state.failed) {
      return (
        <div className="mx-auto max-w-md p-6" role="alert">
          <p className="text-slate-800">Không tải được trang. Kiểm tra kết nối mạng rồi tải lại.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 min-h-11 rounded-lg bg-brand-700 px-4 py-2 text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700">
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
