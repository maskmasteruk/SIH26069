export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  role: string;
  hours: string;
  category: 'National' | 'State' | 'Municipal' | 'Rescue' | 'Medical';
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
  status: 'Operational · Supplies Active' | 'Standby' | 'Operational · High Occupancy';
}

export const EMERGENCY_CONTACTS: EmergencyContact[] = [
  // Universal National Helplines (applicable across all states)
  {
    id: 'nat-1',
    name: 'National Disaster Management Authority (NDMA)',
    phone: '011-26701728',
    role: 'Central command, interstate deployment & policy coordination',
    hours: '24/7 National Desk',
    category: 'National',
  },
  {
    id: 'nat-2',
    name: 'National Disaster Response Force (NDRF)',
    phone: '1078 / 9711077372',
    role: 'Immediate water rescue, swift-boat teams & collapsed structure SAR',
    hours: '24/7 Tactical Operations',
    category: 'Rescue',
  },
  {
    id: 'nat-3',
    name: 'India Meteorological Department (IMD) Severe Weather Desk',
    phone: '1800-180-1717',
    role: 'Doppler radar bulletins, cyclone track advisory & flash flood warnings',
    hours: 'Round the Clock',
    category: 'National',
  },
  {
    id: 'nat-4',
    name: 'National Emergency Response System',
    phone: '112',
    role: 'All-in-one unified emergency response (Police, Fire, Ambulance)',
    hours: '24/7 Unified Helpline',
    category: 'National',
  },
  {
    id: 'nat-5',
    name: 'Indian Coast Guard Search & Rescue (SAR)',
    phone: '1554',
    role: 'Maritime emergency, offshore fisherman rescue & vessel distress',
    hours: '24/7 Coastal SAR',
    category: 'Rescue',
  },

  // Tamil Nadu / Chennai
  {
    id: 'tn-1',
    name: 'Greater Chennai Corporation Emergency Control',
    phone: '1913 / 044-25619206',
    role: 'Canal overflow, urban water pump stations, municipal relief boats',
    hours: '24/7 Civic Operations',
    category: 'Municipal',
    state: 'Tamil Nadu',
    district: 'Chennai',
    city: 'Chennai',
  },
  {
    id: 'tn-2',
    name: 'Tamil Nadu State Disaster Management (TNSDMA)',
    phone: '1070',
    role: 'State Emergency Operations Centre, dam discharge telemetry',
    hours: 'State SEOC 24/7',
    category: 'State',
    state: 'Tamil Nadu',
    district: 'Chennai',
    city: 'Chennai',
  },
  {
    id: 'tn-3',
    name: 'Chennai District Collectorate Flood Cell',
    phone: '044-25268338',
    role: 'South Chennai relief camp administration & boat dispatch',
    hours: 'Disaster Duty Desk',
    category: 'Municipal',
    state: 'Tamil Nadu',
    district: 'Chennai',
    city: 'Velachery',
  },

  // Odisha / Puri & Coastal
  {
    id: 'od-1',
    name: 'Odisha State Disaster Management Authority (OSDMA)',
    phone: '1070',
    role: 'Coastal evacuation, cyclone shelter allocation & storm surge radar',
    hours: 'State Operations Centre',
    category: 'State',
    state: 'Odisha',
    district: 'Puri',
    city: 'Puri',
  },
  {
    id: 'od-2',
    name: 'Puri District Collectorate Emergency Control',
    phone: '06752-223230',
    role: 'District cyclone control room, high-tide warning & ODRAF teams',
    hours: '24/7 District EOC',
    category: 'Municipal',
    state: 'Odisha',
    district: 'Puri',
    city: 'Puri',
  },
  {
    id: 'od-3',
    name: 'Special Relief Commissioner (SRC) Odisha',
    phone: '0674-2534177',
    role: 'Air-drop food packets, drinking water tanker dispatch',
    hours: 'Round the Clock',
    category: 'State',
    state: 'Odisha',
    district: 'Puri',
    city: 'Bhubaneswar',
  },

  // Assam / Majuli & Jorhat
  {
    id: 'as-1',
    name: 'Assam State Disaster Management Authority (ASDMA)',
    phone: '1079',
    role: 'Brahmaputra basin flood management & SDRF boat patrols',
    hours: 'Flood Emergency Cell',
    category: 'State',
    state: 'Assam',
    district: 'Majuli',
    city: 'Majuli',
  },
  {
    id: 'as-2',
    name: 'Majuli District Emergency Operations Centre',
    phone: '03775-274433',
    role: 'Island evacuation ferry, riverbank erosion response, medical camps',
    hours: '24/7 Island EOC',
    category: 'Municipal',
    state: 'Assam',
    district: 'Majuli',
    city: 'Majuli',
  },

  // Kerala / Wayanad
  {
    id: 'kl-1',
    name: 'Kerala State Disaster Management Authority (KSDMA)',
    phone: '1077',
    role: 'Hillside landslide alarms, heavy rainfall red alert monitoring',
    hours: 'District Emergency Desk',
    category: 'State',
    state: 'Kerala',
    district: 'Wayanad',
    city: 'Wayanad',
  },
  {
    id: 'kl-2',
    name: 'Wayanad District Disaster Operations Center',
    phone: '04936-282224',
    role: 'Meppadi & Chooralmala landslide response, relief camps & earthmovers',
    hours: '24/7 Ghats Control',
    category: 'Municipal',
    state: 'Kerala',
    district: 'Wayanad',
    city: 'Meppadi',
  },

  // Maharashtra / Mumbai
  {
    id: 'mh-1',
    name: 'BMC Disaster Management Control Room',
    phone: '1916 / 022-22694727',
    role: 'High-tide waterlogging, Mithi river sensors & dewatering pumps',
    hours: '24/7 Civic Operations',
    category: 'Municipal',
    state: 'Maharashtra',
    district: 'Mumbai',
    city: 'Mumbai',
  },

  // Karnataka / Bengaluru
  {
    id: 'ka-1',
    name: 'BBMP Disaster Control Center',
    phone: '1533 / 080-22221188',
    role: 'Bengaluru storm water drain overflow & fallen tree clearance',
    hours: '24/7 Operations Desk',
    category: 'Municipal',
    state: 'Karnataka',
    district: 'Bengaluru',
    city: 'Bengaluru',
  },
];

