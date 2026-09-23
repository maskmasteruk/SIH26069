import { useState, useEffect } from 'react';
import {
  EMERGENCY_CONTACTS,
  EMERGENCY_SHELTERS,
  EmergencyContact,
  EmergencyShelter,
} from '../data/emergencyDirectory';

const STORAGE_KEY_CONTACTS = 'wave_emergency_contacts_v1';
const STORAGE_KEY_SHELTERS = 'wave_emergency_shelters_v1';
const STORAGE_KEY_METADATA = 'wave_emergency_metadata_v1';

export interface OfflineDirectoryMetadata {
  lastSyncedAt: string;
  contactsCount: number;
  sheltersCount: number;
  version: string;
}

/**
 * Initializes and retrieves cached emergency directory data.
 * Falls back to bundled data if cache is empty or corrupted.
 */
export function getOfflineDirectory(): {
  contacts: EmergencyContact[];
  shelters: EmergencyShelter[];
  metadata: OfflineDirectoryMetadata;
} {
  try {
    const rawContacts = localStorage.getItem(STORAGE_KEY_CONTACTS);
    const rawShelters = localStorage.getItem(STORAGE_KEY_SHELTERS);
    const rawMeta = localStorage.getItem(STORAGE_KEY_METADATA);

    if (rawContacts && rawShelters) {
      const contacts = JSON.parse(rawContacts) as EmergencyContact[];
      const shelters = JSON.parse(rawShelters) as EmergencyShelter[];
      const metadata = rawMeta
        ? (JSON.parse(rawMeta) as OfflineDirectoryMetadata)
        : {
            lastSyncedAt: new Date().toISOString(),
            contactsCount: contacts.length,
            sheltersCount: shelters.length,
            version: '1.0',
          };

      return { contacts, shelters, metadata };
    }
  } catch (err) {
    console.warn('Failed to read from localStorage emergency cache:', err);
  }

  // If not in cache, initialize it
  const initialData = {
    contacts: EMERGENCY_CONTACTS,
    shelters: EMERGENCY_SHELTERS,
    metadata: {
      lastSyncedAt: new Date().toISOString(),
      contactsCount: EMERGENCY_CONTACTS.length,
      sheltersCount: EMERGENCY_SHELTERS.length,
      version: '1.0',
    },
  };

  saveOfflineDirectory(initialData.contacts, initialData.shelters);
  return initialData;
}

/**
 * Persists emergency directory contacts and shelters to browser offline storage.
 */
export function saveOfflineDirectory(
  contacts: EmergencyContact[],
  shelters: EmergencyShelter[]
): OfflineDirectoryMetadata {
  const metadata: OfflineDirectoryMetadata = {
    lastSyncedAt: new Date().toISOString(),
    contactsCount: contacts.length,
    sheltersCount: shelters.length,
    version: '1.0',
  };

  try {
    localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
    localStorage.setItem(STORAGE_KEY_SHELTERS, JSON.stringify(shelters));
    localStorage.setItem(STORAGE_KEY_METADATA, JSON.stringify(metadata));
  } catch (err) {
    console.warn('Unable to write to localStorage for offline cache:', err);
  }

  return metadata;
}

/**
 * Custom React hook to detect online/offline network connectivity.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Generates and downloads a compact offline plain text emergency cheat-sheet.
 * Essential for citizens facing grid blackouts or battery conservation mode.
 */
export function downloadOfflineEmergencySheet(
  locationName: string,
  contacts: EmergencyContact[],
  shelters: EmergencyShelter[]
) {
  const dateStr = new Date().toLocaleDateString('en-IN', {
    dateStyle: 'medium',
  });

  let text = `=====================================================\n`;
  text += `WAVE EMERGENCY RESPONSE DIRECTORY - OFFLINE COPY\n`;
  text += `Current Sector: ${locationName}\n`;
  text += `Generated: ${dateStr}\n`;
  text += `Notice: Keep this reference saved for grid or network outages.\n`;
  text += `=====================================================\n\n`;

  text += `[1] PRIORITY NATIONAL & RESCUE HELPLINES\n`;
  text += `-----------------------------------------------------\n`;
  const nationalContacts = contacts.filter((c) => c.category === 'National' || c.category === 'Rescue');
  nationalContacts.forEach((c) => {
    text += `• ${c.name}\n  Phone: ${c.phone} (${c.hours})\n  Role: ${c.role}\n\n`;
  });

  text += `[2] REGIONAL & MUNICIPAL DESKS\n`;
  text += `-----------------------------------------------------\n`;
  const regionalContacts = contacts.filter((c) => c.category !== 'National' && c.category !== 'Rescue');
  regionalContacts.forEach((c) => {
    const loc = [c.city, c.district, c.state].filter(Boolean).join(', ');
    text += `• ${c.name} [${loc}]\n  Phone: ${c.phone} (${c.hours})\n  Role: ${c.role}\n\n`;
  });

  text += `[3] RELIEF & EVACUATION SHELTERS\n`;
  text += `-----------------------------------------------------\n`;
  shelters.forEach((s) => {
    text += `• ${s.name} (${s.district}, ${s.state})\n  Location: ${s.location}\n  Capacity: ${s.capacity} (Occupancy: ${s.occupied})\n  Contact: ${s.contact}\n  Supplies: ${s.supplies}\n\n`;
  });

  text += `=====================================================\n`;
  text += `All phone numbers support direct standard cellular dialing.\n`;
  text += `Emergency SOS Unified Dial: 112 | Disaster Helpline: 1078\n`;

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wave-emergency-directory-${locationName.toLowerCase().replace(/[^a-z0-9]/g, '_')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
