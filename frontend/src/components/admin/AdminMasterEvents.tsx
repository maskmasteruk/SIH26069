import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { DisasterEvent } from '../../types';
import { AdminVerificationModal } from './AdminVerificationModal';
import { Search, Download } from 'lucide-react';

export const AdminMasterEvents: React.FC = () => {
  const { events } = useEvents();
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [inspectingEvent, setInspectingEvent] = useState<DisasterEvent | null>(null);

  const filtered = events.filter((evt) => {
    const matchesSearch =
      evt.title.toLowerCase().includes(search.toLowerCase()) ||
      evt.id.toLowerCase().includes(search.toLowerCase()) ||
      evt.location.name.toLowerCase().includes(search.toLowerCase()) ||
      evt.location.state.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      selectedStatus === 'all' || evt.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    const headers =
      'Event ID,Title,Category,Severity,Location,State,Related Posts,Status,Credibility,Urgency\n';
    const rows = events
      .map(
        (e) =>
          `"${e.id}","${e.title.replace(/"/g, '""')}","${e.category}","${e.severity}","${e.location.name}","${e.location.state}",${e.relatedPostsCount},"${e.status}",${e.mlScores.credibilityScore},${e.mlScores.urgencySentiment}`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wave-master-events-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const verifiedCount = events.filter((e) => e.status === 'verified_original').length;
  const assumedCount = events.filter((e) => e.status === 'assumed_event').length;

  return (
    <div className="space-y-8">
      {/* 1. Header with Page Title & Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Master Events
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Authoritative master records of all consolidated disaster events across India.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-md transition-colors cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-slate-500" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* 2. Simple Metric Row (No floating cards) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-1">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">Total Clusters</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            {events.length}
          </div>
          <div className="text-xs text-slate-400">Recorded incidents</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">Verified Original</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            {verifiedCount}
          </div>
          <div className="text-xs text-slate-400">Officer authenticated</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">Threshold Met (≥ 5)</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            {assumedCount}
          </div>
          <div className="text-xs text-slate-400">Awaiting sign-off</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">Monitored States</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            {new Set(events.map((e) => e.location.state)).size}
          </div>
          <div className="text-xs text-slate-400">Active regional desks</div>
        </div>
      </div>

      {/* 3. Search & Filter Bar (Quiet, integrated) */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by event title, ID, or location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-200 bg-white placeholder-slate-400 focus:outline-hidden focus:border-slate-400 text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 whitespace-nowrap">Status:</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:border-slate-400 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="verified_original">Verified</option>
            <option value="assumed_event">Assumed (≥5)</option>
            <option value="admin_review">Review Timeout</option>
            <option value="unverified_pool">Unverified Pool</option>
            <option value="marked_fake">Debunked Fake</option>
          </select>
        </div>
      </div>

      {/* 4. Main Operational Data Table */}
      <div className="border border-slate-200 rounded-md bg-white overflow-x-auto">
        {filtered.length > 0 ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-medium">
                <th className="py-2.5 px-4 font-normal">ID</th>
                <th className="py-2.5 px-4 font-normal">Event Title</th>
                <th className="py-2.5 px-4 font-normal">Region</th>
                <th className="py-2.5 px-4 font-normal">Category</th>
                <th className="py-2.5 px-4 font-normal text-right">Posts</th>
                <th className="py-2.5 px-4 font-normal text-right">Credibility</th>
                <th className="py-2.5 px-4 font-normal">Status</th>
                <th className="py-2.5 px-4 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((evt) => (
                <tr
                  key={evt.id}
                  onClick={() => setInspectingEvent(evt)}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                >
                  <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                    {evt.id}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 max-w-xs truncate">
                    {evt.title}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {evt.location.name}
                  </td>
                  <td className="py-3 px-4 text-slate-600 capitalize">
                    {evt.category.replace('_', ' ')}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums">
                    {evt.relatedPostsCount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums">
                    {evt.mlScores.credibilityScore}%
                  </td>
                  <td className="py-3 px-4">
                    {evt.status === 'verified_original' && (
                      <span className="inline-flex items-center gap-1.5 text-slate-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        <span>Verified</span>
                      </span>
                    )}
                    {evt.status === 'assumed_event' && (
                      <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <span>Assumed (≥5)</span>
                      </span>
                    )}
                    {evt.status === 'admin_review' && (
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        <span>Review</span>
                      </span>
                    )}
                    {evt.status === 'unverified_pool' && (
                      <span className="inline-flex items-center gap-1.5 text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                        <span>Unverified</span>
                      </span>
                    )}
                    {evt.status === 'marked_fake' && (
                      <span className="inline-flex items-center gap-1.5 text-red-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                        <span>Fake</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingEvent(evt);
                      }}
                      className="px-2.5 py-1 text-xs border border-slate-200 hover:border-slate-300 rounded text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center text-xs text-slate-500">
            No events match the current filter criteria.
          </div>
        )}
      </div>

      <AdminVerificationModal
        event={inspectingEvent}
        isOpen={!!inspectingEvent}
        onClose={() => setInspectingEvent(null)}
      />
    </div>
  );
};
