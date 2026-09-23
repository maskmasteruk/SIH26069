import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { DisasterEvent } from '../../types';
import { AdminVerificationModal } from './AdminVerificationModal';
import {
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Filter,
  CheckCircle,
} from 'lucide-react';

export const AdminTriageQueue: React.FC = () => {
  const { events } = useEvents();
  const [activeQueueTab, setActiveQueueTab] = useState<
    'assumed' | 'timeout' | 'unverified' | 'all'
  >('assumed');
  const [inspectingEvent, setInspectingEvent] = useState<DisasterEvent | null>(null);

  // Groupings
  const assumedEvents = events.filter((e) => e.status === 'assumed_event');
  const timeoutEvents = events.filter((e) => e.status === 'admin_review');
  const unverifiedEvents = events.filter((e) => e.status === 'unverified_pool');
  const verifiedCount = events.filter((e) => e.status === 'verified_original').length;

  const currentList =
    activeQueueTab === 'assumed'
      ? assumedEvents
      : activeQueueTab === 'timeout'
      ? timeoutEvents
      : activeQueueTab === 'unverified'
      ? unverifiedEvents
      : events;

  return (
    <div className="space-y-10">
      {/* 1. Page Header with Title & Contextual Description */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Incident Triage
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review algorithmic cluster promotions, verify field authenticity, and authorize public advisories.
          </p>
        </div>

        {assumedEvents.length > 0 && (
          <button
            onClick={() => setInspectingEvent(assumedEvents[0])}
            className="self-start sm:self-auto px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
          >
            Review Priority Incident
          </button>
        )}
      </div>

      {/* 2. Important Metrics: Flat Horizontal Arrangement (No floating cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-2">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Awaiting Review
          </div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            {assumedEvents.length}
          </div>
          <div className="text-xs text-slate-400">
            Corroboration threshold ≥ 5
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Timeout Elapsed
          </div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            {timeoutEvents.length}
          </div>
          <div className="text-xs text-slate-400">
            45m low-volume protection
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Unverified Inflow
          </div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            {unverifiedEvents.length}
          </div>
          <div className="text-xs text-slate-400">
            Accumulating field signals
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">
            Active Verified
          </div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            {verifiedCount}
          </div>
          <div className="text-xs text-slate-400">
            Transmitted to public frame
          </div>
        </div>
      </div>

      {/* 3. Main Operational Table Section */}
      <div className="space-y-4">
        {/* Navigation Tabs (Quiet, typography-driven) */}
        <div className="flex items-center gap-6 border-b border-slate-200 text-xs">
          <button
            onClick={() => setActiveQueueTab('assumed')}
            className={`pb-2.5 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
              activeQueueTab === 'assumed'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Assumed Clusters ({assumedEvents.length})
          </button>

          <button
            onClick={() => setActiveQueueTab('timeout')}
            className={`pb-2.5 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
              activeQueueTab === 'timeout'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Timeouts &amp; Review ({timeoutEvents.length})
          </button>

          <button
            onClick={() => setActiveQueueTab('unverified')}
            className={`pb-2.5 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
              activeQueueTab === 'unverified'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Unverified Pool ({unverifiedEvents.length})
          </button>

          <button
            onClick={() => setActiveQueueTab('all')}
            className={`pb-2.5 font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
              activeQueueTab === 'all'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            All Events ({events.length})
          </button>
        </div>

        {/* Data Table */}
        <div className="border border-slate-200 rounded-md bg-white overflow-x-auto">
          {currentList.length > 0 ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-medium">
                  <th className="py-2.5 px-4 font-normal">Incident</th>
                  <th className="py-2.5 px-4 font-normal">Category</th>
                  <th className="py-2.5 px-4 font-normal text-right">Corroboration</th>
                  <th className="py-2.5 px-4 font-normal text-right">ML Credibility</th>
                  <th className="py-2.5 px-4 font-normal">Status</th>
                  <th className="py-2.5 px-4 font-normal text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentList.map((evt) => {
                  const isAssumed = evt.status === 'assumed_event';
                  const isVerified = evt.status === 'verified_original';
                  const isTimeout = evt.status === 'admin_review';
                  const isFake = evt.status === 'marked_fake';
                  const isMisleading = evt.status === 'marked_misleading';

                  return (
                    <tr
                      key={evt.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setInspectingEvent(evt)}
                    >
                      {/* Title & Location */}
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
                          {evt.location.name}, {evt.location.state}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-slate-600 capitalize">
                        {evt.category.replace('_', ' ')}
                      </td>

                      {/* Corroboration */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span
                          className={
                            evt.relatedPostsCount >= 5
                              ? 'text-slate-900 font-semibold'
                              : 'text-slate-500'
                          }
                        >
                          {evt.relatedPostsCount} / 5
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {evt.relatedPostsCount >= 5 ? 'Threshold met' : 'Accumulating'}
                        </div>
                      </td>

                      {/* ML Credibility */}
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span
                          className={
                            evt.mlScores.credibilityScore >= 70
                              ? 'text-slate-900 font-semibold'
                              : 'text-slate-600'
                          }
                        >
                          {evt.mlScores.credibilityScore}%
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {evt.mlScores.urgencySentiment}% urgency
                        </div>
                      </td>

                      {/* Status: Small, quiet text indicator */}
                      <td className="py-3 px-4">
                        {isVerified && (
                          <span className="inline-flex items-center gap-1.5 text-slate-700 text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            <span>Verified</span>
                          </span>
                        )}
                        {isAssumed && (
                          <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            <span>Assumed (≥5)</span>
                          </span>
                        )}
                        {isTimeout && (
                          <span className="inline-flex items-center gap-1.5 text-slate-700 text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            <span>Timeout Review</span>
                          </span>
                        )}
                        {evt.status === 'unverified_pool' && (
                          <span className="inline-flex items-center gap-1.5 text-slate-500 text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                            <span>Unverified</span>
                          </span>
                        )}
                        {isFake && (
                          <span className="inline-flex items-center gap-1.5 text-red-700 text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                            <span>Debunked Fake</span>
                          </span>
                        )}
                        {isMisleading && (
                          <span className="inline-flex items-center gap-1.5 text-slate-700 text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-700" />
                            <span>Misleading</span>
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInspectingEvent(evt);
                          }}
                          className="px-2.5 py-1 text-xs border border-slate-200 hover:border-slate-300 rounded text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500 space-y-1">
              <div className="font-medium text-slate-700">Queue is clear</div>
              <p>No incidents currently require review in this view.</p>
            </div>
          )}
        </div>
      </div>

      {/* Verification Modal Dialog */}
      <AdminVerificationModal
        event={inspectingEvent}
        isOpen={!!inspectingEvent}
        onClose={() => setInspectingEvent(null)}
      />
    </div>
  );
};
