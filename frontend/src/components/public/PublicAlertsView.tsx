import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { DisasterEvent } from '../../types';
import {
  ShieldCheck,
  AlertTriangle,
  FileQuestion,
  MapPin,
  Clock,
  Phone,
  Send,
  Navigation,
} from 'lucide-react';

export const PublicAlertsView: React.FC = () => {
  const { events, setSelectedEvent } = useEvents();
  const [activeFilter, setActiveFilter] = useState<'all' | 'verified' | 'assumed'>('all');

  const publicEvents = events.filter((e) => {
    if (activeFilter === 'verified') return e.status === 'verified_original';
    if (activeFilter === 'assumed') return e.status === 'assumed_event';
    return (
      e.status === 'verified_original' ||
      e.status === 'assumed_event' ||
      e.status === 'marked_fake'
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-red-700 uppercase tracking-wider">
            Public Emergency Advisories
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Active Citizen Early Warnings & Incident Advisories
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time verified bulletins and public early warnings with official safety guidance and helpline numbers.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Active Advisories ({publicEvents.length})
          </button>
          <button
            onClick={() => setActiveFilter('verified')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeFilter === 'verified'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Officially Verified
          </button>
          <button
            onClick={() => setActiveFilter('assumed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              activeFilter === 'assumed'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Assumed Alerts
          </button>
        </div>
      </div>

      {/* Advisories Feed */}
      <div className="space-y-5">
        {publicEvents.map((evt) => {
          const isVerified = evt.status === 'verified_original';
          const isAssumed = evt.status === 'assumed_event';
          const isFake = evt.status === 'marked_fake';

          return (
            <div
              key={evt.id}
              className={`rounded-xl border p-6 bg-white shadow-xs transition-all ${
                isVerified
                  ? 'border-emerald-200'
                  : isAssumed
                  ? 'border-amber-200'
                  : 'border-red-200'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-3 flex-1">
                  {/* Status Banner */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                    <span className="font-semibold text-slate-800">{evt.location.name}, {evt.location.state}</span>
                    <span>·</span>
                    <span>Updated {evt.lastUpdatedAt}</span>
                    <span>·</span>
                    <span className="text-slate-600">
                      Corroboration: {evt.relatedPostsCount} reports
                    </span>
                  </div>

                  <h2 className="text-lg font-bold text-slate-900">
                    {evt.title}
                  </h2>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {evt.summary}
                  </p>

                  {/* Safety Guidance Box */}
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Civil Defense Instructions for Affected Residents:</span>
                    </div>
                    <ul className="space-y-1">
                      {evt.officialSafetyGuidance.map((g, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-slate-600">
                          <span className="text-slate-400">•</span>
                          <span>{g}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Emergency Contacts */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {evt.emergencyContacts.map((c, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-100 text-xs text-slate-800"
                      >
                        <span className="font-medium">{c.name}:</span>
                        <a
                          href={`tel:${c.phone}`}
                          className="font-mono font-bold text-amber-800 hover:underline"
                        >
                          {c.phone}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right Status Badge & Radius */}
                <div className="flex flex-col items-start md:items-end gap-2 md:text-right min-w-[180px]">
                  {isVerified ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>Verified Event</span>
                    </div>
                  ) : isAssumed ? (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span>Assumed Alert</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-800 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                      <FileQuestion className="h-4 w-4 text-red-600" />
                      <span>Debunked Fake</span>
                    </div>
                  )}

                  <div className="text-xs text-slate-500 font-mono">
                    Affected Radius: <strong className="text-slate-800">{evt.affectedRadiusKm} km</strong>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    Severity: <strong className="text-slate-800">{evt.severity}</strong>
                  </div>

                  <button
                    onClick={() => setSelectedEvent(evt)}
                    className="mt-2 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                  >
                    View Cluster Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
