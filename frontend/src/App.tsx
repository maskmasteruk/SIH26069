import React from 'react';
import { EventProvider, useEvents } from './context/EventContext';
import { Navbar } from './components/layout/Navbar';
import { PublicHome } from './components/public/PublicHome';
import { ArchitecturePipelineView } from './components/public/ArchitecturePipelineView';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminTriageQueue } from './components/admin/AdminTriageQueue';
import { AdminMasterEvents } from './components/admin/AdminMasterEvents';
import { AdminVerifiedDatabase } from './components/admin/AdminVerifiedDatabase';
import { AdminAnalytics } from './components/admin/AdminAnalytics';
import { AdminLoginPage } from './components/admin/AdminLoginPage';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    currentPath,
    notificationToast,
    clearNotificationToast,
    isAdminLoggedIn,
    isAdminSessionLoading,
  } = useEvents();
  const isAdmin = currentPath.startsWith('/admin');

  // Render admin views
  const renderAdminView = () => {
    switch (currentPath) {
      case '/admin/events':
        return <AdminMasterEvents />;
      case '/admin/verified':
        return <AdminVerifiedDatabase />;
      case '/admin/analytics':
        return <AdminAnalytics />;
      case '/admin':
      default:
        return <AdminTriageQueue />;
    }
  };

  // Render public views via unified frame application
  const renderPublicView = () => {
    switch (currentPath) {
      case '/pipeline':
        return <ArchitecturePipelineView />;
      case '/map':
      case '/alerts':
      case '/report':
      case '/safety':
      case '/':
      default:
        return <PublicHome />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900 font-sans">
      {/* Top Bar Navigation: Only on public views and admin login screen */}
      {(!isAdmin || (!isAdminLoggedIn && !isAdminSessionLoading)) && <Navbar />}

      {/* Main Content Area */}
      <div className="flex-1">
        {isAdmin ? (
          isAdminSessionLoading ? (
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
              <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
                <div className="text-xs text-slate-500 border border-slate-200 bg-white rounded px-4 py-3">
                  Restoring admin session...
                </div>
              </div>
            </main>
          ) : isAdminLoggedIn ? (
            <AdminLayout>{renderAdminView()}</AdminLayout>
          ) : (
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
              <AdminLoginPage />
            </main>
          )
        ) : (
          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {renderPublicView()}
          </main>
        )}
      </div>

      {/* Floating System Toast Notification */}
      {notificationToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-fade-in">
          <div
            className={`flex items-start gap-3 p-4 rounded-xl shadow-xl border backdrop-blur-xs ${
              notificationToast.type === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-800'
                : notificationToast.type === 'alert'
                ? 'bg-amber-950 text-amber-100 border-amber-800'
                : 'bg-slate-900 text-slate-100 border-slate-800'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {notificationToast.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : notificationToast.type === 'alert' ? (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              ) : (
                <Info className="h-5 w-5 text-blue-400" />
              )}
            </div>
            <div className="text-xs leading-relaxed flex-1">
              {notificationToast.message}
            </div>
            <button
              onClick={clearNotificationToast}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <EventProvider>
      <AppContent />
    </EventProvider>
  );
}
