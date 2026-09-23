import { DisasterEvent, RawFeedItem } from '../types';

export const HERO_IMAGE = '/src/assets/images/hero_emergency_relief_1790136760747.jpg';
export const CHENNAI_FLOOD_IMAGE = '/src/assets/images/incident_flooding_chennai_1790136774613.jpg';
export const CYCLONE_ODISHA_IMAGE = '/src/assets/images/incident_cyclone_odisha_1790136787380.jpg';
export const ADMIN_OFFICER_AVATAR = '/src/assets/images/avatar_admin_officer_1790136797834.jpg';

export const INITIAL_RAW_FEED: RawFeedItem[] = [
  {
    id: 'raw-101',
    source: 'weather_api',
    sourceHandle: 'IMD Automated Feed',
    content: 'IMD Red Alert Bulletin: Severe coastal depression intensifying into cyclonic system near Bay of Bengal. Wind gusts 85-95 kmph expected along Odisha-Bengal coast.',
    hashtags: ['#IMD', '#Cyclone', '#OdishaWeather', '#IndiaWeather'],
    timestamp: '12 mins ago',
    locationRaw: 'Puri Coast, Odisha (19.8135, 85.8312)',
    isNationalMedia: false,
    kafkaTopic: 'weather-telemetry',
    kafkaPartition: 0,
    kafkaOffset: 48921,
    sentimentUrgency: 92,
    credibilityScore: 98,
  },
  {
    id: 'raw-102',
    source: 'national_media',
    sourceHandle: 'Press Trust of India (PTI)',
    content: 'State Emergency Operation Centre issues high-tide warning for Jagatsinghpur and Kendrapara. 18 NDRF teams deployed across sensitive blocks.',
    hashtags: ['#IMD', '#Cyclone', '#OdishaNews'],
    timestamp: '18 mins ago',
    locationRaw: 'Bhubaneswar / Puri, Odisha',
    isNationalMedia: true,
    kafkaTopic: 'national-wire',
    kafkaPartition: 1,
    kafkaOffset: 12403,
    sentimentUrgency: 88,
    credibilityScore: 99,
  },
  {
    id: 'raw-103',
    source: 'x',
    sourceHandle: '@chennaicity_citizen',
    content: 'Water entering ground floor apartments along 100 Feet Road Velachery. Canal overflow at Vijay Nagar bus stand. Vehicles cannot pass. #ChennaiRain #Rain #IMD',
    hashtags: ['#ChennaiRain', '#Rain', '#IMD', '#Waterlogging'],
    timestamp: '24 mins ago',
    locationRaw: 'Velachery, Chennai, Tamil Nadu',
    isNationalMedia: false,
    kafkaTopic: 'raw-social-stream',
    kafkaPartition: 2,
    kafkaOffset: 89311,
    mediaUrl: CHENNAI_FLOOD_IMAGE,
    sentimentUrgency: 84,
    credibilityScore: 86,
  },
  {
    id: 'raw-104',
    source: 'citizen_report',
    sourceHandle: 'Citizen Ground Reporter #419',
    content: 'Velachery railway bridge underpass submerged under 3.5 feet of water. 4 motorists helped to safety by municipal civil defense volunteers.',
    hashtags: ['#ChennaiRain', '#Rescue'],
    timestamp: '31 mins ago',
    locationRaw: 'Velachery MRTS, Chennai',
    isNationalMedia: false,
    kafkaTopic: 'citizen-reports',
    kafkaPartition: 3,
    kafkaOffset: 5204,
    sentimentUrgency: 89,
    credibilityScore: 91,
  },
  {
    id: 'raw-105',
    source: 'instagram',
    sourceHandle: '@assam_flood_watch',
    content: 'Water level of Brahmaputra rising rapidly at Dhubri and Nimatighat. Low-lying farms in Majuli district facing active erosion. #IndiaWeather #Rain #AssamFloods',
    hashtags: ['#IndiaWeather', '#Rain', '#AssamFloods', '#Flood'],
    timestamp: '38 mins ago',
    locationRaw: 'Majuli Island, Assam',
    isNationalMedia: false,
    kafkaTopic: 'raw-social-stream',
    kafkaPartition: 2,
    kafkaOffset: 89312,
    sentimentUrgency: 76,
    credibilityScore: 78,
  },
  {
    id: 'raw-106',
    source: 'social_media',
    sourceHandle: 'Viral WhatsApp Forward',
    content: 'ALERT: Mithi river overflow dam has broken in Kurla! 10 feet water rushing towards station, evacuate right now!!',
    hashtags: ['#MumbaiRains', '#Kurla', '#FakeNewsAlert'],
    timestamp: '45 mins ago',
    locationRaw: 'Kurla West, Mumbai, Maharashtra',
    isNationalMedia: false,
    kafkaTopic: 'raw-social-stream',
    kafkaPartition: 2,
    kafkaOffset: 89313,
    sentimentUrgency: 95,
    credibilityScore: 18,
  },
  {
    id: 'raw-107',
    source: 'citizen_report',
    sourceHandle: 'Panchayat Seva Volunteer',
    content: 'Continuous downpour on Meppadi ghat road. Minor rock dislodgement noticed near tea plantation culvert. Precautionary warning recommended.',
    hashtags: ['#Wayanad', '#Rain', '#LandslideAlert'],
    timestamp: '52 mins ago',
    locationRaw: 'Meppadi, Wayanad, Kerala',
    isNationalMedia: false,
    kafkaTopic: 'citizen-reports',
    kafkaPartition: 3,
    kafkaOffset: 5205,
    sentimentUrgency: 68,
    credibilityScore: 89,
  }
];

