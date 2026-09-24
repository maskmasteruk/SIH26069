import React, { useState, useEffect } from 'react';
import { useEvents } from '../../context/EventContext';
import {
  EmergencyContact,
  EmergencyShelter,
} from '../../types';
import {
  getOfflineDirectory,
  syncEmergencyDirectoryFromDatabase,
  useOnlineStatus,
  downloadOfflineEmergencySheet,
} from '../../utils/offlineDirectoryStorage';
import {
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Search,
  Wifi,
  WifiOff,
  Download,
  RefreshCw,
} from 'lucide-react';

export const EmergencyDirectorySection: React.FC<{ compact?: boolean }> = () => {
  const { userLocation, setUserLocation } = useEvents();
  const isOnline = useOnlineStatus();

  // Local state initialized directly from persistent offline storage
  const [cachedData, setCachedData] = useState(() => getOfflineDirectory());
  const [activeTab, setActiveTab] = useState<'contacts' | 'shelters'>('contacts');
  const [forceShowAll, setForceShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Sync / refresh offline cache
  const handleSyncCache = async () => {
    try {
      const refreshed = await syncEmergencyDirectoryFromDatabase();
      setCachedData(refreshed);
      setSyncNotice('Emergency directory cache refreshed from PostgreSQL.');
    } catch {
      setSyncNotice('Unable to refresh directory from PostgreSQL. Showing cached data.');
    }
    setTimeout(() => setSyncNotice(null), 3000);
  };

  useEffect(() => {
    if (isOnline) {
      handleSyncCache();
    }
  }, [isOnline]);

  const locLower = userLocation.name.toLowerCase();

  const isMatchedRegion = (itemState?: string, itemDistrict?: string, itemCity?: string) => {
    if (!itemState && !itemDistrict && !itemCity) return false;
    const s = itemState?.toLowerCase() || '';
    const d = itemDistrict?.toLowerCase() || '';
    const c = itemCity?.toLowerCase() || '';

    return (
      (s && locLower.includes(s)) ||
      (d && locLower.includes(d)) ||
      (c && locLower.includes(c)) ||
      (locLower.includes('chennai') && (s.includes('tamil') || d.includes('chennai'))) ||
      (locLower.includes('tamil nadu') && s.includes('tamil')) ||
      (locLower.includes('puri') && (s.includes('odisha') || d.includes('puri'))) ||
      (locLower.includes('odisha') && s.includes('odisha')) ||
      (locLower.includes('majuli') && (s.includes('assam') || d.includes('majuli'))) ||
      (locLower.includes('assam') && s.includes('assam')) ||
      (locLower.includes('wayanad') && (s.includes('kerala') || d.includes('wayanad'))) ||
      (locLower.includes('kerala') && s.includes('kerala')) ||
      (locLower.includes('mumbai') && (s.includes('maharashtra') || d.includes('mumbai'))) ||
      (locLower.includes('bengaluru') && (s.includes('karnataka') || d.includes('bengaluru')))
    );
  };

  // Filter contacts from cache
  const localContacts = cachedData.contacts.filter(
    (c) => c.category !== 'National' && isMatchedRegion(c.state, c.district, c.city)
  );

  const localShelters = cachedData.shelters.filter((s) =>
    isMatchedRegion(s.state, s.district)
  );

  const hasLocationMatch = localContacts.length > 0 || localShelters.length > 0;
  const showOnlyLocal = hasLocationMatch && !forceShowAll;

  const displayedContacts = cachedData.contacts.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.state?.toLowerCase().includes(q) ||
        c.district?.toLowerCase().includes(q)
      );
    }
    if (showOnlyLocal) {
      return (
        c.category === 'National' ||
        c.category === 'Rescue' ||
        isMatchedRegion(c.state, c.district, c.city)
      );
    }
    return true;
  });

  const displayedShelters = cachedData.shelters.filter((s) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.state.toLowerCase().includes(q) ||
        s.district.toLowerCase().includes(q)
      );
    }
    if (showOnlyLocal) {
      return isMatchedRegion(s.state, s.district);
    }
    return true;
  });

  const presetLocations = cachedData.shelters
    .reduce<Array<{ name: string; lat: number; lng: number }>>((locations, shelter) => {
      const name = [shelter.district, shelter.state].filter(Boolean).join(', ');
      if (!name || locations.some((loc) => loc.name === name)) return locations;
      return [...locations, { name, lat: shelter.lat, lng: shelter.lng }];
    }, [])
    .slice(0, 6);

  return (
    <section id="emergency-directory" className="space-y-6 font-sans">
      {/* 1. Offline Caching Status Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          {isOnline ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>Online · Live Sync</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              <WifiOff className="h-3 w-3 text-amber-700" />
              <span>Offline Mode · Serving Local Cache</span>
            </span>
          )}

          <span className="text-slate-500">
            {cachedData.contacts.length} helplines &amp; {cachedData.shelters.length} shelters stored in offline memory
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncCache}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors cursor-pointer"
            title="Refresh local storage cache"
          >
            <RefreshCw className="h-3 w-3 text-slate-500" />
            <span>Update Cache</span>
          </button>

          <button
            type="button"
            onClick={() =>
              downloadOfflineEmergencySheet(
                userLocation.name,
                displayedContacts,
                displayedShelters
              )
            }
            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors cursor-pointer"
            title="Download offline text card for emergency power/network outages"
          >
            <Download className="h-3 w-3 text-slate-500" />
            <span>Save Offline Card</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-md">
          {syncNotice}
        </div>
      )}

      {/* 2. Controls & Search Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Civil Defense Helplines &amp; Evacuation Shelters
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Instant access to emergency helplines. All phone numbers connect via standard cellular carrier even during data blackouts.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md shrink-0 text-xs">
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
                activeTab === 'contacts'
                  ? 'bg-white text-slate-900 font-medium shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Emergency Helplines ({displayedContacts.length})
            </button>
            <button
              onClick={() => setActiveTab('shelters')}
              className={`px-3 py-1.5 rounded transition-colors cursor-pointer ${
                activeTab === 'shelters'
                  ? 'bg-white text-slate-900 font-medium shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Relief Shelters ({displayedShelters.length})
            </button>
          </div>
        </div>

        {/* Location & Fast Filter Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>Current Sector:</span>
            </span>
            <span className="font-medium text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
              {userLocation.name}
            </span>

            {/* Quick region switch buttons */}
            <div className="flex flex-wrap items-center gap-1 ml-1">
              {presetLocations.map((loc, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setUserLocation(loc);
                    setForceShowAll(false);
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                    userLocation.name === loc.name
                      ? 'bg-slate-900 text-white font-medium'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {loc.name.split(',')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasLocationMatch && (
              <button
                onClick={() => setForceShowAll(!forceShowAll)}
                className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
              >
                {forceShowAll ? 'Filter by My Location' : 'Show All India'}
              </button>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search helplines..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs rounded border border-slate-200 bg-white placeholder-slate-400 focus:outline-hidden focus:border-slate-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Content Grid */}
      {activeTab === 'contacts' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedContacts.map((contact) => {
            const isLocal = isMatchedRegion(contact.state, contact.district, contact.city);

            return (
              <div
                key={contact.id}
                className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col justify-between hover:border-slate-300 transition-colors space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span className="font-mono">{contact.hours}</span>
                    {isLocal ? (
                      <span className="text-slate-800 font-medium inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-500" />
                        <span>Nearby Desk</span>
                      </span>
                    ) : (
                      <span>{contact.category}</span>
                    )}
                  </div>

                  <h3 className="font-semibold text-sm text-slate-900">
                    {contact.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {contact.role}
                  </p>

                  {(contact.district || contact.state) && (
                    <div className="text-[11px] text-slate-400 mt-2 font-mono">
                      Area: {[contact.district, contact.state].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-900">
                    {contact.phone}
                  </span>
                  <a
                    href={`tel:${contact.phone.split('/')[0].trim()}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    <span>Call Helpline</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedShelters.map((shelter) => {
            const isLocal = isMatchedRegion(shelter.state, shelter.district);

            return (
              <div
                key={shelter.id}
                className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col justify-between hover:border-slate-300 transition-colors space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span className="text-slate-700 font-medium inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      <span>{shelter.status}</span>
                    </span>
                    {isLocal && (
                      <span className="text-slate-800 font-medium">Nearby</span>
                    )}
                  </div>

                  <h3 className="font-semibold text-sm text-slate-900">
                    {shelter.name}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                    <span>{shelter.location}</span>
                  </div>

                  <div className="mt-3 p-2.5 rounded bg-slate-50 border border-slate-100 space-y-1 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Capacity:</span>
                      <span className="text-slate-900 font-medium">{shelter.capacity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Occupancy:</span>
                      <span className="text-slate-700">{shelter.occupied}</span>
                    </div>
                    <div className="pt-1 text-slate-600 font-sans border-t border-slate-200/60 text-[11px]">
                      <span className="font-medium text-slate-700">Supplies: </span>
                      {shelter.supplies}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-600">
                    Desk: {shelter.contact}
                  </span>
                  <a
                    href={`tel:${shelter.contact}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded transition-colors"
                  >
                    <Phone className="h-3 w-3 text-slate-600" />
                    <span>Call Shelter</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
