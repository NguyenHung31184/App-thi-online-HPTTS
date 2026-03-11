import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { GraduationCap } from 'lucide-react';
import { MenuIcon, LogoutIcon } from './Icons';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AppLayoutProps {
  children: ReactNode;
  navItems: NavItem[];
  title: string;
  userEmail?: string;
  userRole?: string;
  onLogout: () => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

function NavLink({
  to,
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`group flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
        isActive
          ? 'bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 text-white shadow-lg shadow-indigo-500/30 -translate-y-[1px]'
          : 'text-slate-200 hover:bg-white/10 hover:text-white hover:translate-x-0.5'
      }`}
    >
      <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`} />
      {label}
    </Link>
  );
}

export default function AppLayout({
  children,
  navItems,
  title,
  userEmail,
  userRole,
  onLogout,
  isSidebarOpen,
  setSidebarOpen,
}: AppLayoutProps) {
  const location = useLocation();

  return (
    <div className="flex h-full w-full overflow-hidden relative min-h-screen">
      {/* Overlay mobile */}
      <div
        onClick={() => setSidebarOpen(false)}
        className={`fixed inset-0 bg-gray-900 bg-opacity-50 z-30 transition-opacity duration-300 lg:hidden ${
          isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sidebar — đồng bộ với app quản lý TTDT */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 bg-gradient-to-b from-[#0a1230] via-[#10235f] to-[#0b142f] text-white flex flex-col p-4 transform transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center mb-6 px-2 py-2 rounded-2xl bg-white/5 border border-white/10">
          <div className="bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 p-2.5 rounded-xl mr-3 shadow-lg flex-shrink-0">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-sm font-bold tracking-tight leading-tight">App Thi Online</h1>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1">
            <p className="px-2 text-[11px] font-bold uppercase tracking-wider text-slate-300/80">Menu</p>
            <div className="space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  isActive={location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))}
                  onClick={() => setSidebarOpen(false)}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="mt-auto pt-4 border-t border-white/10 bg-white/5 rounded-xl p-2">
          {userEmail && (
            <div className="flex items-center px-2 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 truncate min-w-0">
                <p className="text-sm font-medium text-white truncate">{userEmail}</p>
                <p className="text-xs text-slate-300 capitalize">{userRole || 'Thí sinh'}</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center px-3 py-2.5 text-sm font-semibold text-rose-200 hover:text-white hover:bg-rose-500/30 rounded-xl transition-colors"
          >
            <LogoutIcon className="h-5 w-5 mr-3" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content — gradient giống TTDT */}
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/40">
        {/* Header với nút menu mobile */}
        <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 lg:px-6 border-b border-slate-200/60 bg-white/50">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Menu"
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-slate-800 truncate">{title}</h2>
          </div>
        </header>
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto w-full relative">{children}</div>
      </div>
    </div>
  );
}
