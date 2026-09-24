import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  DisasterEvent,
  RawFeedItem,
  AlertFilterOptions,
  CitizenReportSubmission,
  DataSourceType,
  EmergencyContact,
  EmergencyShelter,
} from '../types';

interface AdminSessionUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface EventContextType {
  events: DisasterEvent[];
  rawFeed: RawFeedItem[];
  selectedEvent: DisasterEvent | null;
  setSelectedEvent: (event: DisasterEvent | null) => void;
  filter: AlertFilterOptions;
  setFilter: React.Dispatch<React.SetStateAction<AlertFilterOptions>>;
  currentPath: string;
  navigate: (path: string) => void;
  verifyEvent: (
    id: string,
    decision: 'original' | 'fake' | 'misleading',
    notes: string,
    officerName?: string
  ) => Promise<boolean>;
  modifyEventDetails: (id: string, updates: Partial<DisasterEvent>) => Promise<boolean>;
  submitCitizenReport: (submission: CitizenReportSubmission) => Promise<boolean>;
  createEmergencyContact: (contact: Omit<EmergencyContact, 'id'>) => Promise<EmergencyContact | null>;
  createEmergencyShelter: (shelter: Omit<EmergencyShelter, 'id'>) => Promise<EmergencyShelter | null>;
  simulateKafkaIngest: (sourceType: DataSourceType, keyword?: string) => Promise<void>;
  dispatchMobileAlert: (id: string) => Promise<boolean>;
  userLocation: { name: string; lat: number; lng: number };
  setUserLocation: (loc: { name: string; lat: number; lng: number }) => void;
  isLocating: boolean;
  locationSource: 'gps' | 'preset' | 'default';
  detectRealtimeLocation: () => Promise<void>;
  notificationToast: { message: string; type: 'success' | 'alert' | 'info' } | null;
  clearNotificationToast: () => void;
  isAdminLoggedIn: boolean;
  isAdminSessionLoading: boolean;
  adminUser: AdminSessionUser | null;
  adminLogin: (username: string, password: string) => Promise<boolean>;
  adminLogout: () => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);
const ADMIN_TOKEN_STORAGE_KEY = 'wave_admin_auth_token';

