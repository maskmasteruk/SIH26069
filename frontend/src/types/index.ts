export type DataSourceType =
  | 'x'
  | 'instagram'
  | 'social_media'
  | 'weather_api'
  | 'national_media'
  | 'citizen_report';

export type IncidentCategory =
  | 'flash_flood'
  | 'severe_cyclone'
  | 'urban_waterlogging'
  | 'landslide'
  | 'extreme_heatwave'
  | 'heavy_thunderstorm';

export type IncidentSeverity = 'Critical' | 'Severe' | 'Moderate' | 'Advisory';

export type EventStatus =
  | 'unverified_pool'       // Initial pool, threshold < 5
  | 'assumed_event'         // Corroboration threshold >= 5 reached
  | 'admin_review'          // Time limit expired with threshold not met
  | 'verified_original'     // Admin verified genuine disaster
  | 'marked_fake'           // Flagged as rumor/fake
  | 'marked_misleading';    // Flagged as old footage or misleading

export interface RawFeedItem {
  id: string;
  source: DataSourceType;
  sourceHandle: string;
  sourceAvatar?: string;
  content: string;
  hashtags: string[];
  timestamp: string;
  locationRaw: string;
  isNationalMedia: boolean;
  kafkaTopic: 'raw-social-stream' | 'weather-telemetry' | 'citizen-reports' | 'national-wire';
  kafkaPartition: number;
  kafkaOffset: number;
  mediaUrl?: string;
  sentimentUrgency: number; // 0-100
  credibilityScore: number; // 0-100
}

export interface ExtractedLocation {
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  confidence: number;
}

export interface MLScoreBreakdown {
  credibilityScore: number; // 0-100%
  urgencySentiment: number; // 0-100
  locationConfidence: number; // 0-100%
  duplicateClusterMatch: number; // 0-100%
  accountAuthenticity: 'Official/Verified' | 'High-Trust' | 'Community Elder' | 'Anonymous' | 'Suspicious';
  mediaIntegrity: 'Verified Metadata' | 'Original EXIF' | 'No Media' | 'Flagged Duplicate' | 'Outdated Footage';
}

export interface DisasterEvent {
  id: string;
  title: string;
  summary: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  location: ExtractedLocation;
  affectedRadiusKm: number;
  firstReportedAt: string;
  lastUpdatedAt: string;
  relatedPostsCount: number; // threshold count
  thresholdMet: boolean;     // relatedPostsCount >= 5
  status: EventStatus;
  mlScores: MLScoreBreakdown;
  adminNotes?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  mobileAlertDispatched: boolean;
  mediaUrls: string[];
  keyHighlights: string[];
  officialSafetyGuidance: string[];
  emergencyContacts: { name: string; phone: string; role: string }[];
  rawPosts: RawFeedItem[];
  highTrustSourceBypass?: boolean; // From National Media source direct link
}

export interface CitizenReportSubmission {
  title: string;
  description: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  locationName: string;
  district: string;
  state: string;
  reporterName: string;
  contactNumber: string;
  imageFile?: string;
  immediateRescueNeeded: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  role: string;
  hours: string;
  category: 'National' | 'State' | 'Municipal' | 'Rescue' | 'Medical' | string;
  state?: string;
  district?: string;
  city?: string;
}

export interface EmergencyShelter {
  id: string;
  name: string;
  location: string;
  state: string;
  district: string;
  capacity: string;
  occupied: string;
  supplies: string;
  contact: string;
  lat: number;
  lng: number;
  status: string;
}

export interface AlertFilterOptions {
  status: 'all' | 'verified' | 'assumed' | 'under_review' | 'debunked';
  category: string;
  severity: string;
  state: string;
  searchQuery: string;
}
