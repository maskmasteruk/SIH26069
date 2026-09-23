import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { IncidentCategory, IncidentSeverity } from '../../types';
import {
  Send,
  Camera,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  LifeBuoy,
  FileCheck,
} from 'lucide-react';
import { CHENNAI_FLOOD_IMAGE } from '../../data/mockData';

export const CitizenReportSection: React.FC = () => {
  const { submitCitizenReport, userLocation } = useEvents();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('urban_waterlogging');
  const [severity, setSeverity] = useState<IncidentSeverity>('Severe');
  const [locationName, setLocationName] = useState(userLocation.name);
  const [district, setDistrict] = useState(userLocation.name.split(',')[0] || '');
  const [reporterName, setReporterName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [imageAttached, setImageAttached] = useState<string | null>(null);
  const [immediateRescueNeeded, setImmediateRescueNeeded] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !locationName) return;

    submitCitizenReport({
      title,
      description,
      category,
      severity: immediateRescueNeeded ? 'Critical' : severity,
      locationName,
      district: district || locationName,
      state: locationName.includes('(') ? locationName.split('(')[1].replace(')', '') : 'India',
      reporterName: reporterName || 'Resident',
      contactNumber: contactNumber || 'Not provided',
      imageFile: imageAttached || undefined,
      immediateRescueNeeded,
    });

    setSubmitted(true);
  };

  const handleReset = () => {
    setTitle('');
    setDescription('');
    setImageAttached(null);
    setImmediateRescueNeeded(false);
    setSubmitted(false);
  };

  return (
    <section id="citizen-report" className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="border-b border-slate-100 pb-4 mb-6">
        <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
          <Send className="h-3.5 w-3.5" />
          <span>Ground Observation Reporting</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mt-1">
          Citizen Incident Report
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Witnessing active floodwaters, road blockages, fallen wires, or storm surges? Submit a direct report to civil defense authorities.
        </p>
      </div>

      {submitted ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-8 text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-emerald-950">
              Report Submitted Successfully
            </h3>
            <p className="text-xs text-emerald-800 max-w-md mx-auto mt-1 leading-relaxed">
              Your observation has been registered into the disaster response system. Once corroborated with nearby citizen signals or verified by field teams, it will appear on the public map.
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-semibold bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 transition-colors cursor-pointer"
          >
            Submit Another Report
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">
                What are you observing? <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Water rising above 2 feet near metro station, canal breaching"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Disaster / Hazard Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as IncidentCategory)}
                className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value="flash_flood">Flash Flood / River Overflow</option>
                <option value="urban_waterlogging">Urban Waterlogging / Drain Blockage</option>
                <option value="cyclone_wind">Cyclone / Gale Winds / Uprooted Trees</option>
                <option value="landslide">Hillside Landslide / Debris Flow</option>
                <option value="heavy_rainfall">Extreme Continuous Rainfall</option>
              </select>
            </div>

            {/* Severity */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Severity Level
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value="Moderate">Moderate (Traffic disruption, shallow water)</option>
                <option value="Severe">Severe (Homes inundated, roads submerged)</option>
                <option value="Critical">Critical (Immediate danger, evacuation needed)</option>
              </select>
            </div>

            {/* Location */}
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Exact Location / Landmark <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setLocationName(userLocation.name);
                    setDistrict(userLocation.name.split(',')[0]);
                  }}
                  className="text-xs text-amber-800 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  <MapPin className="h-3 w-3" />
                  <span>Use Detected: {userLocation.name.split(',')[0]}</span>
                </button>
              </div>
              <input
                type="text"
                required
                placeholder="e.g., 100 Feet Road, Near Velachery Railway Station"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-700">
                Detailed Situation Description <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Provide details: water level, whether vehicles can pass, stranded persons, downed power cables, or breached barriers..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>

            {/* Contact Optional */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Your Name / Organization (Optional)
              </label>
              <input
                type="text"
                placeholder="Resident / Volunteer"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Contact Phone for Rescue Confirmation (Optional)
              </label>
              <input
                type="tel"
                placeholder="e.g., 9876543210"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>
          </div>

          {/* Rescue Checkbox & Photo Simulation */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={immediateRescueNeeded}
                onChange={(e) => setImmediateRescueNeeded(e.target.checked)}
                className="h-4 w-4 rounded text-red-600 focus:ring-red-500 cursor-pointer"
              />
              <span className="text-xs font-semibold text-red-700">
                Immediate rescue needed (Elderly/Children trapped, severe danger)
              </span>
            </label>

            <button
              type="button"
              onClick={() => setImageAttached(imageAttached ? null : CHENNAI_FLOOD_IMAGE)}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg bg-slate-50 cursor-pointer"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>{imageAttached ? 'Ground Photo Attached ✓' : 'Attach Photo'}</span>
            </button>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Submit Ground Report</span>
            </button>
          </div>
        </form>
      )}
    </section>
  );
};
