import React, { useState, useEffect, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import { useEvents } from '../../context/EventContext';
import { DisasterEvent, EmergencyShelter, IncidentSeverity } from '../../types';
import { EventDetailModal } from './EventDetailModal';
import { getOfflineDirectory, syncEmergencyDirectoryFromDatabase } from '../../utils/offlineDirectoryStorage';
import {
  MapPin,
  AlertTriangle,
  ShieldCheck,
  Info,
  X,
  Navigation,
  Phone,
  Layers,
  Compass,
  LifeBuoy,
  FileText,
} from 'lucide-react';

// Helper component to draw geofence circle overlays
const IncidentGeofenceCircle: React.FC<{
  center: google.maps.LatLngLiteral;
  radiusKm: number;
  severity: IncidentSeverity;
}> = ({ center, radiusKm, severity }) => {
  const map = useMap();
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps) return;

    const color =
      severity === 'Critical'
        ? '#dc2626'
        : severity === 'Severe'
        ? '#d97706'
        : '#2563eb';

    const circle = new google.maps.Circle({
      map,
      center,
      radius: radiusKm * 1000,
      fillColor: color,
      fillOpacity: 0.15,
      strokeColor: color,
      strokeOpacity: 0.65,
      strokeWeight: 1.5,
      clickable: false,
    });

    circleRef.current = circle;

    return () => {
      circle.setMap(null);
    };
  }, [map, center.lat, center.lng, radiusKm, severity]);

  return null;
};

// Map Pan/Zoom controller
const MapViewController: React.FC<{
  targetCoords: { lat: number; lng: number; zoom: number } | null;
}> = ({ targetCoords }) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !targetCoords) return;
    map.panTo({ lat: targetCoords.lat, lng: targetCoords.lng });
    map.setZoom(targetCoords.zoom);
  }, [map, targetCoords]);

  return null;
};

