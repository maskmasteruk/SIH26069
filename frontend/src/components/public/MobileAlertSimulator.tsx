import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { Smartphone, BellRing, MapPin, Radio, ShieldCheck, AlertTriangle } from 'lucide-react';

export const MobileAlertSimulator: React.FC = () => {
  const { events, userLocation, setUserLocation } = useEvents();
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [alertType, setAlertType] = useState<'push' | 'sms'>('push');
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

  // Find incidents within user radius that are verified or assumed
  const nearbyIncidents = events
    .filter(
      (evt) =>
        evt.status === 'verified_original' ||
        evt.status === 'assumed_event'
    )
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

  const activeAlert = nearbyIncidents[0] || null;

  // Polite emergency tone using Web Audio API
  const playAlertChime = () => {
    try {
      const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.6);
      setAudioPlayed(true);
      setTimeout(() => setAudioPlayed(false), 800);
    } catch {
      // Ignore if audio context blocked
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 uppercase tracking-wider">
            <Radio className="h-4 w-4 text-amber-700 animate-pulse" />
            <span>Architecture Specification · Mobile Alerts Pipeline</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mt-1">
            Nearby / Location-Based Disaster Notifications
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Demonstrates real-time geofenced push broadcasts dispatching to citizens based on verified event coordinates.
          </p>
        </div>

        {/* Location Switcher */}
        <div className="flex items-center gap-2">
          <div className="text-xs text-slate-500">Preset Coordinates:</div>
          <select
            value={userLocation.name}
            onChange={(e) => {
              const val = e.target.value;
              if (val.includes('Chennai')) {
                setUserLocation({ name: 'Velachery, Chennai (TN)', lat: 12.9815, lng: 80.218 });
              } else if (val.includes('Puri')) {
                setUserLocation({ name: 'Puri Coastal Sector (OD)', lat: 19.8135, lng: 85.8312 });
              } else if (val.includes('Majuli')) {
                setUserLocation({ name: 'Majuli Island (AS)', lat: 26.9602, lng: 94.2155 });
              } else {
                setUserLocation({ name: 'Wayanad Ghats (KL)', lat: 11.5518, lng: 76.1264 });
              }
            }}
            className="text-xs font-medium border border-slate-200 bg-slate-50 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
          >
            <option value="Velachery, Chennai (TN)">Velachery, Chennai (TN)</option>
            <option value="Puri Coastal Sector (OD)">Puri Coastal Sector (OD)</option>
            <option value="Majuli Island (AS)">Majuli Island (AS)</option>
            <option value="Wayanad Ghats (KL)">Wayanad Ghats (KL)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-6 space-y-5">
          {/* Radius Controller */}
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                <span>Geofence Alert Radius:</span>
              </span>
              <span className="font-mono text-slate-900 font-bold tabular-nums">
                {radiusKm} km
              </span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-xs text-slate-600 mt-1 font-mono">
              <span>5 km (Micro-ward)</span>
              <span>25 km (District)</span>
              <span>60 km (Regional)</span>
            </div>
          </div>

          {/* Alert Format Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2">
              Notification Channel Format:
            </label>
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                onClick={() => setAlertType('push')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  alertType === 'push'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Mobile Push Notification</span>
              </button>
              <button
                onClick={() => setAlertType('sms')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  alertType === 'sms'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BellRing className="h-3.5 w-3.5" />
                <span>Emergency Cell Broadcast (SMS)</span>
              </button>
            </div>
          </div>

          {/* Test Sound Button */}
          <div className="pt-2">
            <button
              onClick={playAlertChime}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all ${
                audioPlayed
                  ? 'bg-amber-500 text-slate-900 ring-2 ring-amber-300'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              <BellRing className={`h-4 w-4 ${audioPlayed ? 'animate-bounce' : ''}`} />
              <span>Test Audio Emergency Chime</span>
            </button>
          </div>

          {/* Active geofenced incidents list */}
          <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50">
            <div className="text-xs font-semibold text-slate-800 mb-2">
              Detected events within {radiusKm}km:
            </div>
            {nearbyIncidents.length > 0 ? (
              <div className="space-y-2">
                {nearbyIncidents.map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-center justify-between text-xs bg-white p-2.5 rounded border border-slate-200"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{evt.title}</div>
                      <div className="text-slate-500 text-xs">
                        {evt.location.name} · {evt.severity}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <span className="font-bold text-slate-900 tabular-nums">
                        {evt.distanceKm.toFixed(1)} km
                      </span>
                      <div className="text-xs text-slate-600">radial distance</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-3 text-center">
                No verified or assumed incidents within current {radiusKm}km radius. Adjust location or expand radius to test.
              </div>
            )}
          </div>
        </div>

        {/* Mobile Device Mockup Column */}
        <div className="lg:col-span-6 flex justify-center">
          <div className="w-full max-w-sm rounded-3xl border-4 border-slate-800 bg-slate-900 p-3 shadow-2xl text-white">
            {/* Top phone notch / status */}
            <div className="flex items-center justify-between px-3 py-1 text-xs text-slate-400 font-mono">
              <span>09:41</span>
              <div className="h-4 w-20 rounded-full bg-slate-800 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-slate-600" />
              </div>
              <div className="flex items-center gap-1">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>

            {/* Mobile screen canvas */}
            <div className="mt-3 min-h-[380px] rounded-2xl bg-slate-800/90 p-3 flex flex-col justify-between border border-slate-700">
              {/* Notification Banner */}
              {activeAlert ? (
                <div className="space-y-3">
                  {alertType === 'push' ? (
                    /* iOS/Android style Push Notification */
                    <div className="rounded-xl bg-white/95 text-slate-900 p-3.5 shadow-lg backdrop-blur-xs border border-white/20 animate-fade-in">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <div className="h-4 w-4 rounded bg-red-600 flex items-center justify-center text-white text-xs">
                            !
                          </div>
                          <span>WAVE EMERGENCY ALERT</span>
                        </div>
                        <span className="font-mono text-xs">now</span>
                      </div>
                      <div className="font-bold text-sm text-red-950">
                        {activeAlert.severity.toUpperCase()} ALERT: {activeAlert.title}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Incident reported {activeAlert.distanceKm.toFixed(1)}km from your coordinates ({activeAlert.location.name}).
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="font-semibold text-red-700">
                          {activeAlert.status === 'verified_original'
                            ? 'Officially Verified Event'
                            : 'Assumed Alert'}
                        </span>
                        <span className="text-slate-500 font-mono">Tap for Shelter Route</span>
                      </div>
                    </div>
                  ) : (
                    /* Emergency Cell Broadcast SMS */
                    <div className="rounded-xl bg-amber-50 text-slate-900 p-3.5 shadow-lg border-2 border-amber-400">
                      <div className="flex items-center justify-between text-xs text-amber-900 font-semibold mb-1">
                        <span>GOVT OF INDIA CELL BROADCAST</span>
                        <span className="font-mono">CRITICAL</span>
                      </div>
                      <div className="font-mono text-xs font-bold text-slate-900 mb-1">
                        SENDER: AD-DISASTER-ALERT
                      </div>
                      <p className="text-xs text-slate-800 font-sans leading-relaxed">
                        EMERGENCY: Heavy risk of {activeAlert.category.replace('_', ' ')} around {activeAlert.location.name}. Radius: {activeAlert.affectedRadiusKm}km. Stay indoors or contact helpline {activeAlert.emergencyContacts[0]?.phone || '1070'}.
                      </p>
                    </div>
                  )}

                  {/* Safety Guidance Card on mobile */}
                  <div className="rounded-xl bg-slate-700/60 p-3 border border-slate-600/50 text-xs">
                    <div className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Immediate Safety Instructions:</span>
                    </div>
                    <ul className="space-y-1 text-slate-300">
                      {activeAlert.officialSafetyGuidance.slice(0, 2).map((guide, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span>•</span>
                          <span>{guide}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 my-auto">
                  <ShieldCheck className="h-10 w-10 text-emerald-400 mb-2 opacity-80" />
                  <div className="text-sm font-semibold text-slate-200">Zone Currently All-Clear</div>
                  <p className="text-xs text-slate-400 mt-1">
                    No emergency alerts match within {radiusKm}km of {userLocation.name}.
                  </p>
                </div>
              )}

              {/* Bottom bar of device */}
              <div className="pt-2 text-center">
                <div className="mx-auto h-1 w-28 rounded-full bg-slate-600" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