export const INITIAL_EVENTS: DisasterEvent[] = [
  {
    id: 'EVT-2026-CHN-01',
    title: 'Severe Urban Inundation & Canal Surge in Velachery',
    summary: 'Heavy localized rainfall exceeding 140mm within 4 hours has triggered canal overflow across Velachery, Vijayanagar, and Madipakkam sectors. Relief boats deployed.',
    category: 'urban_waterlogging',
    severity: 'Critical',
    location: {
      name: 'Velachery & Madipakkam',
      district: 'Chennai',
      state: 'Tamil Nadu',
      lat: 12.9815,
      lng: 80.2180,
      confidence: 96,
    },
    affectedRadiusKm: 6.5,
    firstReportedAt: '2 hours ago',
    lastUpdatedAt: '8 mins ago',
    relatedPostsCount: 14,
    thresholdMet: true,
    status: 'verified_original',
    mlScores: {
      credibilityScore: 94,
      urgencySentiment: 88,
      locationConfidence: 96,
      duplicateClusterMatch: 92,
      accountAuthenticity: 'Official/Verified',
      mediaIntegrity: 'Original EXIF',
    },
    adminNotes: 'Confirmed by Greater Chennai Corporation Control Room. 4 motorized inflatable boats stationed at Velachery MRTS. Municipal power pumps active.',
    verifiedBy: 'S. Narayanan (Joint Director, SDMA)',
    verifiedAt: '1 hour ago',
    mobileAlertDispatched: true,
    mediaUrls: [CHENNAI_FLOOD_IMAGE],
    keyHighlights: [
      'Canal discharge rate: 3,200 cusecs',
      'GCC helpline 1913 receiving distress rerouting',
      'Shelter opened at Guru Nanak College campus',
      'All commercial bus operations on 100ft road diverted via Bypass'
    ],
    officialSafetyGuidance: [
      'Avoid walking or driving through standing canal water due to submerged manholes',
      'Move household essentials to first-floor level',
      'Dial 1913 or NDRF control at 044-25619206 for immediate boat assistance'
    ],
    emergencyContacts: [
      { name: 'Greater Chennai Corporation Helpline', phone: '1913', role: 'Civic Distress' },
      { name: 'Velachery Emergency Boat Control', phone: '044-22448100', role: 'Evacuation Unit' },
      { name: 'TANGEDCO Power Safety Office', phone: '94987 94987', role: 'Electrical Disconnect' }
    ],
    rawPosts: [INITIAL_RAW_FEED[2], INITIAL_RAW_FEED[3]],
    highTrustSourceBypass: false
  },
  {
    id: 'EVT-2026-ODS-02',
    title: 'Severe Cyclonic Storm Alert & Coastal Surge Warning',
    summary: 'Deep depression in Bay of Bengal upgraded to Severe Cyclonic Storm. Landfall tracking between Puri and Dhamra port with wind gusts up to 110 kmph.',
    category: 'severe_cyclone',
    severity: 'Critical',
    location: {
      name: 'Puri & Kendrapara Coast',
      district: 'Puri',
      state: 'Odisha',
      lat: 19.8135,
      lng: 85.8312,
      confidence: 99,
    },
    affectedRadiusKm: 45.0,
    firstReportedAt: '3 hours ago',
    lastUpdatedAt: '12 mins ago',
    relatedPostsCount: 28,
    thresholdMet: true,
    status: 'verified_original',
    mlScores: {
      credibilityScore: 98,
      urgencySentiment: 92,
      locationConfidence: 99,
      duplicateClusterMatch: 95,
      accountAuthenticity: 'Official/Verified',
      mediaIntegrity: 'Verified Metadata',
    },
    adminNotes: 'Automated high-trust pathway triggered via National Media (PTI) and IMD Doppler radar stream. Bypassed unverified pool directly to verified database.',
    verifiedBy: 'IMD National Cyclone Warning Centre & OSDMA',
    verifiedAt: '2 hours ago',
    mobileAlertDispatched: true,
    mediaUrls: [CYCLONE_ODISHA_IMAGE],
    keyHighlights: [
      'Storm surge of 1.0 to 1.5 meters predicted during high tide',
      'Complete suspension of fishing operations along entire coastal belt',
      'Special Relief Commissioner ordered evacuation of katcha houses within 5km of shoreline',
      'ODRAF & NDRF 12 battalions stationed on high alert'
    ],
    officialSafetyGuidance: [
      'Move to designated cyclone shelters before 18:00 IST',
      'Keep battery-operated emergency transceivers and mobile power banks charged',
      'Stock 72 hours of sealed potable drinking water and emergency dry rations'
    ],
    emergencyContacts: [
      { name: 'Odisha Disaster Management (OSDMA)', phone: '1070', role: 'State Operations Centre' },
      { name: 'Puri District Collectorate Control', phone: '06752-223230', role: 'Regional Headquarters' },
      { name: 'Indian Coast Guard SAR Centre', phone: '1554', role: 'Maritime Rescue' }
    ],
    rawPosts: [INITIAL_RAW_FEED[0], INITIAL_RAW_FEED[1]],
    highTrustSourceBypass: true
  },
  {
    id: 'EVT-2026-ASM-03',
    title: 'Brahmaputra Embankment Overflow & Lowland Seepage',
    summary: 'Corroborated by 6 independent social media posts and community reports (#AssamFloods). Water level surpassing danger mark by 0.65m at Nimatighat.',
    category: 'flash_flood',
    severity: 'Severe',
    location: {
      name: 'Majuli & Jorhat Riverbank',
      district: 'Majuli',
      state: 'Assam',
      lat: 26.9602,
      lng: 94.2155,
      confidence: 88,
    },
    affectedRadiusKm: 18.0,
    firstReportedAt: '55 mins ago',
    lastUpdatedAt: '15 mins ago',
    relatedPostsCount: 6,
    thresholdMet: true,
    status: 'assumed_event', // Threshold >= 5 reached! Visible to public with assumed banner, pending admin verification
    mlScores: {
      credibilityScore: 82,
      urgencySentiment: 76,
      locationConfidence: 88,
      duplicateClusterMatch: 84,
      accountAuthenticity: 'High-Trust',
      mediaIntegrity: 'Original EXIF',
    },
    adminNotes: 'Corroboration threshold of 5 posts reached via Instagram & local citizen alerts. Automatically promoted to Assumed Event. Assigned to Duty Officer for on-ground field verification.',
    verifiedBy: undefined,
    verifiedAt: undefined,
    mobileAlertDispatched: false,
    mediaUrls: [HERO_IMAGE],
    keyHighlights: [
      'Multiple independent reports verified within 20km radius',
      'Ferry services between Jorhat and Majuli suspended until river stabilizes',
      'SDRF alert issued to Kamalabari and Bongaon revenue circles'
    ],
    officialSafetyGuidance: [
      'Residents within 500m of unpaved bunds should prepare for temporary shelter transition',
      'Do not attempt crossing overflowing bamboo footbridges',
      'Secure cattle and agricultural livestock to higher grounds'
    ],
    emergencyContacts: [
      { name: 'Assam State Disaster Management', phone: '1079', role: 'Toll-Free Control' },
      { name: 'Majuli District Disaster Office', phone: '03775-274433', role: 'Local Evacuation' }
    ],
    rawPosts: [INITIAL_RAW_FEED[4]],
    highTrustSourceBypass: false
  },
  {
    id: 'EVT-2026-KL-04',
    title: 'Hillside Debris Movement Risk near Plantation Road',
    summary: 'Three citizen reports received regarding soil fissure and mud slippage along Meppadi tea estate trail. Threshold (5) not reached within 45-minute timeout; routed to human triage.',
    category: 'landslide',
    severity: 'Moderate',
    location: {
      name: 'Meppadi Hills',
      district: 'Wayanad',
      state: 'Kerala',
      lat: 11.5518,
      lng: 76.1264,
      confidence: 85,
    },
    affectedRadiusKm: 3.5,
    firstReportedAt: '1 hour ago',
    lastUpdatedAt: '25 mins ago',
    relatedPostsCount: 3,
    thresholdMet: false,
    status: 'admin_review', // Threshold not met / time limit reached -> routed to Admin Review
    mlScores: {
      credibilityScore: 78,
      urgencySentiment: 68,
      locationConfidence: 85,
      duplicateClusterMatch: 64,
      accountAuthenticity: 'Community Elder',
      mediaIntegrity: 'Verified Metadata',
    },
    adminNotes: 'Timeout reached with 3 corroborating reports. Sent to Admin Review queue. Geologist field team dispatched to inspect fissure depth before public alert.',
    verifiedBy: undefined,
    verifiedAt: undefined,
    mobileAlertDispatched: false,
    mediaUrls: [],
    keyHighlights: [
      'Precautionary routing to prevent omission of early slope instability warnings',
      'Rainfall gauge logged 92mm in last 6 hours',
      'Panchayat patrol inspecting culverts'
    ],
    officialSafetyGuidance: [
      'Maintain vigilance on steep cut slopes behind dwellings',
      'Listen for unusual rumbling sounds or muddy ground seepage',
      'Follow revenue department directives if relocation advisory is issued'
    ],
    emergencyContacts: [
      { name: 'Wayanad District Emergency Centre', phone: '04936-204151', role: 'Collectorate Control' },
      { name: 'Meppadi Police Station', phone: '04936-282224', role: 'Local Law & Order' }
    ],
    rawPosts: [INITIAL_RAW_FEED[6]],
    highTrustSourceBypass: false
  },
  {
    id: 'EVT-2026-MUM-05',
    title: 'DEBUNKED: Fabricated Claim of Mithi River Dam Collapse',
    summary: 'Viral social media panic message claiming Mithi river dam collapse has been verified as completely FAKE by municipal engineers. Old 2017 footage from another state was falsely captioned.',
    category: 'urban_waterlogging',
    severity: 'Advisory',
    location: {
      name: 'Kurla West & BKC Channel',
      district: 'Mumbai Suburban',
      state: 'Maharashtra',
      lat: 19.0728,
      lng: 72.8826,
      confidence: 94,
    },
    affectedRadiusKm: 5.0,
    firstReportedAt: '2 hours ago',
    lastUpdatedAt: '30 mins ago',
    relatedPostsCount: 19,
    thresholdMet: true,
    status: 'marked_fake', // Admin verified as fake rumor
    mlScores: {
      credibilityScore: 18,
      urgencySentiment: 95,
      locationConfidence: 94,
      duplicateClusterMatch: 88,
      accountAuthenticity: 'Suspicious',
      mediaIntegrity: 'Outdated Footage',
    },
    adminNotes: 'Reverse image and video frame analysis confirmed footage originated from 2017 outside Maharashtra. MCGM engineers verified water level is normal at 2.1 meters. Official debunk tag attached.',
    verifiedBy: 'MCGM Disaster Management Cell & Cyber Security Unit',
    verifiedAt: '1 hour ago',
    mobileAlertDispatched: false,
    mediaUrls: [],
    keyHighlights: [
      'Fact-checked & debunked by municipal engineers and cyber verification wing',
      'Mithi river floodgates operating normally with tidal outflow',
      'Advisory issued against forwarding unverified audio panics on messaging apps'
    ],
    officialSafetyGuidance: [
      'Do not forward unverified emergency claims without checking official portals',
      'Follow verified updates on @mybmc and @MumbaiPolice official channels',
      'Report rumor mongering to the Cyber Crime helpline at 1930'
    ],
    emergencyContacts: [
      { name: 'BMC Disaster Management Helpline', phone: '1916', role: 'Mumbai Civic Central' },
      { name: 'Cyber Crime Debunking Desk', phone: '1930', role: 'Misinformation Reporting' }
    ],
    rawPosts: [INITIAL_RAW_FEED[5]],
    highTrustSourceBypass: false
  },
  {
    id: 'EVT-2026-BLR-06',
    title: 'MISLEADING: Recycled 2022 Rainbow Drive Inundation Clip',
    summary: 'Recycled video from 2022 Bellandur storm being shared as current Bangalore rain damage. Current conditions on Sarjapur road remain dry with normal traffic flow.',
    category: 'urban_waterlogging',
    severity: 'Advisory',
    location: {
      name: 'Sarjapur & Bellandur',
      district: 'Bengaluru Urban',
      state: 'Karnataka',
      lat: 12.9260,
      lng: 77.6762,
      confidence: 91,
    },
    affectedRadiusKm: 4.0,
    firstReportedAt: '3 hours ago',
    lastUpdatedAt: '1 hour ago',
    relatedPostsCount: 8,
    thresholdMet: true,
    status: 'marked_misleading',
    mlScores: {
      credibilityScore: 24,
      urgencySentiment: 71,
      locationConfidence: 91,
      duplicateClusterMatch: 82,
      accountAuthenticity: 'Anonymous',
      mediaIntegrity: 'Outdated Footage',
    },
    adminNotes: 'EXIF timestamp analysis revealed video was recorded in September 2022. BBMP war room ground cameras confirm clear roads.',
    verifiedBy: 'BBMP Smart City War Room',
    verifiedAt: '2 hours ago',
    mobileAlertDispatched: false,
    mediaUrls: [],
    keyHighlights: [
      'EXIF verification matched archival footage from 2022 Bangalore monsoon',
      'BBMP telemetry sensors show 0mm rainfall in last 12 hours in this zone',
      'Labeled as Misleading in community feed'
    ],
    officialSafetyGuidance: [
      'Cross-check road waterlogging via BBMP live ward monitors',
      'Refrain from sharing sensational unverified viral video clips'
    ],
    emergencyContacts: [
      { name: 'BBMP Central Control Room', phone: '080-22221188', role: 'Civic Help' },
      { name: 'Bengaluru Traffic Police Helpline', phone: '1095', role: 'Traffic Status' }
    ],
    rawPosts: [],
    highTrustSourceBypass: false
  },
  {
    id: 'EVT-2026-VDB-07',
    title: 'Severe Heatwave Alert & Agricultural Water Depletion',
    summary: 'Daytime surface temperatures reaching 44.8°C across Chandrapur and Nagpur districts. Yellow alert conditions with hot advection winds.',
    category: 'extreme_heatwave',
    severity: 'Moderate',
    location: {
      name: 'Chandrapur & Wardha',
      district: 'Chandrapur',
      state: 'Maharashtra',
      lat: 19.9615,
      lng: 79.2961,
      confidence: 78,
    },
    affectedRadiusKm: 60.0,
    firstReportedAt: '40 mins ago',
    lastUpdatedAt: '40 mins ago',
    relatedPostsCount: 2,
    thresholdMet: false,
    status: 'unverified_pool', // In unverified pool, threshold < 5
    mlScores: {
      credibilityScore: 65,
      urgencySentiment: 52,
      locationConfidence: 78,
      duplicateClusterMatch: 45,
      accountAuthenticity: 'Anonymous',
      mediaIntegrity: 'No Media',
    },
    adminNotes: 'Early reports received. Corroborating with district agro-meteorological station telemetry.',
    verifiedBy: undefined,
    verifiedAt: undefined,
    mobileAlertDispatched: false,
    mediaUrls: [],
    keyHighlights: [
      '2 initial social reports received via #IndiaWeather hashtag',
      'Awaiting corroboration to meet threshold 5 or time timeout'
    ],
    officialSafetyGuidance: [
      'Avoid direct outdoor exposure between 12:00 and 15:30 IST',
      'Maintain adequate oral hydration using ORS and traditional buttermilk'
    ],
    emergencyContacts: [
      { name: 'District Health Officer Chandrapur', phone: '07172-252100', role: 'Heat Stroke Relief' }
    ],
    rawPosts: [],
    highTrustSourceBypass: false
  }
];
