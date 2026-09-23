import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import {
  ShieldCheck,
  ArrowRight,
  UserCheck,
  Menu,
  X,
  MapPin,
  FileText,
  PhoneCall,
  BellRing,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { currentPath, navigate, events } = useEvents();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = currentPath.startsWith('/admin');

  // Count active events
  const activeEventsCount = events.filter(
    (e) => e.status === 'verified_original' || e.status === 'assumed_event'
  ).length;

  const publicNavLinks = [
    { path: '/', match: (p: string) => p === '/' || p === '/map', label: 'Event Map', badge: activeEventsCount, icon: MapPin },
    { path: '/report', match: (p: string) => p === '/report', label: 'Citizen Report', icon: FileText },
    { path: '/safety', match: (p: string) => p === '/safety', label: 'Emergency Directory', icon: PhoneCall },
    { path: '/alerts', match: (p: string) => p === '/alerts', label: 'Nearby Notifications', icon: BellRing },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-xs font-sans">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(isAdmin ? '/admin' : '/')}
            className="flex items-center gap-2.5 text-left group cursor-pointer"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white font-semibold shadow-xs">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
            </div>
            <div className="flex items-center">
              <span className="text-lg font-bold tracking-tight text-slate-900 group-hover:text-amber-600 transition-colors whitespace-nowrap">
                WAVE
              </span>
              <span className="hidden lg:inline-block text-xs font-medium text-slate-500 border-l border-slate-200 pl-2.5 ml-2.5">
                Weather Analytics &amp; Verification Engine
              </span>
            </div>
          </button>
        </div>

        {/* Primary Desktop Navigation Links (Single authoritative menu) */}
        {!isAdmin ? (
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            {publicNavLinks.map((link) => {
              const isActive = link.match(currentPath);
              return (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer py-1 ${
                    isActive
                      ? 'text-slate-900 font-semibold border-b-2 border-slate-900 -mb-px'
                      : 'hover:text-slate-900'
                  }`}
                >
                  <span>{link.label}</span>
                  {link.badge !== undefined && link.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full font-bold ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {link.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          <div className="hidden md:flex items-center text-xs font-medium text-slate-500">
            Emergency Operations Console
          </div>
        )}

        {/* Action Button & Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {!isAdmin ? (
            <button
              onClick={() => navigate('/admin')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <UserCheck className="h-3.5 w-3.5 text-amber-400" />
              <span>Admin Operations</span>
              <ArrowRight className="h-3 w-3 hidden sm:inline" />
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Exit to Public View</span>
            </button>
          )}

          {/* Mobile Menu Toggle */}
          {!isAdmin && (
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu Dropdown for Public View */}
      {mobileOpen && !isAdmin && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {publicNavLinks.map((link) => {
            const Icon = link.icon;
            const isActive = link.match(currentPath);
            return (
              <button
                key={link.path}
                onClick={() => {
                  navigate(link.path);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-md transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-slate-500" />
                  <span>{link.label}</span>
                </div>
                {link.badge !== undefined && link.badge > 0 && (
                  <span className="px-1.5 py-0.2 text-xs font-mono rounded bg-slate-200 text-slate-800">
                    {link.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
