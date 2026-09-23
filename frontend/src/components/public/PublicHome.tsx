import React from 'react';
import { useEvents } from '../../context/EventContext';
import { IncidentMap } from './IncidentMap';
import { CitizenReportSection } from './CitizenReportSection';
import { EmergencyDirectorySection } from './EmergencyDirectorySection';
import { NearbyNotificationsSection } from './NearbyNotificationsSection';
import { Navigation } from 'lucide-react';

export const PublicHome: React.FC = () => {
  const {
    currentPath,
    userLocation,
    isLocating,
    locationSource,
    detectRealtimeLocation,
  } = useEvents();

  // Determine active view from currentPath
  const activeTab =
    currentPath === '/report'
      ? 'report'
      : currentPath === '/safety'
      ? 'directory'
      : currentPath === '/alerts'
      ? 'notifications'
      : 'map';

  const viewLabels: Record<string, { title: string; subtitle: string }> = {
    map: {
      title: 'Consolidated Incident Map',
      subtitle: 'Real-time verified and assumed disaster clusters across India',
    },
    report: {
      title: 'Citizen Incident Report',
      subtitle: 'Submit ground hazard observations directly to State Operations Center',
    },
    directory: {
      title: 'Emergency Services Directory',
      subtitle: 'Authoritative disaster helplines and regional civil defense contacts',
    },
    notifications: {
      title: 'Nearby Disaster Notifications',
      subtitle: 'Geofenced alerts calculated from your current coordinates',
    },
  };

  const currentMeta = viewLabels[activeTab];

  return (
    <div className="space-y-6 font-sans">
      {/* Slim Location Status & View Context Bar (No duplicate nav tabs) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
            {currentMeta.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {currentMeta.subtitle}
          </p>
        </div>

        {/* Real-time Location Indicator & Trigger */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs shadow-2xs">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                locationSource === 'gps' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                locationSource === 'gps' ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <div className="text-slate-600 truncate max-w-[180px] sm:max-w-[220px]">
            <strong className="text-slate-800 font-medium">{userLocation.name}</strong>
          </div>

          <button
            type="button"
            onClick={() => detectRealtimeLocation()}
            disabled={isLocating}
            className="ml-2 pl-2 border-l border-slate-200 text-slate-700 hover:text-slate-900 font-medium inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Update realtime GPS coordinates via browser"
          >
            <Navigation
              className={`h-3 w-3 text-slate-500 ${isLocating ? 'animate-spin' : ''}`}
            />
            <span>{isLocating ? 'Locating...' : 'Detect GPS'}</span>
          </button>
        </div>
      </div>

      {/* Frame Viewport: Only the single active section is rendered */}
      <div className="w-full">
        {activeTab === 'map' && <IncidentMap />}
        {activeTab === 'report' && <CitizenReportSection />}
        {activeTab === 'directory' && <EmergencyDirectorySection />}
        {activeTab === 'notifications' && <NearbyNotificationsSection />}
      </div>
    </div>
  );
};
