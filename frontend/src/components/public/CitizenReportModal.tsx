import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { IncidentCategory, IncidentSeverity } from '../../types';
import { AlertCircle, Camera, CheckCircle2, MapPin, Send, X, LifeBuoy } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CitizenReportModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { submitCitizenReport } = useEvents();

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

  if (!isOpen) return null;

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
    setTimeout(() => {
      setSubmitted(false);
      onClose();
      // Reset
      setTitle('');
      setDescription('');
      setLocationName('');
      setReporterName('');
      setContactNumber('');
      setMediaUrl('');
      setImmediateRescueNeeded(false);
    }, 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
        >
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="py-12 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Citizen Report Transmitted to Pipeline
            </h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Your report has been queued into Apache Kafka (<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">citizen-reports</code>) and matched with PostgreSQL spatial cluster coordinates for verification.
            </p>
            <div className="text-xs text-slate-400 font-mono">
              Redirecting back to portal...
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 uppercase tracking-wide">
                <LifeBuoy className="h-4 w-4 text-amber-600" />
                <span>Community Ground Reporting Network</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 mt-1">
                Report Local Incident or Weather Hazard
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every verified citizen report strengthens multi-source incident clustering and triggers rapid local responder dispatch.
              </p>
            </div>

            {/* Emergency Rescue Callout Switch */}
            <div
              onClick={() => setImmediateRescueNeeded(!immediateRescueNeeded)}
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                immediateRescueNeeded
                  ? 'border-red-400 bg-red-50/80 text-red-900 ring-2 ring-red-200'
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
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  <span>Immediate Rescue / Stranded Persons Involved</span>
                </div>
                <p className="text-xs opacity-90 mt-0.5">
                  Check this if people are trapped by rising floodwaters, debris, or require urgent medical evacuation. Flags sentiment urgency to Critical (95%).
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Incident Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Incident Title / Headline *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Waterlogging on Velachery Main Road near Bus Stand"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Category & Severity Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Incident Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-slate-900 focus:outline-hidden"
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
                    Estimated Ground Severity
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                    disabled={immediateRescueNeeded}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-slate-900 focus:outline-hidden disabled:bg-slate-100"
                  >
                    <option value="Critical">Critical (Threat to life/structures)</option>
                    <option value="Severe">Severe (Major disruption/trapped)</option>
                    <option value="Moderate">Moderate (Traffic cut/water ingress)</option>
                    <option value="Advisory">Advisory (Cautionary/rising levels)</option>
                  </select>
                </div>
              </div>

              {/* Location Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    State *
                  </label>
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-slate-900 focus:outline-hidden"
                  >
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Odisha">Odisha</option>
                    <option value="Assam">Assam</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Gujarat">Gujarat</option>
                  </select>
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    District
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chennai, Puri, Wayanad"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-hidden"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Specific Locality / Landmark *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 100ft Road, Ward 172"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-sm focus:border-slate-900 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ground Situation Details *
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe water depth, blocked routes, damaged electricity poles, or specific emergency needs..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-hidden"
                />
              </div>

              {/* Media URL */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-dashed border-slate-300 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                    <Camera className="h-4 w-4" />
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
                  className="w-52 max-w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs focus:border-slate-900 focus:outline-hidden"
                />
              </div>

              {/* Reporter details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Name (Optional / Community Elder)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. K. Sundaram"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone (For verification / rescue)
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98400 xxxxx"
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <AlertCircle className="h-3.5 w-3.5 text-slate-400" />
                <span>Encrypted & routed to Kafka ingestion broker</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Transmit Report</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
