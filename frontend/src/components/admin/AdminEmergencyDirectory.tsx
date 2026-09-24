import React, { useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map,
  Pin,
} from '@vis.gl/react-google-maps';
import {
  Building2,
  Crosshair,
  LifeBuoy,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  Save,
} from 'lucide-react';
import { useEvents } from '../../context/EventContext';
import { EmergencyContact, EmergencyShelter } from '../../types';
import {
  syncEmergencyDirectoryFromDatabase,
  saveOfflineDirectory,
} from '../../utils/offlineDirectoryStorage';

const INDIAN_STATES = [
  'Tamil Nadu',
  'Odisha',
  'Assam',
  'Kerala',
  'Maharashtra',
  'Karnataka',
  'West Bengal',
  'Gujarat',
  'Rajasthan',
  'Uttar Pradesh',
  'Bihar',
  'Telangana',
  'Andhra Pradesh',
  'Delhi',
];

const contactDefaults = {
  name: '',
  phone: '',
  role: '',
  hours: '24/7',
  category: 'State',
  state: 'Tamil Nadu',
  district: '',
  city: '',
};

const shelterDefaults = {
  name: '',
  location: '',
  state: 'Tamil Nadu',
  district: '',
  capacity: '',
  occupied: '0',
  supplies: '',
  contact: '',
  lat: '13.082700',
  lng: '80.270700',
  status: 'Standby',
};

const toNumber = (value: string) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const ShelterMapPicker: React.FC<{
  lat: string;
  lng: string;
  onPick: (lat: number, lng: number) => void;
}> = ({ lat, lng, onPick }) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const latitude = toNumber(lat) ?? 20.5937;
  const longitude = toNumber(lng) ?? 78.9629;
  const center = useMemo(() => ({ lat: latitude, lng: longitude }), [latitude, longitude]);

  if (!apiKey) {
    return (
      <div className="min-h-[260px] rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-xs text-slate-500 flex items-center justify-center text-center">
        Set VITE_GOOGLE_MAPS_API_KEY to enable click-to-pick shelter coordinates. Manual latitude and longitude fields remain available.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-100">
      <APIProvider apiKey={apiKey}>
        <Map
          mapId="DEMO_MAP_ID"
          defaultCenter={center}
          center={center}
          defaultZoom={11}
          gestureHandling="cooperative"
          disableDefaultUI={false}
          style={{ width: '100%', height: 260 }}
          onClick={(event: any) => {
            const picked = event.detail?.latLng;
            if (picked) {
              onPick(picked.lat, picked.lng);
            }
          }}
        >
          <AdvancedMarker position={center} title="Shelter location">
            <Pin background="#15803d" borderColor="#ffffff" glyphColor="#ffffff" />
          </AdvancedMarker>
        </Map>
      </APIProvider>
    </div>
  );
};

