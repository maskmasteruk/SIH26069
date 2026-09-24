import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { IncidentCategory, IncidentSeverity } from '../../types';
import { LifeBuoy, Camera, Send, CheckCircle2, ShieldCheck, MapPin } from 'lucide-react';

export const CitizenReportPage: React.FC = () => {
  const { submitCitizenReport, navigate } = useEvents();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('urban_waterlogging');
  const [severity, setSeverity] = useState<IncidentSeverity>('Severe');
  const [locationName, setLocationName] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [reporterName, setReporterName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [immediateRescueNeeded, setImmediateRescueNeeded] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !locationName) return;

    const saved = await submitCitizenReport({
      title,
      description,
      category,
      severity: immediateRescueNeeded ? 'Critical' : severity,
      locationName,
      district: district || locationName,
      state,
      reporterName: reporterName || 'Anonymous Resident',
      contactNumber: contactNumber || 'Not provided',
      imageFile: mediaUrl.trim() || undefined,
      immediateRescueNeeded,
    });

    if (!saved) return;
    setSubmitted(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
          Community Engagement & Ground Reporting
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">
          Submit Citizen Weather & Disaster Report
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Your ground observation is ingested into our Apache Kafka message stream, correlated with spatial clusters in PostgreSQL, and alerted to disaster authorities.
        </p>
      </div>

      {submitted ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-4 shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            Report Successfully Ingested into Pipeline
          </h2>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Thank you for reporting. Your input has been assigned topic <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">citizen-reports</code> in Apache Kafka. If 5 corroborations are gathered in this zone, an Assumed Event early warning will be promoted automatically.
          </p>
          <div className="pt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setSubmitted(false);
                setTitle('');
                setDescription('');
                setLocationName('');
                setMediaUrl('');
              }}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Submit Another Report
            </button>
            <button
              onClick={() => navigate('/map')}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              View on Live Incident Map
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 md:p-8 space-y-6 shadow-xs">
          {/* Rescue Switch */}
          <div
            onClick={() => setImmediateRescueNeeded(!immediateRescueNeeded)}
            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
              immediateRescueNeeded
                ? 'border-red-400 bg-red-50 text-red-900 ring-2 ring-red-200'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <input
              type="checkbox"
              checked={immediateRescueNeeded}
              onChange={() => {}}
              className="mt-0.5 h-4 w-4 rounded text-red-600 accent-red-600 cursor-pointer"
            />
            <div className="text-xs">
              <div className="font-bold text-sm">
                Critical Distress: Immediate Rescue or Evacuation Needed
              </div>
              <p className="opacity-90 mt-0.5">
                Check this if senior citizens, children, or stranded families require boat or rope rescue. Escalates sentiment urgency score to 95%.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Incident Headline / Observation *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Flooding near bus depot, water reached waist level"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-slate-900 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Incident Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs bg-white focus:border-slate-900 focus:outline-hidden"
                >
                  <option value="urban_waterlogging">Urban Waterlogging</option>
                  <option value="flash_flood">Flash Flood</option>
                  <option value="severe_cyclone">Severe Cyclone / Wind Damage</option>
                  <option value="landslide">Landslide / Soil Slump</option>
                  <option value="heavy_thunderstorm">Heavy Thunderstorm / Lightning</option>
                  <option value="extreme_heatwave">Extreme Heatwave</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimated Severity Level
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                  disabled={immediateRescueNeeded}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs bg-white focus:border-slate-900 focus:outline-hidden disabled:bg-slate-100"
                >
                  <option value="Critical">Critical (Threat to life)</option>
                  <option value="Severe">Severe (Major disruption)</option>
                  <option value="Moderate">Moderate (Localized damage)</option>
                  <option value="Advisory">Advisory (Early warning)</option>
                </select>
              </div>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  State *
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs bg-white focus:border-slate-900 focus:outline-hidden"
                >
                  <option value="Tamil Nadu">Tamil Nadu</option>
                  <option value="Odisha">Odisha</option>
                  <option value="Assam">Assam</option>
                  <option value="Kerala">Kerala</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="West Bengal">West Bengal</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  District / Revenue Division
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chennai, Puri, Wayanad"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Specific Street / Landmark *
                </label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. 100ft Road, Ward 172"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 rounded-lg border border-slate-300 text-xs focus:border-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detailed On-Ground Observations *
              </label>
              <textarea
                required
                rows={4}
                placeholder="Mention water height in feet, fallen trees, electricity hazards, or specific routes blocked..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-slate-900 focus:outline-hidden"
              />
            </div>

            {/* Media URL */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-dashed border-slate-300 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-slate-800">
                    Optional Media URL
                  </div>
                  <div className="text-slate-500">
                    Stored with the report in PostgreSQL when provided
                  </div>
                </div>
              </div>

              <input
                type="url"
                placeholder="https://..."
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="w-56 max-w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-slate-900 focus:outline-hidden"
              />
            </div>

            {/* Contact Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reporter Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone (For responder verification)
                </label>
                <input
                  type="tel"
                  placeholder="+91 98400 xxxxx"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-slate-900 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              <Send className="h-4 w-4" />
              <span>Transmit Report to Ingestion Broker</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
