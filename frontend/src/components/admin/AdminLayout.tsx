import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import {
  Inbox,
  Database,
  FileCheck,
  BarChart3,
  ExternalLink,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<Props> = ({ children }) => {
  const { currentPath, navigate, events, adminLogout, adminUser } = useEvents();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active triage count
  const pendingCount = events.filter(
    (e) => e.status === 'assumed_event' || e.status === 'admin_review'
  ).length;

  const navItems = [
    {
      path: '/admin',
      label: 'Triage Queue',
      icon: Inbox,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      path: '/admin/events',
      label: 'Master Events',
      icon: Database,
    },
    {
      path: '/admin/verified',
      label: 'Verified & Debunked',
      icon: FileCheck,
    },
    {
      path: '/admin/analytics',
      label: 'Telemetry & Analytics',
      icon: BarChart3,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 flex font-sans">
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-slate-900" />
          <span className="font-semibold text-sm tracking-tight text-slate-900">
            WAVE Admin
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar Overlay on Mobile */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-2xs"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Clean, Narrow Desktop Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 space-y-6">
          {/* Logo / Product Area: Restrained and small */}
          <div className="pt-1 px-2">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                W
              </div>
              <div>
                <div className="text-xs font-semibold tracking-tight text-slate-900">
                  WAVE Operations
                </div>
                <div className="text-[11px] text-slate-500">
                  Disaster Verification Desk
                </div>
              </div>
            </div>
          </div>

          {/* Simple Navigation */}
          <nav className="space-y-0.5">
            <div className="px-2 pb-1.5 text-[11px] font-medium tracking-wider text-slate-400 uppercase">
              Operations
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;

              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? 'text-slate-900' : 'text-slate-500'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 text-[10px] font-mono rounded font-medium ${
                        isActive
                          ? 'bg-slate-200 text-slate-900'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Quiet Footer: Officer details & exit */}
        <div className="p-3 border-t border-slate-200 space-y-2">
          <div className="px-2 text-[11px] text-slate-500 leading-tight">
            <div className="font-medium text-slate-800 truncate">
              {adminUser?.username || 'Admin Officer'}
            </div>
            <div className="text-slate-400 text-[10px]">
              {adminUser?.role || 'admin'} - Authenticated
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 px-1 text-xs">
            <button
              onClick={() => navigate('/')}
              className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Public Portal</span>
              <ExternalLink className="h-3 w-3" />
            </button>
            <button
              onClick={adminLogout}
              className="text-[11px] text-slate-500 hover:text-red-700 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <LogOut className="h-3 w-3" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area with Generous Spacing */}
      <main className="flex-1 min-w-0 pt-16 md:pt-0">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-12 py-8 sm:py-10">
          {children}
        </div>
      </main>
    </div>
  );
};
