import React from 'react';
import { EmergencyDirectorySection } from './EmergencyDirectorySection';
import { LifeBuoy, ShieldAlert, Mountain, CheckCircle2 } from 'lucide-react';

export const SafetyResources: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Location-aware Emergency Directory */}
      <EmergencyDirectorySection />

      {/* Safety & Preparedness Protocols Section */}
      <section className="space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900">
            Standard Disaster Action & Safety Protocols
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Life-safety guidelines curated by Civil Defense and Disaster Management Authorities.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Flood protocol */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <LifeBuoy className="h-5 w-5 text-blue-600 shrink-0" />
              <span>Urban Inundation & Flash Floods</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-slate-900 shrink-0">• DO:</span>
                <span>Disconnect main electrical breaker and gas cylinders if water approaches the threshold.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-slate-900 shrink-0">• DO:</span>
                <span>Move essential identity documents, medicines, and drinking water canisters to upper floors.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-red-700 shrink-0">• DO NOT:</span>
                <span>Drive or wade through water of unknown depth; 15cm of swift water can sweep away adults.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-red-700 shrink-0">• DO NOT:</span>
                <span>Touch submerged transformers or downed electrical cables. Call municipal line immediately.</span>
              </li>
            </ul>
          </div>

          {/* Cyclone protocol */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
              <span>Cyclonic Gale Winds & Coastal Surge</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-slate-900 shrink-0">• DO:</span>
                <span>Move inside concrete shelters or designated storm structures before gale winds exceed 65 km/h.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-slate-900 shrink-0">• DO:</span>
                <span>Keep battery-powered transceivers and mobile power banks fully charged in advance.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-red-700 shrink-0">• DO NOT:</span>
                <span>Step outside during the eye of the cyclone; the calm is temporary and destructive reverse winds follow.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-red-700 shrink-0">• DO NOT:</span>
                <span>Spread unverified social forwards claiming bridge collapses without checking the verified portal.</span>
              </li>
            </ul>
          </div>

          {/* Landslide protocol */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Mountain className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>Hillside Debris Flow & Landslides</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-slate-900 shrink-0">• DO:</span>
                <span>Listen for unusual sounds like trees cracking or boulders knocking together on slopes.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-slate-900 shrink-0">• DO:</span>
                <span>Evacuate valley bottoms and steep slope toe areas when continuous rainfall exceeds 150mm.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-red-700 shrink-0">• DO NOT:</span>
                <span>Cross bridges if water appears thick with mud and debris; a flash surge may be imminent.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="font-bold text-red-700 shrink-0">• DO NOT:</span>
                <span>Return to evacuated houses on unstable slopes until local geologists clear the sector.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};