export const IncidentMap: React.FC = () => {
  const {
    events,
    selectedEvent,
    setSelectedEvent,
    userLocation,
    setUserLocation,
    isLocating,
    detectRealtimeLocation,
  } = useEvents();
  const [activeLayer, setActiveLayer] = useState<
    'all' | 'verified_only' | 'critical_only'
  >('all');
  const [showShelters, setShowShelters] = useState(true);
  const [showCircles, setShowCircles] = useState(true);
  const [hoveredEvent, setHoveredEvent] = useState<DisasterEvent | null>(null);
  const [shelters, setShelters] = useState<EmergencyShelter[]>(() => getOfflineDirectory().shelters);
  const [selectedShelter, setSelectedShelter] = useState<EmergencyShelter | null>(null);
  const [cameraTarget, setCameraTarget] = useState<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    syncEmergencyDirectoryFromDatabase()
      .then((directory) => setShelters(directory.shelters))
      .catch(() => setShelters(getOfflineDirectory().shelters));
  }, []);

  const filteredEvents = events.filter((evt) => {
    if (activeLayer === 'verified_only') {
      return evt.status === 'verified_original';
    }
    if (activeLayer === 'critical_only') {
      return evt.severity === 'Critical';
    }
    return (
      evt.status === 'verified_original' ||
      evt.status === 'assumed_event' ||
      evt.status === 'admin_review'
    );
  });

  const inspectEvent = selectedEvent || filteredEvents[0] || events[0];
  const eventJumpOptions = filteredEvents.slice(0, 5);

  const jumpToAllEvents = () => {
    setCameraTarget({ lat: 20.5937, lng: 78.9629, zoom: filteredEvents.length > 1 ? 5 : 6 });
  };

  const jumpToEvent = (event: DisasterEvent) => {
    setCameraTarget({ lat: event.location.lat, lng: event.location.lng, zoom: 12 });
    setUserLocation({
      name: [event.location.name, event.location.state].filter(Boolean).join(', '),
      lat: event.location.lat,
      lng: event.location.lng,
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
      {/* Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50/70 gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-700" />
          <h3 className="text-sm font-semibold text-slate-900">
            Live Google Maps GIS Incident Surveillance
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            · {filteredEvents.length} Active Incident Clusters
          </span>
        </div>

        {/* Event Quick-Zoom Presets */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 mr-1 font-medium hidden sm:inline">Jump Event:</span>
          <button
            onClick={jumpToAllEvents}
            className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors font-medium"
          >
            All Events
          </button>
          {eventJumpOptions.map((event) => (
            <button
              key={`jump-${event.id}`}
              onClick={() => jumpToEvent(event)}
              className="px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors font-medium"
              title={event.title}
            >
              {event.location.district || event.location.name}
            </button>
          ))}
          <button
            onClick={async () => {
              await detectRealtimeLocation();
              setCameraTarget({ lat: userLocation.lat, lng: userLocation.lng, zoom: 12 });
            }}
            disabled={isLocating}
            className="px-2.5 py-1 rounded bg-amber-100 border border-amber-300 text-amber-900 hover:bg-amber-200 transition-colors font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <Navigation className={`h-3 w-3 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Locating...' : 'My Realtime GPS'}</span>
          </button>
        </div>

        {/* Layer Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-lg">
          <button
            onClick={() => setActiveLayer('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeLayer === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Clusters
          </button>
          <button
            onClick={() => setActiveLayer('verified_only')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeLayer === 'verified_only'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Verified Only
          </button>
          <button
            onClick={() => setActiveLayer('critical_only')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeLayer === 'critical_only'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Critical Severity
          </button>
        </div>
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-12 min-h-[540px]">
        {/* Google Maps Container */}
        <div className="relative col-span-1 lg:col-span-8 min-h-[460px] lg:min-h-[540px] w-full bg-slate-100">
          {apiKey ? (
          <APIProvider apiKey={apiKey}>
            <Map
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              defaultCenter={{ lat: 20.5937, lng: 78.9629 }}
              defaultZoom={5}
              minZoom={4}
              maxZoom={18}
              gestureHandling="cooperative"
              disableDefaultUI={false}
              style={{ width: '100%', height: '100%', minHeight: '540px' }}
            >
              <MapViewController targetCoords={cameraTarget} />

              {/* Geofence Circles */}
              {showCircles &&
                filteredEvents.map((evt) => (
                  <IncidentGeofenceCircle
                    key={`circle-${evt.id}`}
                    center={{ lat: evt.location.lat, lng: evt.location.lng }}
                    radiusKm={evt.affectedRadiusKm}
                    severity={evt.severity}
                  />
                ))}

              {/* Disaster Incident Markers */}
              {filteredEvents.map((evt) => {
                const isCritical = evt.severity === 'Critical';
                const isSevere = evt.severity === 'Severe';
                const isSelected = selectedEvent?.id === evt.id;

                const pinBg = isCritical
                  ? '#dc2626'
                  : isSevere
                  ? '#d97706'
                  : '#2563eb';

                return (
                  <AdvancedMarker
                    key={evt.id}
                    position={{ lat: evt.location.lat, lng: evt.location.lng }}
                    onClick={() => {
                      setSelectedEvent(evt);
                      setSelectedShelter(null);
                      setShowDetailModal(true);
                    }}
                    title={evt.title}
                  >
                    <Pin
                      background={pinBg}
                      borderColor="#ffffff"
                      glyphColor="#ffffff"
                      scale={isSelected ? 1.3 : 1.05}
                    />
                  </AdvancedMarker>
                );
              })}

              {/* Evacuation Shelter Markers */}
              {showShelters &&
                shelters.map((s) => (
                  <AdvancedMarker
                    key={s.id}
                    position={{ lat: s.lat, lng: s.lng }}
                    onClick={() => {
                      setSelectedShelter(s);
                      setSelectedEvent(null);
                    }}
                    title={s.name}
                  >
                    <Pin
                      background="#15803d"
                      borderColor="#ffffff"
                      glyphColor="#ffffff"
                      scale={0.9}
                    />
                  </AdvancedMarker>
                ))}

              {/* Active Incident InfoWindow */}
              {selectedEvent && (
                <InfoWindow
                  position={{
                    lat: selectedEvent.location.lat,
                    lng: selectedEvent.location.lng,
                  }}
                  onCloseClick={() => setSelectedEvent(null)}
                  maxWidth={320}
                >
                  <div className="p-1 font-sans text-slate-900 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                      <span className="uppercase text-[11px] font-semibold text-slate-600">
                        {selectedEvent.category.replace('_', ' ')}
                      </span>
                      <span
                        className={`font-semibold ${
                          selectedEvent.severity === 'Critical'
                            ? 'text-red-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {selectedEvent.severity}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-slate-900 leading-snug">
                      {selectedEvent.title}
                    </div>
                    <div className="text-xs text-slate-600">
                      {selectedEvent.location.name}, {selectedEvent.location.state}
                    </div>
                    <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-600">
                        Updated {selectedEvent.lastUpdatedAt}
                      </span>
                      <span>Radius: {selectedEvent.affectedRadiusKm}km</span>
                    </div>
                    <button
                      onClick={() => setShowDetailModal(true)}
                      className="w-full mt-2 py-1 px-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded text-center cursor-pointer transition-colors"
                    >
                      View Detailed Description →
                    </button>
                  </div>
                </InfoWindow>
              )}

              {/* Active Shelter InfoWindow */}
              {selectedShelter && (
                <InfoWindow
                  position={{ lat: selectedShelter.lat, lng: selectedShelter.lng }}
                  onCloseClick={() => setSelectedShelter(null)}
                  maxWidth={300}
                >
                  <div className="p-1 font-sans text-slate-900 space-y-1">
                    <div className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Verified Civil Defense Shelter</span>
                    </div>
                    <div className="font-bold text-xs text-slate-900 leading-snug">
                      {selectedShelter.name}
                    </div>
                    <div className="text-xs text-slate-600">
                      {selectedShelter.location}
                    </div>
                    <div className="text-xs font-mono text-emerald-700 font-semibold pt-1">
                      Capacity: {selectedShelter.capacity}
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
          ) : (
            <div className="flex h-full min-h-[540px] items-center justify-center p-6 text-center text-xs text-slate-600">
              Set VITE_GOOGLE_MAPS_API_KEY to render the live incident map.
            </div>
          )}

          {/* Floating Map Legend Overlay */}
          <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-xs rounded-lg border border-slate-200 p-2.5 shadow-md text-xs z-10 space-y-1.5 font-sans">
            <div className="font-bold text-slate-800 text-xs flex items-center gap-1">
              <Layers className="h-3 w-3 text-slate-600" />
              <span>Map Legend & Overlays</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600 shrink-0" />
              <span>Critical Disaster (Flash Flood / Cyclone)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
              <span>Severe Incident (Waterlogging / Wind)</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-700 shrink-0" />
              <span>Civil Defense Evacuation Shelter</span>
            </div>
            <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-3 text-xs">
              <label className="flex items-center gap-1 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCircles}
                  onChange={(e) => setShowCircles(e.target.checked)}
                  className="rounded text-slate-900 accent-slate-900 cursor-pointer h-3 w-3"
                />
                <span>Geofence Radius</span>
              </label>
              <label className="flex items-center gap-1 text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showShelters}
                  onChange={(e) => setShowShelters(e.target.checked)}
                  className="rounded text-slate-900 accent-slate-900 cursor-pointer h-3 w-3"
                />
                <span>Shelters</span>
              </label>
            </div>
          </div>
        </div>

        {/* Selected Incident Telemetry Inspector Panel */}
        <div className="col-span-1 lg:col-span-4 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white p-5 flex flex-col justify-between">
          {inspectEvent ? (
            <div className="space-y-4">
              {/* Status Header */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono mb-1">
                  <span className="uppercase text-[11px] font-semibold text-slate-600">
                    {inspectEvent.category.replace('_', ' ')}
                  </span>
                  <span className="text-slate-600">Updated {inspectEvent.lastUpdatedAt}</span>
                </div>
                <h4 className="text-base font-bold text-slate-900 leading-snug">
                  {inspectEvent.title}
                </h4>
                <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    {inspectEvent.location.name}, {inspectEvent.location.district} ({inspectEvent.location.state})
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">Verification State:</span>
                  {inspectEvent.status === 'verified_original' ? (
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Verified Event</span>
                    </span>
                  ) : inspectEvent.status === 'assumed_event' ? (
                    <span className="font-bold text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Assumed (Active Alert)</span>
                    </span>
                  ) : (
                    <span className="text-slate-600 font-medium">Under Triage Review</span>
                  )}
                </div>
              </div>

              {/* Summary */}
              <p className="text-xs text-slate-600 leading-relaxed">
                {inspectEvent.summary}
              </p>

              {/* Machine Learning Telemetry */}
              <div className="space-y-2 pt-1">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  ML Scoring Telemetry
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-xs">Credibility</span>
                    <span className="font-bold text-emerald-700 tabular-nums">
                      {inspectEvent.mlScores.credibilityScore}%
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-xs">Urgency Sentiment</span>
                    <span className="font-bold text-amber-700 tabular-nums">
                      {inspectEvent.mlScores.urgencySentiment}%
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-xs">NER Confidence</span>
                    <span className="font-bold text-blue-700 tabular-nums">
                      {inspectEvent.mlScores.locationConfidence}%
                    </span>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block text-xs">Affected Radius</span>
                    <span className="font-bold text-slate-900 tabular-nums">
                      {inspectEvent.affectedRadiusKm} km
                    </span>
                  </div>
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-500" />
                  <span>Immediate Disaster Helpline:</span>
                </div>
                {inspectEvent.emergencyContacts.slice(0, 1).map((c, i) => (
                  <div key={i} className="text-xs flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200">
                    <span className="text-slate-700 font-medium">{c.name}</span>
                    <a
                      href={`tel:${c.phone}`}
                      className="font-mono font-bold text-amber-800 hover:underline"
                    >
                      {c.phone}
                    </a>
                  </div>
                ))}
              </div>

              {/* Inspect Full Detailed Description Button */}
              <button
                onClick={() => setShowDetailModal(true)}
                className="w-full py-2.5 px-3 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <FileText className="h-4 w-4 text-amber-400" />
                <span>View Full Detailed Description</span>
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Info className="h-8 w-8 mb-2 opacity-60" />
              <div className="text-xs font-medium">Select an incident pin on the map to inspect details</div>
            </div>
          )}

        </div>
      </div>

      {/* Detailed Description Modal */}
      <EventDetailModal
        event={showDetailModal ? inspectEvent : null}
        onClose={() => setShowDetailModal(false)}
      />
    </div>
  );
};
