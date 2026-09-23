import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  DisasterEvent,
  RawFeedItem,
  AlertFilterOptions,
  CitizenReportSubmission,
  DataSourceType,
} from '../types';
import { INITIAL_EVENTS, INITIAL_RAW_FEED, CHENNAI_FLOOD_IMAGE } from '../data/mockData';

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
  ) => void;
  modifyEventDetails: (id: string, updates: Partial<DisasterEvent>) => void;
  submitCitizenReport: (submission: CitizenReportSubmission) => void;
  simulateKafkaIngest: (sourceType: DataSourceType, keyword?: string) => void;
  dispatchMobileAlert: (id: string) => void;
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
  const [events, setEvents] = useState<DisasterEvent[]>(INITIAL_EVENTS);
  const [rawFeed, setRawFeed] = useState<RawFeedItem[]>(INITIAL_RAW_FEED);
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

  // Admin Verification Action (Original / Fake / Misleading / Modify)
  const verifyEvent = (
    id: string,
    decision: 'original' | 'fake' | 'misleading',
    notes: string,
    officerName = 'Duty Verification Officer (NDMA-Ops)'
  ) => {
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id !== id) return evt;
        const statusMap = {
          original: 'verified_original' as const,
          fake: 'marked_fake' as const,
          misleading: 'marked_misleading' as const,
        };
        const updatedStatus = statusMap[decision];
        return {
          ...evt,
          status: updatedStatus,
          adminNotes: notes || evt.adminNotes,
          verifiedBy: officerName,
          verifiedAt: 'Just now',
          lastUpdatedAt: 'Just now',
          mobileAlertDispatched: decision === 'original' ? evt.mobileAlertDispatched : false,
        };
      })
    );

    const labels = {
      original: 'Verified as Authentic Incident',
      fake: 'Flagged as Fake / Rumor',
      misleading: 'Flagged as Misleading Footage',
    };
    showToast(`Event ${id} successfully marked as: ${labels[decision]}`, 'success');
  };

  const modifyEventDetails = (id: string, updates: Partial<DisasterEvent>) => {
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id !== id) return evt;
        return {
          ...evt,
          ...updates,
          lastUpdatedAt: 'Just now',
        };
      })
    );
    showToast(`Incident parameters for ${id} updated`, 'info');
  };

  const dispatchMobileAlert = (id: string) => {
    setEvents((prev) =>
      prev.map((evt) => (evt.id === id ? { ...evt, mobileAlertDispatched: true } : evt))
    );
    const targetEvt = events.find((e) => e.id === id);
    showToast(
      `Mobile Emergency Broadcast dispatched for: ${targetEvt?.title || id} to registered subscribers within ${targetEvt?.affectedRadiusKm || 10}km`,
      'alert'
    );
  };

  // Submit Citizen Report (Runs directly through the architecture)
  const submitCitizenReport = (submission: CitizenReportSubmission) => {
    const newRawItem: RawFeedItem = {
      id: `cit-${Date.now()}`,
      source: 'citizen_report',
      sourceHandle: `${submission.reporterName} (Citizen)`,
      content: submission.description,
      hashtags: ['#CitizenReport', `#${submission.category}`, '#IndiaWeather'],
      timestamp: 'Just now',
      locationRaw: `${submission.locationName}, ${submission.district}, ${submission.state}`,
      isNationalMedia: false,
      kafkaTopic: 'citizen-reports',
      kafkaPartition: 3,
      kafkaOffset: Math.floor(5200 + Math.random() * 500),
      mediaUrl: submission.imageFile,
      sentimentUrgency: submission.immediateRescueNeeded ? 95 : 72,
      credibilityScore: 88,
    };

    setRawFeed((prev) => [newRawItem, ...prev]);

    // Check if matches existing event by location / category
    const matched = events.find(
      (e) =>
        e.location.state.toLowerCase() === submission.state.toLowerCase() &&
        (e.category === submission.category ||
          e.location.district.toLowerCase() === submission.district.toLowerCase())
    );

    if (matched) {
      // Flowchart: Existing Event -> RELATED POST (Link with existing event) -> THRESHOLD CHECK
      setEvents((prev) =>
        prev.map((evt) => {
          if (evt.id !== matched.id) return evt;
          const newCount = evt.relatedPostsCount + 1;
          const meetsThreshold = newCount >= 5;
          let newStatus = evt.status;
          // If was in unverified pool and now reaches 5, promote to assumed_event!
          if (evt.status === 'unverified_pool' && meetsThreshold) {
            newStatus = 'assumed_event';
          }
          return {
            ...evt,
            relatedPostsCount: newCount,
            thresholdMet: meetsThreshold,
            status: newStatus,
            lastUpdatedAt: 'Just now',
            rawPosts: [newRawItem, ...evt.rawPosts],
          };
        })
      );
      showToast(
        `Citizen report linked to active cluster "${matched.title}". Additional field report recorded.`,
        'success'
      );
    } else {
      // Flowchart: NO -> UNVERIFIED POOL -> THRESHOLD / TIME CHECK
      const newDisasterEvent: DisasterEvent = {
        id: `EVT-2026-${Date.now().toString().slice(-4)}`,
        title: submission.title,
        summary: submission.description,
        category: submission.category,
        severity: submission.severity,
        location: {
          name: submission.locationName,
          district: submission.district,
          state: submission.state,
          lat: 13.0827 + (Math.random() - 0.5) * 0.4,
          lng: 80.2707 + (Math.random() - 0.5) * 0.4,
          confidence: 84,
        },
        affectedRadiusKm: 5.0,
        firstReportedAt: 'Just now',
        lastUpdatedAt: 'Just now',
        relatedPostsCount: 1,
        thresholdMet: false,
        status: 'unverified_pool',
        mlScores: {
          credibilityScore: 84,
          urgencySentiment: submission.immediateRescueNeeded ? 92 : 68,
          locationConfidence: 84,
          duplicateClusterMatch: 30,
          accountAuthenticity: 'High-Trust',
          mediaIntegrity: submission.imageFile ? 'Original EXIF' : 'No Media',
        },
        adminNotes: 'Citizen report ingested into Unverified Pool. Monitoring for matching social posts.',
        mobileAlertDispatched: false,
        mediaUrls: submission.imageFile ? [submission.imageFile] : [],
        keyHighlights: [
          'Initial on-ground report logged by local resident',
          'GPS geo-tag extracted and queued for event correlation',
        ],
        officialSafetyGuidance: [
          'Awaiting local revenue inspector verification',
          'Follow municipal emergency advisory in this sector',
        ],
        emergencyContacts: [
          { name: 'State Emergency Operation Centre', phone: '1070', role: 'General Control' },
        ],
        rawPosts: [newRawItem],
        highTrustSourceBypass: false,
      };

      setEvents((prev) => [newDisasterEvent, ...prev]);
      showToast(
        `Report received: Ingested via Kafka stream into PostgreSQL Unverified Pool.`,
        'info'
      );
    }
  };

  // Simulate incoming Kafka post (for demo/eval testing of the pipeline)
  const simulateKafkaIngest = (sourceType: DataSourceType, keyword = '#Rain') => {
    const locations = [
      { name: 'Velachery, Chennai', district: 'Chennai', state: 'Tamil Nadu', lat: 12.9815, lng: 80.218 },
      { name: 'Majuli Island', district: 'Majuli', state: 'Assam', lat: 26.9602, lng: 94.2155 },
      { name: 'Puri Coast', district: 'Puri', state: 'Odisha', lat: 19.8135, lng: 85.8312 },
      { name: 'Meppadi Hills', district: 'Wayanad', state: 'Kerala', lat: 11.5518, lng: 76.1264 },
    ];
    const loc = locations[Math.floor(Math.random() * locations.length)];
    const isNational = sourceType === 'national_media';

    const newRawItem: RawFeedItem = {
      id: `stream-${Date.now()}`,
      source: sourceType,
      sourceHandle:
        sourceType === 'national_media'
          ? 'DD News National Bureau'
          : sourceType === 'x'
          ? `@citizen_watcher_${Math.floor(Math.random() * 900 + 100)}`
          : sourceType === 'weather_api'
          ? 'IMD AWS Radar Telemetry'
          : `@local_reporter_${Math.floor(Math.random() * 900 + 100)}`,
      content: `Live telemetry update for ${loc.name}: continuous precipitation and water logging reported. ${keyword} #IMD #IndiaWeather`,
      hashtags: [keyword, '#IMD', '#IndiaWeather'],
      timestamp: 'Just now',
      locationRaw: `${loc.name}, ${loc.state}`,
      isNationalMedia: isNational,
      kafkaTopic: isNational
        ? 'national-wire'
        : sourceType === 'weather_api'
        ? 'weather-telemetry'
        : 'raw-social-stream',
      kafkaPartition: Math.floor(Math.random() * 4),
      kafkaOffset: Math.floor(89400 + Math.random() * 500),
      mediaUrl: isNational ? undefined : CHENNAI_FLOOD_IMAGE,
      sentimentUrgency: Math.floor(65 + Math.random() * 30),
      credibilityScore: isNational ? 99 : Math.floor(60 + Math.random() * 35),
    };

    setRawFeed((prev) => [newRawItem, ...prev]);

    // Check architecture branch: If National Media -> directly verified!
    if (isNational) {
      showToast(
        `High-Trust Source Ingested: National Media broadcast verified and routed directly to Verified Events Database`,
        'success'
      );
      return;
    }

    // Match with existing event
    const matched = events.find(
      (e) => e.location.state === loc.state || e.location.district === loc.district
    );
    if (matched) {
      setEvents((prev) =>
        prev.map((evt) => {
          if (evt.id !== matched.id) return evt;
          const updatedCount = evt.relatedPostsCount + 1;
          const meetsThreshold = updatedCount >= 5;
          let newStatus = evt.status;
          if (evt.status === 'unverified_pool' && meetsThreshold) {
            newStatus = 'assumed_event';
          }
          return {
            ...evt,
            relatedPostsCount: updatedCount,
            thresholdMet: meetsThreshold,
            status: newStatus,
            lastUpdatedAt: 'Just now',
            rawPosts: [newRawItem, ...evt.rawPosts],
          };
        })
      );
      showToast(
        `Kafka event matched to cluster "${matched.title}". Additional field report recorded.`,
        'info'
      );
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
