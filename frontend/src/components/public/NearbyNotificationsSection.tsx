import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { DisasterEvent } from '../../types';
import {
  BellRing,
  MapPin,
  AlertTriangle,
  ShieldCheck,
  Radio,
  Volume2,
  VolumeX,
  Phone,
  Clock,
  Compass,
  CheckCircle,
} from 'lucide-react';

export const NearbyNotificationsSection: React.FC = () => {
  const { events, userLocation, setSelectedEvent } = useEvents();
  const [radiusKm, setRadiusKm] = useState<number>(35);
  const [audioPlayed, setAudioPlayed] = useState(false);

  // Haversine distance formula
  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Find incidents that are verified or assumed
  const nearbyIncidents = events
    .filter((evt) => evt.status === 'verified_original' || evt.status === 'assumed_event')
    .map((evt) => {
      const dist = getDistanceKm(
        userLocation.lat,
        userLocation.lng,
        evt.location.lat,
        evt.location.lng
      );
      return { ...evt, distanceKm: dist };
    })
    .filter((evt) => evt.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  // All active alerts if none in immediate radius
  const allActiveAlerts = events
    .filter((evt) => evt.status === 'verified_original' || evt.status === 'assumed_event')
    .map((evt) => {
      const dist = getDistanceKm(
        userLocation.lat,
        userLocation.lng,
        evt.location.lat,
        evt.location.lng
      );
      return { ...evt, distanceKm: dist };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const displayAlerts = nearbyIncidents.length > 0 ? nearbyIncidents : allActiveAlerts;

  const playAlertChime = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      setAudioPlayed(true);
      setTimeout(() => setAudioPlayed(false), 2000);
    } catch {
      // Audio fallback
    }
  };

  return (
    <section id="nearby-notifications" className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="text-xs font-semibold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-red-600 animate-pulse" />
            <span>Geofenced Public Safety Cell</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            Nearby / Location-Based Disaster Notifications
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time critical bulletins and evacuations detected within your active sector ({userLocation.name}).
          </p>
        </div>

        {/* Radius selector & Audio siren test */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700">
            <Compass className="h-3.5 w-3.5 text-slate-500" />
            <span>Search Radius:</span>
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="bg-transparent font-bold text-slate-900 focus:outline-hidden cursor-pointer"
            >
              <option value={15}>15 km</option>
              <option value={35}>35 km</option>
              <option value={75}>75 km</option>
              <option value={150}>150 km</option>
            </select>
          </div>

          <button
            onClick={playAlertChime}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Test Emergency Tone"
          >
            {audioPlayed ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-emerald-600 animate-bounce" />
                <span>Playing Chime...</span>
              </>
            ) : (
              <>
                <Volume2 className="h-3.5 w-3.5 text-slate-600" />
                <span>Test Alert Tone</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Location Match Status Bar */}
      <div className="flex items-center justify-between text-xs px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 font-sans">
        <div className="flex items-center gap-2 text-slate-700">
          <MapPin className="h-3.5 w-3.5 text-amber-600" />
          <span>Monitoring location: <strong>{userLocation.name}</strong></span>
        </div>
        <div className="font-mono text-xs font-semibold text-slate-600">
          {nearbyIncidents.length > 0 ? (
            <span className="text-red-700 font-bold">
              {nearbyIncidents.length} Alert{nearbyIncidents.length > 1 ? 's' : ''} in immediate radius (≤{radiusKm}km)
            </span>
          ) : (
            <span className="text-emerald-700">
              No immediate hazards within {radiusKm}km · Showing regional alerts
            </span>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {displayAlerts.map((evt) => {
          const isNearby = evt.distanceKm <= radiusKm;
          const isCritical = evt.severity === 'Critical';

          return (
            <div
              key={evt.id}
              className={`rounded-xl border p-5 transition-all shadow-xs ${
                isCritical
                  ? 'border-red-200 bg-red-50/40 hover:border-red-300'
                  : 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-white text-xs ${
                        isCritical ? 'bg-red-600' : 'bg-amber-600'
                      }`}
                    >
                      {evt.severity.toUpperCase()} ALERT
                    </span>

                    {evt.status === 'verified_original' ? (
                      <span className="text-emerald-800 font-semibold flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Verified by Authorities</span>
                      </span>
                    ) : (
                      <span className="text-amber-800 font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span>Assumed Alert</span>
                      </span>
                    )}

                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-600">{evt.lastUpdatedAt}</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 pt-0.5">
                    {evt.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {evt.location.name}, {evt.location.district} ({evt.location.state})
                    </span>
                    <span className="font-mono font-semibold text-slate-800 ml-2">
                      ~{evt.distanceKm.toFixed(1)} km from you
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedEvent(evt)}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    View Full Details
                  </button>
                </div>
              </div>

              {/* Summary */}
              <p className="text-xs text-slate-700 mt-3 leading-relaxed">
                {evt.summary}
              </p>

              {/* Safety Instructions / Recommended Action */}
              {evt.officialSafetyGuidance && evt.officialSafetyGuidance.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs">
                  <div className="font-semibold text-slate-800 mb-1">
                    Required Citizen Action:
                  </div>
                  <div className="text-slate-700 bg-white/70 p-2.5 rounded-lg border border-slate-200/80 leading-relaxed">
                    {evt.officialSafetyGuidance[0]}
                  </div>
                </div>
              )}

              {/* Emergency Hotline Button */}
              {evt.emergencyContacts && evt.emergencyContacts.length > 0 && (
                <div className="mt-3 flex items-center justify-between text-xs pt-2">
                  <span className="text-slate-600">
                    Helpline: <strong>{evt.emergencyContacts[0].name}</strong>
                  </span>
                  <a
                    href={`tel:${evt.emergencyContacts[0].phone}`}
                    className="flex items-center gap-1.5 px-3 py-1 font-mono font-bold bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
                  >
                    <Phone className="h-3 w-3 text-amber-400" />
                    <span>{evt.emergencyContacts[0].phone}</span>
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