export const EventProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [rawFeed, setRawFeed] = useState<RawFeedItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DisasterEvent | null>(null);
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const [filter, setFilter] = useState<AlertFilterOptions>({
    status: 'all',
    category: 'all',
    severity: 'all',
    state: 'all',
    searchQuery: '',
  });

  const [userLocation, setUserLocation] = useState<{ name: string; lat: number; lng: number }>({
    name: 'Chennai Central, Tamil Nadu',
    lat: 13.0827,
    lng: 80.2707,
  });

  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationSource, setLocationSource] = useState<'gps' | 'preset' | 'default'>('default');

  const detectRealtimeLocation = async () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'alert');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let placeName = `GPS: ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const city =
              data.address?.city ||
              data.address?.town ||
              data.address?.suburb ||
              data.address?.village ||
              data.address?.county;
            const state = data.address?.state;
            if (city && state) {
              placeName = `${city}, ${state}`;
            } else if (data.display_name) {
              placeName = data.display_name.split(',').slice(0, 2).join(',').trim();
            }
          }
        } catch {
          // If network reverse geocode times out or is offline, keep GPS coordinates
          placeName = `Real-time GPS (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`;
        }

        setUserLocation({
          name: placeName,
          lat,
          lng,
        });
        setLocationSource('gps');
        setIsLocating(false);
        showToast(`Real-time location locked: ${placeName}`, 'success');
      },
      (err) => {
        setIsLocating(false);
        let msg = 'Unable to access device location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please allow location access in your browser.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out.';
        }
        showToast(msg, 'alert');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  // Attempt real-time geolocation on initialization
  useEffect(() => {
    if (navigator.geolocation) {
      detectRealtimeLocation();
    }
  }, []);

  const [notificationToast, setNotificationToast] = useState<{
    message: string;
    type: 'success' | 'alert' | 'info';
  } | null>(null);

  const [adminUser, setAdminUser] = useState<AdminSessionUser | null>(null);
  const [isAdminSessionLoading, setIsAdminSessionLoading] = useState<boolean>(() => {
    try {
      return Boolean(sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY));
    } catch {
      return false;
    }
  });
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    const restoreSession = async () => {
      let token = '';
      try {
        token = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
      } catch {
        token = '';
      }

      if (!token) {
        setIsAdminSessionLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/admin/session', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error('Admin session expired');
        }

        const data = (await res.json()) as { user: AdminSessionUser };
        setAdminUser(data.user);
        setIsAdminLoggedIn(true);
      } catch {
        try {
          sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
        } catch {}
        setAdminUser(null);
        setIsAdminLoggedIn(false);
      } finally {
        setIsAdminSessionLoading(false);
      }
    };

    restoreSession();
  }, []);

  const adminLogin = async (username: string, pass: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password: pass }),
      });

      if (!res.ok) {
        showToast('Authentication failed. Invalid username or password.', 'alert');
        return false;
      }

      const data = (await res.json()) as { token: string; user: AdminSessionUser };
      try {
        sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, data.token);
      } catch {}
      setAdminUser(data.user);
      setIsAdminLoggedIn(true);
      showToast('Admin authentication successful. Emergency Operations Center unlocked.', 'success');
      return true;
    } catch {
      showToast('Authentication service is unavailable. Confirm PostgreSQL and the frontend API are running.', 'alert');
      return false;
    }
  };

  const adminLogout = () => {
    setIsAdminLoggedIn(false);
    setAdminUser(null);
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {}
    showToast('Admin session terminated. Returned to public view.', 'info');
    navigate('/');
  };

  // Sync with browser navigation
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showToast = (message: string, type: 'success' | 'alert' | 'info' = 'info') => {
    setNotificationToast({ message, type });
    setTimeout(() => {
      setNotificationToast((curr) => (curr?.message === message ? null : curr));
    }, 5000);
  };

  const clearNotificationToast = () => setNotificationToast(null);

  const getAdminAuthHeaders = (): Record<string, string> => {
    try {
      const token = sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  };

  const applyDisasterPayload = (payload: { events?: DisasterEvent[]; rawFeed?: RawFeedItem[] }) => {
    if (Array.isArray(payload.events)) {
      setEvents(payload.events);
      setSelectedEvent((current) =>
        current ? payload.events?.find((event) => event.id === current.id) || null : current
      );
    }
    if (Array.isArray(payload.rawFeed)) {
      setRawFeed(payload.rawFeed);
    }
  };

  const loadDisasterData = async (silent = false) => {
    try {
      const [eventsRes, rawFeedRes] = await Promise.all([
        fetch('/api/events'),
        fetch('/api/raw-feed'),
      ]);

      if (!eventsRes.ok || !rawFeedRes.ok) {
        throw new Error('PostgreSQL data API returned an error');
      }

      const [eventsPayload, rawFeedPayload] = await Promise.all([
        eventsRes.json() as Promise<{ events: DisasterEvent[] }>,
        rawFeedRes.json() as Promise<{ rawFeed: RawFeedItem[] }>,
      ]);

      applyDisasterPayload({
        events: eventsPayload.events,
        rawFeed: rawFeedPayload.rawFeed,
      });
    } catch {
      if (!silent) {
        showToast('Unable to load live PostgreSQL disaster data.', 'alert');
      }
    }
  };

  useEffect(() => {
    loadDisasterData(true);
  }, []);

  const verifyEvent = async (
    id: string,
    decision: 'original' | 'fake' | 'misleading',
    notes: string,
    officerName = 'Duty Verification Officer'
  ) => {
    try {
      const res = await fetch(`/api/events/${id}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeaders(),
        },
        body: JSON.stringify({ decision, notes, officerName }),
      });

      if (!res.ok) {
        throw new Error('Verification request failed');
      }

      applyDisasterPayload(await res.json());
      const labels = {
        original: 'Verified as Authentic Incident',
        fake: 'Flagged as Fake / Rumor',
        misleading: 'Flagged as Misleading Footage',
      };
      showToast(`Event ${id} successfully marked as: ${labels[decision]}`, 'success');
      return true;
    } catch {
      showToast('Unable to update verification in PostgreSQL.', 'alert');
      return false;
    }
  };

  const modifyEventDetails = async (id: string, updates: Partial<DisasterEvent>) => {
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeaders(),
        },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        throw new Error('Event update failed');
      }

      applyDisasterPayload(await res.json());
      showToast(`Incident parameters for ${id} updated in PostgreSQL`, 'info');
      return true;
    } catch {
      showToast('Unable to update incident parameters in PostgreSQL.', 'alert');
      return false;
    }
  };

  const dispatchMobileAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}/mobile-alert`, {
        method: 'POST',
        headers: getAdminAuthHeaders(),
      });

      if (!res.ok) {
        throw new Error('Mobile alert update failed');
      }

      applyDisasterPayload(await res.json());
      const targetEvt = events.find((e) => e.id === id);
      showToast(
        `Mobile Emergency Broadcast dispatched for: ${targetEvt?.title || id}`,
        'alert'
      );
      return true;
    } catch {
      showToast('Unable to persist mobile alert dispatch in PostgreSQL.', 'alert');
      return false;
    }
  };

  const submitCitizenReport = async (submission: CitizenReportSubmission) => {
    try {
      const res = await fetch('/api/citizen-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission: {
            ...submission,
            latitude: userLocation.lat,
            longitude: userLocation.lng,
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Citizen report insert failed');
      }

      const payload = await res.json();
      applyDisasterPayload(payload);
      if (payload.reportRouting?.mode === 'kafka_listener') {
        showToast('Report sent to Kafka listener for classification and admin verification.', 'info');
      } else {
        showToast('Report received and sent to admin verification queue.', 'info');
      }
      return true;
    } catch {
      showToast('Unable to store citizen report in PostgreSQL.', 'alert');
      return false;
    }
  };

  const createEmergencyContact = async (
    contact: Omit<EmergencyContact, 'id'>
  ): Promise<EmergencyContact | null> => {
    try {
      const res = await fetch('/api/admin/emergency-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeaders(),
        },
        body: JSON.stringify(contact),
      });

      if (!res.ok) {
        throw new Error('Emergency contact creation failed');
      }

      const payload = (await res.json()) as { contact: EmergencyContact };
      showToast('Emergency helpline added to the public offline directory.', 'success');
      return payload.contact;
    } catch {
      showToast('Unable to create emergency helpline in PostgreSQL.', 'alert');
      return null;
    }
  };

  const createEmergencyShelter = async (
    shelter: Omit<EmergencyShelter, 'id'>
  ): Promise<EmergencyShelter | null> => {
    try {
      const res = await fetch('/api/admin/emergency-shelters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminAuthHeaders(),
        },
        body: JSON.stringify(shelter),
      });

      if (!res.ok) {
        throw new Error('Emergency shelter creation failed');
      }

      const payload = (await res.json()) as { shelter: EmergencyShelter };
      showToast('Relief shelter added with GIS coordinates.', 'success');
      return payload.shelter;
    } catch {
      showToast('Unable to create relief shelter in PostgreSQL.', 'alert');
      return null;
    }
  };

  const simulateKafkaIngest = async (sourceType: DataSourceType, keyword = '#Rain') => {
    try {
      const res = await fetch('/api/source-posts/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceType, keyword }),
      });

      if (!res.ok) {
        throw new Error('Source post simulation failed');
      }

      applyDisasterPayload(await res.json());
      showToast('Database-backed stream event recorded in PostgreSQL.', 'info');
    } catch {
      showToast('Unable to record simulated stream event in PostgreSQL.', 'alert');
    }
  };

  return (
    <EventContext.Provider
      value={{
        events,
        rawFeed,
        selectedEvent,
        setSelectedEvent,
        filter,
        setFilter,
        currentPath,
        navigate,
        verifyEvent,
        modifyEventDetails,
        submitCitizenReport,
        createEmergencyContact,
        createEmergencyShelter,
        simulateKafkaIngest,
        dispatchMobileAlert,
        userLocation,
        setUserLocation,
        isLocating,
        locationSource,
        detectRealtimeLocation,
        notificationToast,
        clearNotificationToast,
        isAdminLoggedIn,
        isAdminSessionLoading,
        adminUser,
        adminLogin,
        adminLogout,
      }}
    >
      {children}
    </EventContext.Provider>
  );
};

export const useEvents = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvents must be used within an EventProvider');
  }
  return context;
};