export const EMERGENCY_SHELTERS: EmergencyShelter[] = [
  {
    id: 'sh-chennai-1',
    name: 'Guru Nanak College Relief Center',
    location: 'Velachery Main Road, Chennai (TN)',
    state: 'Tamil Nadu',
    district: 'Chennai',
    capacity: '450 Persons',
    occupied: '180 Occupied',
    supplies: 'Clean Drinking Water, Community Kitchen, Medical Aid Station',
    contact: '044-22451700',
    lat: 12.9915,
    lng: 80.222,
    status: 'Operational · Supplies Active',
  },
  {
    id: 'sh-chennai-2',
    name: 'Ripon Civic Evacuation Camp',
    location: 'Periamet, Central Chennai (TN)',
    state: 'Tamil Nadu',
    district: 'Chennai',
    capacity: '800 Persons',
    occupied: '310 Occupied',
    supplies: 'Inflatable Boats, Power Generators, Medical Dispensary',
    contact: '044-25619200',
    lat: 13.0838,
    lng: 80.2745,
    status: 'Operational · Supplies Active',
  },
  {
    id: 'sh-puri-1',
    name: 'Puri District Multipurpose Cyclone Shelter #12',
    location: 'Brahmagiri Road, Puri (OD)',
    state: 'Odisha',
    district: 'Puri',
    capacity: '1,200 Persons',
    occupied: '420 Occupied',
    supplies: 'Reinforced Concrete Structure, Backup Gensets, Satellite Radio',
    contact: '06752-223230',
    lat: 19.825,
    lng: 85.815,
    status: 'Operational · Supplies Active',
  },
  {
    id: 'sh-puri-2',
    name: 'Astaranga Coastal Evacuation Center',
    location: 'Astaranga Coast, Puri (OD)',
    state: 'Odisha',
    district: 'Puri',
    capacity: '750 Persons',
    occupied: '190 Occupied',
    supplies: 'Life Jackets, High-Decibel Warning Sirens, Dry Rations',
    contact: '06752-243110',
    lat: 19.982,
    lng: 86.265,
    status: 'Operational · Supplies Active',
  },
  {
    id: 'sh-majuli-1',
    name: 'Kamalabari High School Evacuation Post',
    location: 'Majuli Island (AS)',
    state: 'Assam',
    district: 'Majuli',
    capacity: '600 Persons',
    occupied: '290 Occupied',
    supplies: 'SDRF Boat Patrol, Elevated Plinth, Water Purification Kits',
    contact: '03775-274433',
    lat: 26.975,
    lng: 94.225,
    status: 'Operational · Supplies Active',
  },
  {
    id: 'sh-wayanad-1',
    name: 'Meppadi Panchayat Community Hall',
    location: 'Chooralmala Junction, Wayanad (KL)',
    state: 'Kerala',
    district: 'Wayanad',
    capacity: '350 Persons',
    occupied: '85 Occupied',
    supplies: 'Trauma First Aid, Rain Gear, Warm Bedding, Ambulances',
    contact: '04936-282224',
    lat: 11.545,
    lng: 76.132,
    status: 'Operational · Supplies Active',
  },
  {
    id: 'sh-mumbai-1',
    name: 'Dadar BMC Relief & Evacuation Center',
    location: 'Dadar West, Mumbai (MH)',
    state: 'Maharashtra',
    district: 'Mumbai',
    capacity: '500 Persons',
    occupied: '120 Occupied',
    supplies: 'Dewatering Pumps, Food Packets, Emergency Ambulances',
    contact: '022-24224000',
    lat: 19.0178,
    lng: 72.8478,
    status: 'Standby',
  },
];
