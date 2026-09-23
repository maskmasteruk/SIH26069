import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import {
  Database,
  Layers,
  Cpu,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Shield,
  Smartphone,
  Eye,
  Play,
  ArrowDown,
  ArrowRight,
} from 'lucide-react';
import { DataSourceType } from '../../types';

export const ArchitecturePipelineView: React.FC = () => {
  const { events, rawFeed, simulateKafkaIngest } = useEvents();
  const [selectedNode, setSelectedNode] = useState<string>('kafka');

  // Compute live statistics for pipeline stages
  const rawPostsCount = rawFeed.length;
  const unverifiedPoolCount = events.filter((e) => e.status === 'unverified_pool').length;
  const assumedEventsCount = events.filter((e) => e.status === 'assumed_event').length;
  const adminReviewCount = events.filter((e) => e.status === 'admin_review').length;
  const verifiedEventsCount = events.filter((e) => e.status === 'verified_original').length;
  const fakeDebunkedCount = events.filter((e) => e.status === 'marked_fake').length;
  const misleadingCount = events.filter((e) => e.status === 'marked_misleading').length;

  const nodeDetails: Record<
    string,
    { title: string; subtitle: string; description: string; technical: string[] }
  > = {
    sources: {
      title: 'Data Sources Layer',
      subtitle: 'Multi-Source Geospatial Ingestion',
      description:
        'Continuous ingestion of multi-channel distress signals: X (Twitter) API v2, Instagram webhooks, Open-Meteo & IMD radar telemetry, RSS news feeds, accredited National Media wires, and citizen mobile reports.',
      technical: [
        'Keywords: #IMD, #IndiaWeather, #Rain, #Cyclone, #Flood, #Landslide',
        'Polling cadence: 60s for public social feeds, instantaneous for citizen mobile push',
        'National Media sources (PTI, ANI, DD News) flagged with high-trust cryptographic metadata for accelerated pipeline routing',
      ],
    },
    kafka: {
      title: 'Apache Kafka Ingestion Buffer',
      subtitle: 'Distributed Message Broker',
      description:
        'Decouples high-volume burst traffic during severe storm surges from processing consumers. Four dedicated partitions ensure zero message loss under 10,000+ msgs/sec loads.',
      technical: [
        'Topic: raw-social-stream (Partition 0 & 2 for social & image streams)',
        'Topic: weather-telemetry (Partition 1 for IMD AWS & Doppler sensors)',
        'Topic: citizen-reports (Partition 3 for on-ground citizen submissions)',
        'Topic: national-wire (High-trust labeled channel with bypass routing)',
      ],
    },
    processing: {
      title: 'Event Processing & ML Scoring',
      subtitle: 'Natural Language & Spatial Extraction Pipeline',
      description:
        'Multi-stage analysis extracting incident taxonomy, precise geocodes, public sentiment/distress levels, reverse-image EXIF metadata, and cross-post spatial clustering.',
      technical: [
        'Classification: Flash Flood, Severe Cyclone, Urban Waterlogging, Landslide, Heatwave',
        'Named Entity Recognition (NER) resolves Indian vernacular place names & landmarks',
        'Credibility Analysis evaluates account age, geo-IP consistency, and viral duplication',
        'Spatio-temporal clustering matches reports within 5km radius and 120-minute window',
      ],
    },
    database: {
      title: 'PostgreSQL Database (Events)',
      subtitle: 'Spatial DB & Cluster Deduplication',
      description:
        'Maintains stateful incident clusters. Evaluates if an incoming post matches an existing event cluster or represents a new unconfirmed disaster occurrence.',
      technical: [
        'YES -> Related Post: Appended to existing cluster, incrementing corroboration count',
        'NO -> Unverified Pool: Seeded as candidate incident with initial confidence score',
        'PostGIS spatial indexing with ST_DWithin queries for lightning-fast radius matching',
      ],
    },
    threshold: {
      title: 'Evidence & Time-Check Gate',
      subtitle: 'Review Logic Engine',
      description:
        'Automated decision gate preventing single unverified reports from triggering public panic, while ensuring rural single-report emergencies never get ignored.',
      technical: [
        'Sufficient evidence: Multiple independent posts within the cluster radius are promoted to ASSUMED EVENT',
        'Needs review / Time Limit Reached: Incidents without enough corroboration are forwarded to ADMIN REVIEW for human inspection',
        'Zero silent drops: Every report is either corroborated or reviewed by duty personnel',
      ],
    },
    admin_verification: {
      title: 'Admin Verification Desk',
      subtitle: 'State Operations Center Human-in-the-Loop',
      description:
        'Duty Officers review ML scores, inspect footage authenticity, and make final binding determinations on emergency status.',
      technical: [
        'Original: Certified authentic disaster -> Dispatched to public dashboards & mobile push',
        'Fake: Debunked hoax/rumor -> Marked with fact-check seal to prevent panic forwarding',
        'Misleading: Flagged recycled footage or out-of-context clips',
        'Modify Details: Adjust affected radius, severity, and responder dispatch',
      ],
    },
    verified_db: {
      title: 'Verified Events Database',
      subtitle: 'Authoritative Emergency Master Record',
      description:
        'Immutable audit log of verified active emergencies, relief instructions, and debunked hoaxes distributed to state response teams and civic portals.',
      technical: [
        'Direct ingress branch: High-trust National Media & IMD bulletins route directly here',
        'Powers downstream Public Dashboard, Responder Dispatch, and Mobile Alerts',
        'Audit trail records verifying officer credentials and timestamp',
      ],
    },
    outputs: {
      title: 'Public Dashboard & Mobile Alerts',
      subtitle: 'Community Protection & Real-Time Warning',
      description:
        'Omnichannel distribution delivering localized early warnings, evacuation routes, and safety guidance to citizens within the affected geofence.',
      technical: [
        'Geofenced Cell Broadcast SMS & Push notifications based on radius (5km - 50km)',
        'Interactive public GIS map showing active inundation zones & open relief shelters',
        'Direct citizen response loop with emergency contacts and NDRF assistance',
      ],
    },
  };

  const active = nodeDetails[selectedNode] || nodeDetails.kafka;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Disaster Early Warning & Verification Architecture
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Data Ingestion, Verification & Alert Pipeline
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
              Visualizes the exact implementation workflow from raw social/weather data ingestion to Kafka streaming, ML processing, evidence review, and mobile alert broadcasts.
            </p>
          </div>

          {/* Test Stream Ingestion Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Inject Stream Event:</span>
            <button
              onClick={() => simulateKafkaIngest('x', '#Rain')}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 transition-colors"
            >
              <Play className="h-3 w-3 text-slate-600" />
              <span>Simulate Tweet (#Rain)</span>
            </button>
            <button
              onClick={() => simulateKafkaIngest('weather_api', '#Cyclone')}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-800 transition-colors"
            >
              <Play className="h-3 w-3 text-slate-600" />
              <span>IMD Weather Telemetry</span>
            </button>
            <button
              onClick={() => simulateKafkaIngest('national_media', '#IMD')}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-emerald-800 transition-colors"
            >
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span>National Media (Bypass)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Flowchart Diagram */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
          Click any architectural node to view active state and operational specifications:
        </div>

        <div className="relative overflow-x-auto pb-4">
          <div className="min-w-[760px] space-y-4">
            {/* Row 1: Data Sources */}
            <div className="grid grid-cols-12 gap-4">
              <div
                onClick={() => setSelectedNode('sources')}
                className={`col-span-8 cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedNode === 'sources'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-amber-500" />
                    <span className="font-bold text-sm">DATA SOURCES</span>
                  </div>
                  <span className="text-xs font-mono font-semibold tabular-nums">
                    {rawPostsCount} in buffer
                  </span>
                </div>
                <div className="text-xs mt-1.5 opacity-85">
                  Instagram · X · Social Media · Weather APIs · News · National Media · Citizen Reports
                </div>
                <div className="text-xs font-mono opacity-70 mt-1">
                  Hashtags: #IMD · #IndiaWeather · #Rain · #Cyclone · #Flood
                </div>
              </div>

              {/* National Media Direct Branch */}
              <div
                onClick={() => setSelectedNode('verified_db')}
                className={`col-span-4 cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedNode === 'verified_db'
                    ? 'border-emerald-700 bg-emerald-900 text-white shadow-md'
                    : 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/60 text-emerald-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">National Media Source</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-xs mt-1 font-semibold">High-trust source / labeled source</div>
                <div className="text-xs opacity-75 mt-0.5 flex items-center gap-1">
                  <span>Direct bypass to Verified DB</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-start pl-32 text-slate-400">
              <ArrowDown className="h-4 w-4" />
            </div>

            {/* Row 2: Apache Kafka */}
            <div className="grid grid-cols-12 gap-4">
              <div
                onClick={() => setSelectedNode('kafka')}
                className={`col-span-8 cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedNode === 'kafka'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-amber-500" />
                    <span className="font-bold text-sm">APACHE KAFKA</span>
                  </div>
                  <span className="text-xs font-mono">4 Partitions Active</span>
                </div>
                <div className="text-xs opacity-80 mt-1">
                  Streaming Message Bus: Topics: <code className="font-mono">raw-social-stream</code>, <code className="font-mono">weather-telemetry</code>, <code className="font-mono">citizen-reports</code>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-start pl-32 text-slate-400">
              <ArrowDown className="h-4 w-4" />
            </div>

            {/* Row 3: Event Processing */}
            <div className="grid grid-cols-12 gap-4">
              <div
                onClick={() => setSelectedNode('processing')}
                className={`col-span-8 cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedNode === 'processing'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-amber-500" />
                    <span className="font-bold text-sm">EVENT PROCESSING</span>
                  </div>
                  <span className="text-xs font-mono text-emerald-600 font-semibold">Running</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs mt-2 opacity-85 font-mono">
                  <span>• Event Classification</span>
                  <span>• Location/Time Extraction</span>
                  <span>• Sentiment Analysis</span>
                  <span>• Credibility Analysis</span>
                  <span>• Duplicate/Event Match</span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-start pl-32 text-slate-400">
              <ArrowDown className="h-4 w-4" />
            </div>

            {/* Row 4: PostgreSQL & Existing Event Decision */}
            <div className="grid grid-cols-12 gap-4">
              <div
                onClick={() => setSelectedNode('database')}
                className={`col-span-8 cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedNode === 'database'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">POSTGRESQL DATABASE (EVENTS)</span>
                  <span className="text-xs font-mono">{events.length} Master Clusters</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/40">
                  <div className="p-2 rounded bg-white/10 border border-slate-200/20">
                    <div className="font-bold text-xs text-amber-500">YES: RELATED POST</div>
                    <div className="text-xs opacity-75">Link with existing cluster</div>
                  </div>
                  <div className="p-2 rounded bg-white/10 border border-slate-200/20">
                    <div className="font-bold text-xs text-blue-400">NO: UNVERIFIED POOL</div>
                    <div className="text-xs opacity-75">Seed new event candidate ({unverifiedPoolCount} pending)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-start pl-32 text-slate-400">
              <ArrowDown className="h-4 w-4" />
            </div>

            {/* Row 5: Evidence / Time Check */}
            <div className="grid grid-cols-12 gap-4">
              <div
                onClick={() => setSelectedNode('threshold')}
                className={`col-span-8 cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedNode === 'threshold'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">EVIDENCE / TIME CHECK</span>
                  <span className="text-xs font-mono font-semibold">Review Logic</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30">
                    <div className="font-bold text-xs text-amber-700">ENOUGH EVIDENCE</div>
                    <div className="text-xs font-semibold mt-0.5">ASSUMED EVENT ({assumedEventsCount})</div>
                    <div className="text-xs text-slate-500 mt-0.5">Visible to public as assumed alert</div>
                  </div>
                  <div className="p-2 rounded bg-slate-500/10 border border-slate-500/30">
                    <div className="font-bold text-xs text-slate-700">NEEDS REVIEW / TIMEOUT</div>
                    <div className="text-xs font-semibold mt-0.5">ADMIN REVIEW ({adminReviewCount})</div>
                    <div className="text-xs text-slate-500 mt-0.5">Human triage so no incident is missed</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-start pl-32 text-slate-400">
              <ArrowDown className="h-4 w-4" />
            </div>

            {/* Row 6: Admin Verification */}
            <div className="grid grid-cols-12 gap-4">
              <div
                onClick={() => setSelectedNode('admin_verification')}
                className={`col-span-8 cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedNode === 'admin_verification'
                    ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-500" />
                    <span className="font-bold text-sm">ADMIN VERIFICATION</span>
                  </div>
                  <span className="text-xs font-mono">Operations Console</span>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2 text-xs font-semibold text-center">
                  <div className="p-1.5 rounded bg-emerald-100 text-emerald-900">Original</div>
                  <div className="p-1.5 rounded bg-red-100 text-red-900">Fake</div>
                  <div className="p-1.5 rounded bg-amber-100 text-amber-900">Misleading</div>
                  <div className="p-1.5 rounded bg-slate-100 text-slate-900">Modify Details</div>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-start pl-32 text-slate-400">
              <ArrowDown className="h-4 w-4" />
            </div>

            {/* Row 7: Verified Events Database */}
            <div className="grid grid-cols-12 gap-4">
              <div
                onClick={() => setSelectedNode('verified_db')}
                className={`col-span-8 cursor-pointer rounded-xl border p-4 transition-all ${
                  selectedNode === 'verified_db'
                    ? 'border-emerald-700 bg-emerald-900 text-white shadow-md'
                    : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-950'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-emerald-600" />
                    <span className="font-bold text-sm">VERIFIED EVENTS DATABASE</span>
                  </div>
                  <span className="text-xs font-mono font-bold tabular-nums">
                    {verifiedEventsCount} Verified Active · {fakeDebunkedCount} Debunked
                  </span>
                </div>
                <div className="text-xs mt-1 text-emerald-800">
                  Receives both Admin verified events and high-trust national media direct inputs.
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-start pl-32 text-slate-400">
              <ArrowDown className="h-4 w-4" />
            </div>

            {/* Row 8: Consumers (Admin Dashboard vs Public Dashboard & Mobile Alerts) */}
            <div className="grid grid-cols-12 gap-4">
              <div
                onClick={() => setSelectedNode('admin_verification')}
                className="col-span-4 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition-colors"
              >
                <div className="font-bold text-sm text-slate-900">ADMIN DASHBOARD</div>
                <ul className="text-xs text-slate-600 mt-1.5 space-y-1">
                  <li>• All events overview</li>
                  <li>• ML scores & confidence logs</li>
                  <li>• Verify / Modify parameters</li>
                </ul>
              </div>

              <div
                onClick={() => setSelectedNode('outputs')}
                className="col-span-8 cursor-pointer rounded-xl border border-amber-200 bg-amber-50/80 p-4 hover:bg-amber-100/60 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-slate-900">PUBLIC DASHBOARD</div>
                  <span className="text-xs font-semibold text-amber-800">Citizen Portal</span>
                </div>
                <div className="text-xs text-slate-700 mt-1">
                  Verified / Assumed public events feed, interactive GIS incident map, emergency relief directory.
                </div>
                <div className="mt-3 pt-2 border-t border-amber-200 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-xs text-amber-950">
                    <Smartphone className="h-4 w-4 text-amber-700" />
                    <span>MOBILE ALERTS: Nearby / location-based notifications</span>
                  </div>
                  <span className="text-xs text-amber-800 font-mono">Geofenced</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Node Details Drawer */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              {active.subtitle}
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">{active.title}</h3>
          </div>
          <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
            WAVE Technical Specification
          </span>
        </div>

        <p className="text-xs text-slate-600 mt-2 leading-relaxed">{active.description}</p>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Engineering & Operational Implementation Details:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {active.technical.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
