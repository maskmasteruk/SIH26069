import React, { useState } from 'react';
import { useEvents } from '../../context/EventContext';
import { DisasterEvent, IncidentSeverity } from '../../types';
import { X, Edit3, Send } from 'lucide-react';

interface Props {
  event: DisasterEvent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AdminVerificationModal: React.FC<Props> = ({ event, isOpen, onClose }) => {
  const { verifyEvent, modifyEventDetails, dispatchMobileAlert } = useEvents();

  const [decisionNotes, setDecisionNotes] = useState('');
  const [officerName] = useState('S. Narayanan (Joint Director, SDMA)');
  const [isEditingParams, setIsEditingParams] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedSeverity, setEditedSeverity] = useState<IncidentSeverity>('Severe');
  const [editedRadius, setEditedRadius] = useState(10);

  if (!isOpen || !event) return null;

  const handleVerify = (decision: 'original' | 'fake' | 'misleading') => {
    verifyEvent(event.id, decision, decisionNotes, officerName);
    onClose();
  };

  const handleSaveEdits = () => {
    modifyEventDetails(event.id, {
      title: editedTitle || event.title,
      severity: editedSeverity,
      affectedRadiusKm: editedRadius,
    });
    setIsEditingParams(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-lg bg-white p-6 border border-slate-200 shadow-md my-8 max-h-[90vh] overflow-y-auto font-sans">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <span className="font-semibold text-slate-900">{event.id}</span>
              <span>·</span>
              <span>
                {event.location.name}, {event.location.state}
              </span>
              <span>·</span>
              <span>{event.relatedPostsCount} / 5 Corroborating Signals</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mt-1">
              {event.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6">
          {/* Left Column: Summary & Feeds */}
          <div className="md:col-span-7 space-y-5">
            {/* Event Summary */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500">Situation Summary</div>
              <p className="text-xs text-slate-700 leading-relaxed p-3 bg-slate-50 border border-slate-200 rounded-md">
                {event.summary}
              </p>
            </div>

            {/* Incident Parameters */}
            <div className="border border-slate-200 rounded-md p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">
                  Parameters &amp; Geographic Radius
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (!isEditingParams) {
                      setEditedTitle(event.title);
                      setEditedSeverity(event.severity);
                      setEditedRadius(event.affectedRadiusKm);
                    }
                    setIsEditingParams(!isEditingParams);
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 underline cursor-pointer"
                >
                  {isEditingParams ? 'Cancel' : 'Edit'}
                </button>
              </div>

              {isEditingParams ? (
                <div className="space-y-2.5 pt-1 text-xs">
                  <div>
                    <label className="text-slate-500 block mb-0.5">Title</label>
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-500 block mb-0.5">Severity</label>
                      <select
                        value={editedSeverity}
                        onChange={(e) =>
                          setEditedSeverity(e.target.value as IncidentSeverity)
                        }
                        className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white"
                      >
                        <option value="Critical">Critical</option>
                        <option value="Severe">Severe</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Advisory">Advisory</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-0.5">Radius (km)</label>
                      <input
                        type="number"
                        value={editedRadius}
                        onChange={(e) => setEditedRadius(Number(e.target.value))}
                        className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveEdits}
                    className="px-2.5 py-1 text-xs font-medium text-white bg-slate-900 rounded hover:bg-slate-800 cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 pt-1 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Severity</span>
                    <span className="font-semibold text-slate-800">{event.severity}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Affected Radius</span>
                    <span className="font-semibold text-slate-800">
                      {event.affectedRadiusKm} km
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Threshold</span>
                    <span className="font-semibold text-slate-800">
                      {event.relatedPostsCount >= 5 ? '≥ 5 (Met)' : `${event.relatedPostsCount} / 5`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Corroborating Raw Ingestion Messages */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">
                  Corroborating Ingestion Feeds ({event.rawPosts.length})
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  PostGIS ST_DWithin 5km
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {event.rawPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-2.5 rounded border border-slate-200 bg-white text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                      <span className="font-medium text-slate-700">
                        {post.sourceHandle}
                      </span>
                      <span>
                        {post.kafkaTopic} · {post.timestamp}
                      </span>
                    </div>
                    <p className="text-slate-800">{post.content}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono pt-0.5">
                      <span>Credibility: {post.credibilityScore}%</span>
                      <span>·</span>
                      <span>Urgency: {post.sentimentUrgency}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: ML Scores & Decision Desk */}
          <div className="md:col-span-5 space-y-5">
            {/* ML Scoring */}
            <div className="border border-slate-200 rounded-md p-3.5 space-y-3">
              <div className="text-xs font-medium text-slate-700">
                Machine Learning Scores
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-500">Credibility Analysis</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {event.mlScores.credibilityScore}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-800 rounded-full"
                      style={{ width: `${event.mlScores.credibilityScore}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-500">Urgency &amp; Sentiment</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {event.mlScores.urgencySentiment}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-800 rounded-full"
                      style={{ width: `${event.mlScores.urgencySentiment}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-400 block">Account Tier</span>
                    <span className="text-slate-700">
                      {event.mlScores.accountAuthenticity}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">EXIF / Media</span>
                    <span className="text-slate-700">
                      {event.mlScores.mediaIntegrity}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Officer Decision Actions */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Verification Rationale / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Note ground verification sources or debunk details..."
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  className="w-full rounded border border-slate-300 p-2 text-xs focus:outline-hidden focus:border-slate-500"
                />
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleVerify('original')}
                  className="w-full py-2 px-3 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                >
                  Verify as Authentic Disaster
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleVerify('fake')}
                    className="py-1.5 px-3 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                  >
                    Mark as Fake
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerify('misleading')}
                    className="py-1.5 px-3 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                  >
                    Mark Misleading
                  </button>
                </div>
              </div>

              {event.status === 'verified_original' && !event.mobileAlertDispatched && (
                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => dispatchMobileAlert(event.id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-slate-800 border border-slate-300 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                  >
                    <Send className="h-3 w-3 text-slate-500" />
                    <span>Dispatch Mobile Alert ({event.affectedRadiusKm}km)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
