import React from 'react';
import { useEvents } from '../../context/EventContext';

export const AdminAnalytics: React.FC = () => {
  const { events, rawFeed } = useEvents();

  const sourceBreakdown = [
    { name: 'National News Wire', weight: 99, count: 18, sharePct: 15 },
    { name: 'IMD Radar & Weather Telemetry', weight: 98, count: 34, sharePct: 28 },
    { name: 'Citizen Ground Reports', weight: 88, count: 42, sharePct: 35 },
    { name: 'Social Media Signal Pool', weight: 64, count: 128, sharePct: 80 },
  ];

  const categoryBreakdown = [
    { label: 'Urban Waterlogging & Drainage', count: events.filter((e) => e.category === 'urban_waterlogging').length, pct: 40 },
    { label: 'Severe Cyclonic Storms', count: events.filter((e) => e.category === 'severe_cyclone').length, pct: 25 },
    { label: 'Flash Floods & Inundation', count: events.filter((e) => e.category === 'flash_flood').length, pct: 20 },
    { label: 'Landslide & Slope Slippage', count: events.filter((e) => e.category === 'landslide').length, pct: 10 },
    { label: 'Extreme Heatwave Conditions', count: events.filter((e) => e.category === 'extreme_heatwave').length, pct: 5 },
  ];

  return (
    <div className="space-y-10">
      {/* 1. Header with Page Title & Context */}
      <div className="border-b border-slate-200/80 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Telemetry &amp; Analytics
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Pipeline processing velocity, machine learning extraction confidence, and multi-source credibility distributions.
        </p>
      </div>

      {/* 2. Simple Lightweight Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-1">
        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">Mean Verification Latency</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            12.4m
          </div>
          <div className="text-xs text-slate-400">-2.1m from last period</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">Cluster Promotion Rate</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            86.2%
          </div>
          <div className="text-xs text-slate-400">Reached threshold ≥ 5</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">NLP Hazard Accuracy</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            94.1%
          </div>
          <div className="text-xs text-slate-400">Named entity extraction F1</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-slate-500">Corroboration Factor</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-slate-900 tabular-nums">
            4.2x
          </div>
          <div className="text-xs text-slate-400">Avg independent sources</div>
        </div>
      </div>

      {/* 3. Primary Decision Support Chart: Ingestion Source Weights */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-slate-900">
            Source Ingestion Distribution &amp; Algorithmic Trust Weights
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Weight values dictate autonomous corroboration multipliers in Kafka event clustering.
          </p>
        </div>

        <div className="border border-slate-200 rounded-md bg-white p-5 space-y-4">
          {sourceBreakdown.map((item) => (
            <div key={item.name} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-800">{item.name}</span>
                <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
                  <span>Weight: {item.weight}/100</span>
                  <span>·</span>
                  <span>{item.count} items</span>
                </div>
              </div>

              {/* Minimal, single-color progress bar */}
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-800 rounded-full"
                  style={{ width: `${item.weight}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Hazard Category Breakdown: Flat Table */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-medium text-slate-900">
            Hazard Category Distribution
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Active disaster events grouped by civil defense classification.
          </p>
        </div>

        <div className="border border-slate-200 rounded-md bg-white overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-medium">
                <th className="py-2.5 px-4 font-normal">Disaster Category</th>
                <th className="py-2.5 px-4 font-normal text-right">Active Clusters</th>
                <th className="py-2.5 px-4 font-normal text-right">National Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categoryBreakdown.map((item) => (
                <tr key={item.label} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 text-slate-800 font-medium">
                    {item.label}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700 tabular-nums">
                    {item.count}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-500 tabular-nums">
                    {item.pct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