export const AdminEmergencyDirectory: React.FC = () => {
  const {
    createEmergencyContact,
    createEmergencyShelter,
    userLocation,
  } = useEvents();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [shelters, setShelters] = useState<EmergencyShelter[]>([]);
  const [contactForm, setContactForm] = useState(contactDefaults);
  const [shelterForm, setShelterForm] = useState(shelterDefaults);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [isSavingShelter, setIsSavingShelter] = useState(false);

  const loadDirectory = async () => {
    setIsLoading(true);
    try {
      const directory = await syncEmergencyDirectoryFromDatabase();
      setContacts(directory.contacts);
      setShelters(directory.shelters);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, []);

  const updateContact = (field: keyof typeof contactDefaults, value: string) => {
    setContactForm((current) => ({ ...current, [field]: value }));
  };

  const updateShelter = (field: keyof typeof shelterDefaults, value: string) => {
    setShelterForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateContact = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingContact(true);
    const created = await createEmergencyContact({
      ...contactForm,
      state: contactForm.state || undefined,
      district: contactForm.district || undefined,
      city: contactForm.city || undefined,
    });
    setIsSavingContact(false);

    if (created) {
      const nextContacts = [created, ...contacts];
      setContacts(nextContacts);
      saveOfflineDirectory(nextContacts, shelters);
      setContactForm(contactDefaults);
    }
  };

  const handleCreateShelter = async (event: React.FormEvent) => {
    event.preventDefault();
    const lat = toNumber(shelterForm.lat);
    const lng = toNumber(shelterForm.lng);
    if (lat === null || lng === null) return;

    setIsSavingShelter(true);
    const created = await createEmergencyShelter({
      ...shelterForm,
      capacity: shelterForm.capacity || 'Not specified',
      occupied: shelterForm.occupied || 'Not specified',
      supplies: shelterForm.supplies || 'Not specified',
      lat,
      lng,
    });
    setIsSavingShelter(false);

    if (created) {
      const nextShelters = [created, ...shelters];
      setShelters(nextShelters);
      saveOfflineDirectory(contacts, nextShelters);
      setShelterForm({
        ...shelterDefaults,
        state: shelterForm.state,
        district: shelterForm.district,
      });
    }
  };

  const useBrowserLocation = () => {
    setShelterForm((current) => ({
      ...current,
      lat: userLocation.lat.toFixed(6),
      lng: userLocation.lng.toFixed(6),
    }));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Emergency Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create public helplines and relief shelter coordinates used by the citizen dashboard and offline cache.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDirectory}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Directory</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <form onSubmit={handleCreateContact} className="rounded-lg border border-slate-200 bg-white p-5 space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
              <Phone className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Create Emergency Helpline</h2>
              <p className="text-xs text-slate-500 mt-0.5">Published to the public emergency helpline directory.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-600">
              Helpline Name *
              <input
                required
                value={contactForm.name}
                onChange={(e) => updateContact('name', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="District Disaster Control Room"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Phone Number *
              <input
                required
                value={contactForm.phone}
                onChange={(e) => updateContact('phone', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="1077 / +91..."
              />
            </label>
            <label className="md:col-span-2 text-xs font-medium text-slate-600">
              Role / Use Case *
              <input
                required
                value={contactForm.role}
                onChange={(e) => updateContact('role', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="Flood rescue coordination and evacuation dispatch"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Category *
              <select
                value={contactForm.category}
                onChange={(e) => updateContact('category', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-hidden focus:border-slate-500"
              >
                <option value="National">National</option>
                <option value="State">State</option>
                <option value="Municipal">Municipal</option>
                <option value="Rescue">Rescue</option>
                <option value="Medical">Medical</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Hours
              <input
                value={contactForm.hours}
                onChange={(e) => updateContact('hours', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="24/7"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              State
              <select
                value={contactForm.state}
                onChange={(e) => updateContact('state', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-hidden focus:border-slate-500"
              >
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              District
              <input
                value={contactForm.district}
                onChange={(e) => updateContact('district', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="Chennai"
              />
            </label>
            <label className="md:col-span-2 text-xs font-medium text-slate-600">
              City / Local Body
              <input
                value={contactForm.city}
                onChange={(e) => updateContact('city', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="Greater Chennai Corporation"
              />
            </label>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSavingContact}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSavingContact ? 'Saving...' : 'Create Helpline'}</span>
            </button>
          </div>
        </form>

        <form onSubmit={handleCreateShelter} className="rounded-lg border border-slate-200 bg-white p-5 space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Create Relief Shelter</h2>
              <p className="text-xs text-slate-500 mt-0.5">Pick coordinates from the map or type latitude and longitude directly.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-600">
              Shelter Name *
              <input
                required
                value={shelterForm.name}
                onChange={(e) => updateShelter('name', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="Corporation Relief Camp"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Contact Desk *
              <input
                required
                value={shelterForm.contact}
                onChange={(e) => updateShelter('contact', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="+91..."
              />
            </label>
            <label className="md:col-span-2 text-xs font-medium text-slate-600">
              Address / Landmark *
              <input
                required
                value={shelterForm.location}
                onChange={(e) => updateShelter('location', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="Government Higher Secondary School, Ward 172"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              State *
              <select
                value={shelterForm.state}
                onChange={(e) => updateShelter('state', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-hidden focus:border-slate-500"
              >
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              District *
              <input
                required
                value={shelterForm.district}
                onChange={(e) => updateShelter('district', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="Chennai"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Capacity
              <input
                value={shelterForm.capacity}
                onChange={(e) => updateShelter('capacity', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="250 people"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Occupied
              <input
                value={shelterForm.occupied}
                onChange={(e) => updateShelter('occupied', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="0"
              />
            </label>
            <label className="md:col-span-2 text-xs font-medium text-slate-600">
              Supplies
              <input
                value={shelterForm.supplies}
                onChange={(e) => updateShelter('supplies', e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:border-slate-500"
                placeholder="Water, blankets, dry ration, medical kit"
              />
            </label>
          </div>

          <div className="space-y-3">
            <ShelterMapPicker
              lat={shelterForm.lat}
              lng={shelterForm.lng}
              onPick={(lat, lng) => {
                updateShelter('lat', lat.toFixed(6));
                updateShelter('lng', lng.toFixed(6));
              }}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-xs font-medium text-slate-600">
                Latitude *
                <input
                  required
                  type="number"
                  step="0.000001"
                  value={shelterForm.lat}
                  onChange={(e) => updateShelter('lat', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-500"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Longitude *
                <input
                  required
                  type="number"
                  step="0.000001"
                  value={shelterForm.lng}
                  onChange={(e) => updateShelter('lng', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:outline-hidden focus:border-slate-500"
                />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Status
                <select
                  value={shelterForm.status}
                  onChange={(e) => updateShelter('status', e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs bg-white text-slate-900 focus:outline-hidden focus:border-slate-500"
                >
                  <option value="Standby">Standby</option>
                  <option value="Open">Open</option>
                  <option value="Near capacity">Near capacity</option>
                  <option value="Full">Full</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <button
                type="button"
                onClick={useBrowserLocation}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Navigation className="h-3.5 w-3.5 text-slate-500" />
                <span>Use Current GPS</span>
              </button>
              <span className="inline-flex items-center gap-1 text-slate-500 font-mono">
                <Crosshair className="h-3.5 w-3.5" />
                <span>{shelterForm.lat}, {shelterForm.lng}</span>
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSavingShelter}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSavingShelter ? 'Saving...' : 'Create Shelter'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <LifeBuoy className="h-4 w-4 text-slate-600" />
            <span>Latest Helplines ({contacts.length})</span>
          </div>
          <div className="border border-slate-200 rounded-md bg-white overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500">
                  <th className="py-2.5 px-4 font-normal">Name</th>
                  <th className="py-2.5 px-4 font-normal">Phone</th>
                  <th className="py-2.5 px-4 font-normal">Region</th>
                  <th className="py-2.5 px-4 font-normal">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.slice(0, 8).map((contact) => (
                  <tr key={contact.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{contact.name}</div>
                      <div className="text-[11px] text-slate-500">{contact.role}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">{contact.phone}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {[contact.city, contact.district, contact.state].filter(Boolean).join(', ') || 'All India'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{contact.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <MapPin className="h-4 w-4 text-slate-600" />
            <span>Latest Shelters ({shelters.length})</span>
          </div>
          <div className="border border-slate-200 rounded-md bg-white overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500">
                  <th className="py-2.5 px-4 font-normal">Shelter</th>
                  <th className="py-2.5 px-4 font-normal">Coordinates</th>
                  <th className="py-2.5 px-4 font-normal">Capacity</th>
                  <th className="py-2.5 px-4 font-normal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shelters.slice(0, 8).map((shelter) => (
                  <tr key={shelter.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{shelter.name}</div>
                      <div className="text-[11px] text-slate-500">{shelter.location}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {shelter.lat.toFixed(4)}, {shelter.lng.toFixed(4)}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{shelter.capacity}</td>
                    <td className="py-3 px-4 text-slate-700">{shelter.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
