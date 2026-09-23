import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { Send } from 'lucide-react';

export const AdminVerifiedDatabase: React.FC = () => {
  const { events, dispatchMobileAlert } = useEvents();
  const [filterType, setFilterType] = useState<'all' | 'verified' | 'debunked'>('all');

  const verifiedList = events.filter(
    (e) =>
      e.status === 'verified_original' ||
      e.status === 'marked_fake' ||
      e.status === 'marked_misleading'
  );

  const displayedList = verifiedList.filter((e) => {
    if (filterType === 'verified') return e.status === 'verified_original';
    if (filterType === 'debunked')
      return e.status === 'marked_fake' || e.status === 'marked_misleading';
    return true;
  });

  const verifiedOriginals = events.filter((e) => e.status === 'verified_original');
  const debunkedCount = events.filter(
    (e) => e.status === 'marked_fake' || e.status === 'marked_misleading'
  ).length;

  return (
    <div className="space-y-8">
      {/* 1. Header with Page Title & Context */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Verified &amp; Debunked
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Authoritative registry of authenticated disaster notices and certified misinformation debunks.
          </p>
        </div>
      </div>

      {/* 2. Flat Horizontal Telemetry Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-1">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">Authenticated Events</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            {verifiedOriginals.length}
          </div>
          <div className="text-xs text-slate-400">Public map active</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">Certified Debunked</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            {debunkedCount}
          </div>
          <div className="text-xs text-slate-400">Rumors neutralized</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">Citizen Alerts Dispatched</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            {events.filter((e) => e.mobileAlertDispatched).length}
          </div>
          <div className="text-xs text-slate-400">Geofenced broadcasts</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">Critical Warnings</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            {events.filter((e) => e.severity === 'Critical').length}
          </div>
          <div className="text-xs text-slate-400">Life-safety priority</div>
        </div>
      </div>

      {/* 3. Operational Table */}
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-6 border-b border-slate-200 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`pb-2.5 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
              filterType === 'all'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            All Records ({verifiedList.length})
          </button>
          <button
            onClick={() => setFilterType('verified')}
            className={`pb-2.5 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
              filterType === 'verified'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Verified Dispatches ({verifiedOriginals.length})
          </button>
          <button
            onClick={() => setFilterType('debunked')}
            className={`pb-2.5 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
              filterType === 'debunked'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Certified Debunks ({debunkedCount})
          </button>
        </div>

        <div className="border border-slate-200 rounded-md bg-white overflow-x-auto">
          {displayedList.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-medium">
                  <th className="py-2.5 px-4 font-normal">Incident</th>
                  <th className="py-2.5 px-4 font-normal">Classification</th>
                  <th className="py-2.5 px-4 font-normal">Audit Trail / Notes</th>
                  <th className="py-2.5 px-4 font-normal">Broadcast Status</th>
                  <th className="py-2.5 px-4 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedList.map((evt) => {
                  const isOriginal = evt.status === 'verified_original';
                  const isFake = evt.status === 'marked_fake';
                  const isMisleading = evt.status === 'marked_misleading';

                  return (
                    <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 text-[11px]">
                            {evt.id}
                          </span>
                          <span className="font-medium text-slate-900 truncate max-w-sm">
                            {evt.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {evt.location.name} · {evt.location.state}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        {isOriginal && (
                          <span className="inline-flex items-center gap-1.5 text-slate-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            <span>Verified Authentic</span>
                          </span>
                        )}
                        {isFake && (
                          <span className="inline-flex items-center gap-1.5 text-red-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                            <span>Certified Debunked</span>
                          </span>
                        )}
                        {isMisleading && (
                          <span className="inline-flex items-center gap-1.5 text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                            <span>Misleading Context</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate text-[11px]">
                        {evt.adminNotes || 'Verified against sensor array and field telemetry.'}
                      </td>

                      <td className="py-3 px-4">
                        {evt.mobileAlertDispatched ? (
                          <span className="text-slate-600 text-[11px] font-mono">
                            Dispatched ({evt.affectedRadiusKm}km)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">
                            Standard Portal Only
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isOriginal && !evt.mobileAlertDispatched && (
                          <button
                            onClick={() => dispatchMobileAlert(evt.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs border border-slate-200 hover:border-slate-300 rounded text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <Send className="h-3 w-3 text-slate-500" />
                            <span>Send Alert</span>
                          </button>
                        )}
                        {evt.mobileAlertDispatched && (
                          <span className="text-[11px] text-slate-500">Sent</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              No records found in this category.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
