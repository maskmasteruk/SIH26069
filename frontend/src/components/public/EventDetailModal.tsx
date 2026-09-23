import React from 'react';
import { DisasterEvent } from '../../types';
import {
  X,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Phone,
  Clock,
  Radio,
  FileText,
  LifeBuoy,
  Layers,
  Share2,
} from 'lucide-react';

interface EventDetailModalProps {
  event: DisasterEvent | null;
  onClose: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onClose }) => {
  if (!event) return null;

  const isCritical = event.severity === 'Critical';
  const isVerified = event.status === 'verified_original';
  const isAssumed = event.status === 'assumed_event';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div
          className={`p-5 sm:p-6 text-white flex items-start justify-between ${
            isCritical
              ? 'bg-gradient-to-r from-red-700 to-red-800'
              : 'bg-gradient-to-r from-amber-600 to-amber-700'
          }`}
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="bg-white/20 px-2 py-0.5 rounded uppercase font-semibold">
                {event.category.replace('_', ' ')}
              </span>
              <span className="text-white/80">
                {event.lastUpdatedAt}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold leading-tight pt-1">
              {event.title}
            </h3>

            <div className="flex items-center gap-1.5 text-xs text-white/90">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {event.location.name}, {event.location.district} ({event.location.state})
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto font-sans">
          {/* Status & Corroboration Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Verification Status</div>
              <div className="mt-1 flex items-center gap-1.5 text-sm font-bold">
                {isVerified ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-700">Verified by EOC</span>
                  </>
                ) : isAssumed ? (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-amber-700">Assumed Alert</span>
                  </>
                ) : (
                  <span className="text-slate-700">Under Review</span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Corroboration Signals</div>
              <div className="mt-1 text-sm font-bold text-slate-900 font-mono">
                {event.relatedPostsCount} Independent Reports
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500">Impact Radius</div>
              <div className="mt-1 text-sm font-bold text-slate-900 font-mono">
                {event.affectedRadiusKm} km Geofence
              </div>
            </div>
          </div>

          {/* Media Image if available */}
          {event.mediaUrls && event.mediaUrls.length > 0 && (
            <div className="relative rounded-xl overflow-hidden bg-slate-100 max-h-56">
              <img
                src={event.mediaUrls[0]}
                alt={event.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-2 right-3 text-xs font-mono text-white/90 bg-black/60 px-2 py-0.5 rounded">
                Verified Ground Media
              </div>
            </div>
          )}

          {/* Full Narrative Description */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-slate-600" />
              <span>Detailed Incident Description</span>
            </h4>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-200">
              {event.summary}
            </p>
          </div>

          {/* Key Situation Highlights */}
          {event.keyHighlights && event.keyHighlights.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Situation Bulletins & Field Highlights
              </h4>
              <ul className="space-y-2">
                {event.keyHighlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Official Safety Guidance for Citizens */}
          {event.officialSafetyGuidance && event.officialSafetyGuidance.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                <LifeBuoy className="h-4 w-4 text-amber-700" />
                <span>Recommended Citizen Safety Guidance</span>
              </h4>
              <ul className="space-y-1.5">
                {event.officialSafetyGuidance.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-amber-900">
                    <span className="font-bold text-amber-700">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Direct Incident Emergency Contacts */}
          {event.emergencyContacts && event.emergencyContacts.length > 0 && (
            <div className="pt-2 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-slate-600" />
                <span>Emergency Contacts for this Sector</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {event.emergencyContacts.map((contact, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">{contact.name}</div>
                      <div className="text-xs text-slate-500">{contact.role}</div>
                    </div>
                    <a
                      href={`tel:${contact.phone}`}
                      className="px-2.5 py-1 text-xs font-bold font-mono bg-slate-900 text-white rounded hover:bg-slate-800 transition-colors"
                    >
                      {contact.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
            <Clock className="h-3.5 w-3.5" />
            <span>First Reported: {event.firstReportedAt}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
