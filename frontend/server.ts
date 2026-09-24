import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { Kafka, logLevel, Producer } from 'kafkajs';
import { Pool } from 'pg';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || process.env.FRONTEND_PORT || 3000);
const sessionSecret = process.env.ADMIN_SESSION_SECRET || 'local-dev-admin-session-secret';
const sessionHours = Number(process.env.ADMIN_SESSION_HOURS || 8);
const sessionTtlSeconds = (Number.isFinite(sessionHours) && sessionHours > 0 ? sessionHours : 8) * 60 * 60;
const kafkaBootstrapServers = (process.env.KAFKA_BOOTSTRAP_SERVERS || 'localhost:9092')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);
const citizenReportsKafkaTopic =
  process.env.CITIZEN_REPORTS_TOPIC ||
  process.env.KAFKA_CITIZEN_REPORTS_TOPIC ||
  'citizen-reports';
const frontendKafkaEnabled = process.env.ENABLE_FRONTEND_KAFKA_REPORTS !== 'false';
const kafkaClientId = process.env.KAFKA_CLIENT_ID || 'wave-frontend-api';
const kafkaConnectionTimeoutMs = Number(process.env.KAFKA_CONNECTION_TIMEOUT_MS || 2500);
const kafkaRequestTimeoutMs = Number(process.env.KAFKA_REQUEST_TIMEOUT_MS || 3000);

let kafkaProducerPromise: Promise<Producer | null> | null = null;
let kafkaProducerUnavailable = false;

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: Number(process.env.POSTGRES_PORT || 5432),
        database: process.env.POSTGRES_DB || 'disaster_events',
        user: process.env.POSTGRES_USER || 'disaster_admin',
        password: process.env.POSTGRES_PASSWORD || 'disaster_password',
      }
);

interface AdminUserRecord {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: string | null;
}

interface AdminSessionPayload {
  sub: string;
  username: string;
  email: string;
  role: string;
  exp: number;
}

type IncidentSeverity = 'Critical' | 'Severe' | 'Moderate' | 'Advisory';
type FrontendEventStatus =
  | 'unverified_pool'
  | 'assumed_event'
  | 'admin_review'
  | 'verified_original'
  | 'marked_fake'
  | 'marked_misleading';

const VALID_CATEGORIES = new Set([
  'flash_flood',
  'severe_cyclone',
  'urban_waterlogging',
  'landslide',
  'extreme_heatwave',
  'heavy_thunderstorm',
]);

const VALID_SEVERITIES = new Set(['Critical', 'Severe', 'Moderate', 'Advisory']);
const DEFAULT_THRESHOLD = 5;

const normalizeUsername = (username: unknown) =>
  typeof username === 'string' ? username.trim().toLowerCase() : '';

const toAdminResponse = (user: Pick<AdminUserRecord, 'id' | 'username' | 'email' | 'role'>) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role || 'admin',
});

const hashPassword = async (password: string) => {
  const salt = crypto.randomBytes(16).toString('base64url');
  const iterations = 310000;
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, 32, 'sha256', (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });

  return `pbkdf2_sha256$${iterations}$${salt}$${derivedKey.toString('base64url')}`;
};

const verifyPassword = async (password: string, storedHash: string) => {
  const [algorithm, iterationsValue, salt, hash] = storedHash.split('$');
  if (algorithm !== 'pbkdf2_sha256' || !iterationsValue || !salt || !hash) {
    return false;
  }

  const iterations = Number(iterationsValue);
  if (!Number.isInteger(iterations) || iterations < 100000) {
    return false;
  }

  const expected = Buffer.from(hash, 'base64url');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, expected.length, 'sha256', (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });

  return expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey);
};

const signSession = (user: Pick<AdminUserRecord, 'id' | 'username' | 'email' | 'role'>) => {
  const payload: AdminSessionPayload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    role: user.role || 'admin',
    exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds,
  };
  const payloadPart = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', sessionSecret)
    .update(payloadPart)
    .digest('base64url');

  return { token: `${payloadPart}.${signature}`, payload };
};

const verifySession = (token: string): AdminSessionPayload | null => {
  const [payloadPart, signature] = token.split('.');
  if (!payloadPart || !signature) {
    return null;
  }

  const expectedSignature = crypto
    .createHmac('sha256', sessionSecret)
    .update(payloadPart)
    .digest('base64url');

  const provided = Buffer.from(signature, 'base64url');
  const expected = Buffer.from(expectedSignature, 'base64url');
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadPart, 'base64url').toString('utf8')
    ) as AdminSessionPayload;
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const getBearerToken = (req: Request) => {
  const header = req.header('authorization') || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' ? token : '';
};

const getAdminByUsername = async (username: string) => {
  const { rows } = await pool.query<AdminUserRecord>(
    `SELECT id, username, email, password_hash, role
     FROM admin_users
     WHERE lower(username) = $1
     LIMIT 1`,
    [username]
  );
  return rows[0] || null;
};

const getAdminById = async (id: string) => {
  const { rows } = await pool.query<Pick<AdminUserRecord, 'id' | 'username' | 'email' | 'role'>>(
    `SELECT id, username, email, role
     FROM admin_users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

const getRequestAdmin = async (req: Request) => {
  const payload = verifySession(getBearerToken(req));
  if (!payload) {
    return null;
  }

  return getAdminById(payload.sub);
};

const ensureFrontendDataSchema = async () => {
  await pool.query(`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30),
    ADD COLUMN IF NOT EXISTS frontend_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS mobile_alert_dispatched BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS verified_by_name TEXT
  `);

  await pool.query(`
    ALTER TABLE events
    ADD COLUMN IF NOT EXISTS event_point POINT
    GENERATED ALWAYS AS (point(longitude, latitude)) STORED
  `);

  await pool.query(indianCoordinateBackfillSql);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_events_latitude_required_india'
      ) THEN
        ALTER TABLE events
        ADD CONSTRAINT ck_events_latitude_required_india
        CHECK (latitude IS NOT NULL AND latitude BETWEEN 6.0 AND 37.6)
        NOT VALID;
      END IF;
    END
    $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_events_longitude_required_india'
      ) THEN
        ALTER TABLE events
        ADD CONSTRAINT ck_events_longitude_required_india
        CHECK (longitude IS NOT NULL AND longitude BETWEEN 68.0 AND 97.5)
        NOT VALID;
      END IF;
    END
    $$;
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_events_event_point ON events USING gist(event_point)`);
  await pool.query(`ALTER TABLE events VALIDATE CONSTRAINT ck_events_latitude_required_india`);
  await pool.query(`ALTER TABLE events VALIDATE CONSTRAINT ck_events_longitude_required_india`);
  await pool.query(`ALTER TABLE events ALTER COLUMN latitude SET NOT NULL`);
  await pool.query(`ALTER TABLE events ALTER COLUMN longitude SET NOT NULL`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      role TEXT NOT NULL,
      hours TEXT NOT NULL DEFAULT '24/7',
      category VARCHAR(30) NOT NULL,
      state TEXT,
      district TEXT,
      city TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS emergency_shelters (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      state TEXT NOT NULL,
      district TEXT NOT NULL,
      capacity TEXT NOT NULL DEFAULT 'Not specified',
      occupied TEXT NOT NULL DEFAULT 'Not specified',
      supplies TEXT NOT NULL DEFAULT 'Not specified',
      contact TEXT NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      status TEXT NOT NULL DEFAULT 'Standby',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_emergency_contacts_region ON emergency_contacts(state, district, city)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_emergency_shelters_region ON emergency_shelters(state, district)`);
};

const ensureDefaultAdmin = async () => {
  if (process.env.ADMIN_BOOTSTRAP_ENABLED === 'false') {
    return;
  }

  const username = normalizeUsername(process.env.ADMIN_BOOTSTRAP_USERNAME || 'admin') || 'admin';
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@wave.local';
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'admin';

  const existing = await getAdminByUsername(username);
  if (existing) {
    return;
  }

  const passwordHash = await hashPassword(password);
  await pool.query(
    `INSERT INTO admin_users (username, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (username) DO NOTHING`,
    [username, email, passwordHash]
  );
  console.log(`Seeded local admin user "${username}" in PostgreSQL.`);
};

const parseJson = (value: unknown): Record<string, any> => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const asContactArray = (value: unknown) =>
  Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === 'object')
        .map((item: any) => ({
          name: String(item.name || ''),
          phone: String(item.phone || ''),
          role: String(item.role || ''),
        }))
        .filter((item) => item.name && item.phone)
    : [];

const numericPercent = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(percent)));
};

const numericValue = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const numericOrNull = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const isInsideIndia = (lat: number | null, lng: number | null) =>
  lat !== null && lng !== null && lat >= 6.0 && lat <= 37.6 && lng >= 68.0 && lng <= 97.5;

const requiredText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const optionalText = (value: unknown) => {
  const text = requiredText(value);
  return text || null;
};

const getKafkaProducer = async () => {
  if (!frontendKafkaEnabled || kafkaBootstrapServers.length === 0 || kafkaProducerUnavailable) {
    return null;
  }

  if (!kafkaProducerPromise) {
    kafkaProducerPromise = (async () => {
      try {
        const securityProtocol = String(process.env.KAFKA_SECURITY_PROTOCOL || 'PLAINTEXT').toUpperCase();
        const username = process.env.KAFKA_USERNAME || '';
        const password = process.env.KAFKA_PASSWORD || '';
        const kafka = new Kafka({
          clientId: kafkaClientId,
          brokers: kafkaBootstrapServers,
          connectionTimeout: Number.isFinite(kafkaConnectionTimeoutMs) ? kafkaConnectionTimeoutMs : 2500,
          requestTimeout: Number.isFinite(kafkaRequestTimeoutMs) ? kafkaRequestTimeoutMs : 3000,
          logLevel: logLevel.ERROR,
          ssl: securityProtocol.includes('SSL') || undefined,
          sasl:
            username && password
              ? ({
                  mechanism: String(process.env.KAFKA_SASL_MECHANISM || 'plain').toLowerCase(),
                  username,
                  password,
                } as any)
              : undefined,
          retry: {
            retries: 1,
            initialRetryTime: 250,
          },
        });

        const producer = kafka.producer({
          allowAutoTopicCreation: true,
        });
        await producer.connect();
        console.log(`Citizen report Kafka producer connected to ${kafkaBootstrapServers.join(', ')}`);
        return producer;
      } catch (error) {
        kafkaProducerUnavailable = true;
        console.warn('Citizen report Kafka producer unavailable; using PostgreSQL fallback.', error);
        return null;
      }
    })();
  }

  return kafkaProducerPromise;
};

const publishCitizenReportToKafka = async (payload: Record<string, any>) => {
  const producer = await getKafkaProducer();
  if (!producer) return false;

  try {
    await producer.send({
      topic: citizenReportsKafkaTopic,
      messages: [
        {
          key: String(payload.message_id || payload.event_id || crypto.randomUUID()),
          value: JSON.stringify(payload),
        },
      ],
    });
    return true;
  } catch (error) {
    console.warn('Citizen report Kafka publish failed; using PostgreSQL fallback.', error);
    return false;
  }
};

const indianCoordinateBackfillSql = `
  UPDATE events
  SET
    latitude = COALESCE(
      latitude,
      CASE
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%andhra pradesh%' THEN 15.9129
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%telangana%' THEN 18.1124
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%uttar pradesh%' THEN 26.8467
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%bihar%' THEN 25.0961
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%odisha%' THEN 20.9517
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%orissa%' THEN 20.9517
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%tamil nadu%' THEN 11.1271
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%kerala%' THEN 10.8505
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%karnataka%' THEN 15.3173
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%maharashtra%' THEN 19.7515
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%assam%' THEN 26.2006
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%west bengal%' THEN 22.9868
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%gujarat%' THEN 22.2587
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%rajasthan%' THEN 27.0238
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%madhya pradesh%' THEN 22.9734
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%india%' THEN 22.9734
        ELSE 22.9734
      END
    ),
    longitude = COALESCE(
      longitude,
      CASE
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%andhra pradesh%' THEN 79.7400
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%telangana%' THEN 79.0193
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%uttar pradesh%' THEN 80.9462
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%bihar%' THEN 85.3131
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%odisha%' THEN 85.0985
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%orissa%' THEN 85.0985
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%tamil nadu%' THEN 78.6569
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%kerala%' THEN 76.2711
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%karnataka%' THEN 75.7139
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%maharashtra%' THEN 75.7139
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%assam%' THEN 92.9376
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%west bengal%' THEN 87.8550
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%gujarat%' THEN 71.1924
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%rajasthan%' THEN 74.2179
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%madhya pradesh%' THEN 78.6569
        WHEN lower(COALESCE(location_name, '') || ' ' || COALESCE(title, '')) LIKE '%india%' THEN 78.6569
        ELSE 78.6569
      END
    )
  WHERE latitude IS NULL OR longitude IS NULL
`;

const relativeTime = (value: unknown) => {
  if (!value) return 'Unknown';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return 'Unknown';

  const diffMs = Date.now() - date.getTime();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) return diffMs >= 0 ? 'Just now' : 'In less than a minute';
  if (absMs < hour) {
    const minutes = Math.round(absMs / minute);
    return diffMs >= 0 ? `${minutes} min${minutes === 1 ? '' : 's'} ago` : `In ${minutes} mins`;
  }
  if (absMs < day) {
    const hours = Math.round(absMs / hour);
    return diffMs >= 0 ? `${hours} hour${hours === 1 ? '' : 's'} ago` : `In ${hours} hours`;
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeCategory = (value: unknown) => {
  const text = String(value || '').trim().toLowerCase();
  const normalized = text.replace(/[\s-]+/g, '_');
  if (VALID_CATEGORIES.has(normalized)) return normalized;
  if (normalized.includes('cyclone')) return 'severe_cyclone';
  if (normalized.includes('waterlogging') || normalized.includes('inundation')) return 'urban_waterlogging';
  if (normalized.includes('flood')) return 'flash_flood';
  if (normalized.includes('landslide') || normalized.includes('slope')) return 'landslide';
  if (normalized.includes('heat')) return 'extreme_heatwave';
  if (normalized.includes('thunder') || normalized.includes('rain')) return 'heavy_thunderstorm';
  return 'heavy_thunderstorm';
};

const dbStatusToFrontend = (status: unknown): FrontendEventStatus => {
  const normalized = String(status || '').trim().toLowerCase();
  const map: Record<string, FrontendEventStatus> = {
    unverified: 'unverified_pool',
    pending: 'unverified_pool',
    unverified_pool: 'unverified_pool',
    assumed: 'assumed_event',
    assumed_event: 'assumed_event',
    admin_review: 'admin_review',
    review: 'admin_review',
    verified: 'verified_original',
    verified_original: 'verified_original',
    fake: 'marked_fake',
    marked_fake: 'marked_fake',
    misleading: 'marked_misleading',
    marked_misleading: 'marked_misleading',
    modified: 'admin_review',
  };

  return map[normalized] || 'unverified_pool';
};

const frontendStatusToDb = (status: FrontendEventStatus) => {
  const map: Record<FrontendEventStatus, string> = {
    unverified_pool: 'unverified',
    assumed_event: 'assumed',
    admin_review: 'admin_review',
    verified_original: 'verified',
    marked_fake: 'fake',
    marked_misleading: 'misleading',
  };
  return map[status];
};

const deriveSeverity = (metadata: Record<string, any>, row: Record<string, any>): IncidentSeverity => {
  const fromDb = metadata.severity || row.severity;
  if (VALID_SEVERITIES.has(String(fromDb))) return fromDb as IncidentSeverity;

  const urgency = numericPercent(row.sentiment_score, numericPercent(row.ml_score, 50));
  if (dbStatusToFrontend(row.status) === 'verified_original' && urgency >= 85) return 'Critical';
  if (urgency >= 80) return 'Severe';
  if (urgency >= 50) return 'Moderate';
  return 'Advisory';
};

const deriveLocation = (row: Record<string, any>, metadata: Record<string, any>) => {
  const metadataLocation = parseJson(metadata.location);
  const parts = String(row.location_name || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const name = String(metadataLocation.name || metadata.locationName || row.location_name || 'Unknown location');
  const district = String(
    metadataLocation.district ||
      metadata.district ||
      (parts.length > 1 ? parts[0] : row.location_name || 'Unknown district')
  );
  const state = String(metadataLocation.state || metadata.state || (parts.length > 1 ? parts[parts.length - 1] : 'India'));

  return {
    name,
    district,
    state,
    lat: numericValue(metadataLocation.lat ?? metadata.latitude ?? row.latitude, 20.5937),
    lng: numericValue(metadataLocation.lng ?? metadata.longitude ?? row.longitude, 78.9629),
    confidence: numericPercent(metadataLocation.confidence ?? metadata.locationConfidence ?? row.ml_score, 75),
  };
};

const kafkaTopicForSource = (source: string) => {
  if (source === 'weather_api') return 'weather-telemetry';
  if (source === 'citizen_report') return 'citizen-reports';
  if (source === 'national_media') return 'national-wire';
  return 'raw-social-stream';
};

const normalizeSource = (value: unknown) => {
  const source = String(value || '').trim().toLowerCase();
  if (['x', 'instagram', 'social_media', 'weather_api', 'national_media', 'citizen_report'].includes(source)) {
    return source;
  }
  if (source === 'news') return 'national_media';
  return 'social_media';
};

const sourcePostToRawFeedItem = (row: Record<string, any>) => {
  const rawData = parseJson(row.raw_data);
  const payload = parseJson(rawData.payload);
  const nlp = parseJson(rawData.nlp);
  const ml = parseJson(rawData.ml);
  const source = normalizeSource(row.platform);
  const hashtags =
    asStringArray(payload.hashtags).length > 0
      ? asStringArray(payload.hashtags)
      : asStringArray(nlp.keywords).map((keyword) => (keyword.startsWith('#') ? keyword : `#${keyword}`));

  return {
    id: String(row.id),
    source,
    sourceHandle: String(row.author_name || payload.author || payload.source || 'Database source'),
    content: String(row.content || ''),
    hashtags,
    timestamp: relativeTime(row.published_at || row.collected_at || row.created_at),
    locationRaw: String(payload.location || row.event_location_name || ''),
    isNationalMedia: Boolean(row.is_high_trust || source === 'national_media'),
    kafkaTopic: kafkaTopicForSource(source),
    kafkaPartition: numericValue(payload.kafkaPartition ?? rawData.kafkaPartition, 0),
    kafkaOffset: numericValue(payload.kafkaOffset ?? rawData.kafkaOffset, 0),
    mediaUrl: row.media_url || payload.mediaUrl || undefined,
    sentimentUrgency: numericPercent(payload.sentimentUrgency ?? rawData.sentimentUrgency ?? ml.urgency, 50),
    credibilityScore: numericPercent(row.credibility_score ?? payload.credibilityScore, 50),
  };
};

const eventRowToDisasterEvent = (row: Record<string, any>, rawPosts: ReturnType<typeof sourcePostToRawFeedItem>[]) => {
  const metadata = parseJson(row.frontend_metadata);
  const threshold = numericValue(row.threshold_count, DEFAULT_THRESHOLD) || DEFAULT_THRESHOLD;
  const status = dbStatusToFrontend(row.status);
  const relatedPostsCount = numericValue(row.source_count, rawPosts.length);
  const location = deriveLocation(row, metadata);
  const severity = deriveSeverity(metadata, row);
  const mediaUrls = asStringArray(metadata.mediaUrls || metadata.media_urls);
  const rawMediaUrls = rawPosts.map((post) => post.mediaUrl).filter((url): url is string => Boolean(url));
  const highTrustSourceBypass = rawPosts.some((post) => post.isNationalMedia);

  return {
    id: String(row.id),
    title: String(row.title || row.description || 'Untitled disaster event'),
    summary: String(row.description || row.title || 'No incident summary recorded in PostgreSQL.'),
    category: normalizeCategory(metadata.category || row.event_type),
    severity,
    location,
    affectedRadiusKm: numericValue(metadata.affectedRadiusKm ?? metadata.affected_radius_km, severity === 'Critical' ? 20 : 5),
    firstReportedAt: relativeTime(row.event_time || row.detected_at || row.created_at),
    lastUpdatedAt: relativeTime(row.updated_at || row.detected_at || row.created_at),
    relatedPostsCount,
    thresholdMet: relatedPostsCount >= threshold || ['assumed_event', 'verified_original'].includes(status),
    status,
    mlScores: {
      credibilityScore: numericPercent(row.credibility_score, 50),
      urgencySentiment: numericPercent(row.sentiment_score ?? row.ml_score, 50),
      locationConfidence: location.confidence,
      duplicateClusterMatch: Math.max(0, Math.min(100, Math.round((relatedPostsCount / threshold) * 100))),
      accountAuthenticity: highTrustSourceBypass ? 'Official/Verified' : relatedPostsCount >= threshold ? 'High-Trust' : 'Anonymous',
      mediaIntegrity: rawMediaUrls.length > 0 || mediaUrls.length > 0 ? 'Verified Metadata' : 'No Media',
    },
    adminNotes: row.admin_notes || undefined,
    verifiedBy: row.verified_by_name || row.verifier_username || undefined,
    verifiedAt: row.verified_at ? relativeTime(row.verified_at) : undefined,
    mobileAlertDispatched: Boolean(row.mobile_alert_dispatched),
    mediaUrls: mediaUrls.length > 0 ? mediaUrls : rawMediaUrls,
    keyHighlights: asStringArray(metadata.keyHighlights || metadata.key_highlights),
    officialSafetyGuidance: asStringArray(metadata.officialSafetyGuidance || metadata.official_safety_guidance),
    emergencyContacts: asContactArray(metadata.emergencyContacts || metadata.emergency_contacts),
    rawPosts,
    highTrustSourceBypass,
  };
};

const loadDisasterData = async () => {
  const eventsResult = await pool.query(`
    SELECT e.*, au.username AS verifier_username
    FROM events e
    LEFT JOIN admin_users au ON au.id = e.verified_by
    ORDER BY COALESCE(e.updated_at, e.detected_at, e.created_at) DESC
  `);

  const sourcesResult = await pool.query(`
    SELECT sp.*, e.location_name AS event_location_name
    FROM source_posts sp
    LEFT JOIN events e ON e.id = sp.event_id
    ORDER BY COALESCE(sp.published_at, sp.collected_at, sp.created_at) DESC
    LIMIT 500
  `);

  const rawFeed = sourcesResult.rows.map(sourcePostToRawFeedItem);
  const rawPostsByEvent = new Map<string, ReturnType<typeof sourcePostToRawFeedItem>[]>();
  sourcesResult.rows.forEach((row, index) => {
    if (!row.event_id) return;
    const eventId = String(row.event_id);
    rawPostsByEvent.set(eventId, [...(rawPostsByEvent.get(eventId) || []), rawFeed[index]]);
  });

  return {
    events: eventsResult.rows.map((row) => eventRowToDisasterEvent(row, rawPostsByEvent.get(String(row.id)) || [])),
    rawFeed,
  };
};

const jsonb = (value: unknown) => JSON.stringify(value ?? {});

const buildCitizenReportKafkaPayload = ({
  submission,
  title,
  description,
  locationName,
  district,
  state,
  category,
  severity,
  latitude,
  longitude,
}: {
  submission: Record<string, any>;
  title: string;
  description: string;
  locationName: string;
  district: string;
  state: string;
  category: string;
  severity: string;
  latitude: number;
  longitude: number;
}) => {
  const now = new Date().toISOString();
  const messageId = `citizen-report-${crypto.randomUUID()}`;
  const reporterName = requiredText(submission.reporterName) || 'Anonymous Resident';
  const contactNumber = requiredText(submission.contactNumber) || 'Not provided';
  const mediaUrl = requiredText(submission.imageFile);

  return {
    event_type: category,
    event_version: 1,
    message_id: messageId,
    event_id: messageId,
    source: 'citizen_report',
    platform: 'citizen_report',
    emitted_at: now,
    timestamp: now,
    published_at: now,
    title,
    text: `${title}. ${description}`,
    description,
    severity,
    immediate_rescue_needed: Boolean(submission.immediateRescueNeeded),
    author: reporterName,
    reporter_name: reporterName,
    contact_number: contactNumber,
    media_url: mediaUrl || undefined,
    latitude,
    longitude,
    location: {
      name: locationName,
      district,
      state,
      country: 'India',
      latitude,
      longitude,
      lat: latitude,
      lng: longitude,
      confidence: 90,
    },
    hashtags: ['#CitizenReport', `#${category}`, '#IndiaWeather'],
    sentimentUrgency: submission.immediateRescueNeeded ? 95 : 72,
    credibilityScore: 88,
    frontendSubmission: submission,
  };
};

app.use('/api', express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'postgres' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/events', async (_req, res, next) => {
  try {
    const data = await loadDisasterData();
    res.json({ events: data.events });
  } catch (error) {
    next(error);
  }
});

app.get('/api/raw-feed', async (_req, res, next) => {
  try {
    const data = await loadDisasterData();
    res.json({ rawFeed: data.rawFeed });
  } catch (error) {
    next(error);
  }
});

app.get('/api/emergency-directory', async (_req, res, next) => {
  try {
    const [contactsResult, sheltersResult] = await Promise.all([
      pool.query(`
        SELECT id, name, phone, role, hours, category, state, district, city
        FROM emergency_contacts
        ORDER BY category, state NULLS FIRST, district NULLS FIRST, name
      `),
      pool.query(`
        SELECT id, name, location, state, district, capacity, occupied, supplies, contact,
               latitude AS lat, longitude AS lng, status
        FROM emergency_shelters
        ORDER BY state, district, name
      `),
    ]);

    res.json({
      contacts: contactsResult.rows.map((row) => ({ ...row, id: String(row.id) })),
      shelters: sheltersResult.rows.map((row) => ({
        ...row,
        id: String(row.id),
        lat: numericValue(row.lat, 20.5937),
        lng: numericValue(row.lng, 78.9629),
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/emergency-contacts', async (req, res, next) => {
  try {
    const admin = await getRequestAdmin(req);
    if (!admin) {
      return res.status(401).json({ message: 'Admin session is invalid or expired.' });
    }

    const name = requiredText(req.body?.name);
    const phone = requiredText(req.body?.phone);
    const role = requiredText(req.body?.role);
    const category = requiredText(req.body?.category || 'State').slice(0, 30);
    const hours = requiredText(req.body?.hours || '24/7');
    const state = optionalText(req.body?.state);
    const district = optionalText(req.body?.district);
    const city = optionalText(req.body?.city);

    if (!name || !phone || !role || !category) {
      return res.status(400).json({ message: 'Name, phone, role, and category are required.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO emergency_contacts (name, phone, role, hours, category, state, district, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, phone, role, hours, category, state, district, city`,
      [name, phone, role, hours, category, state, district, city]
    );

    return res.status(201).json({ contact: { ...rows[0], id: String(rows[0].id) } });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/admin/emergency-shelters', async (req, res, next) => {
  try {
    const admin = await getRequestAdmin(req);
    if (!admin) {
      return res.status(401).json({ message: 'Admin session is invalid or expired.' });
    }

    const name = requiredText(req.body?.name);
    const location = requiredText(req.body?.location);
    const state = requiredText(req.body?.state);
    const district = requiredText(req.body?.district);
    const capacity = requiredText(req.body?.capacity || 'Not specified');
    const occupied = requiredText(req.body?.occupied || 'Not specified');
    const supplies = requiredText(req.body?.supplies || 'Not specified');
    const contact = requiredText(req.body?.contact);
    const status = requiredText(req.body?.status || 'Standby');
    const latitude = numericOrNull(req.body?.lat ?? req.body?.latitude);
    const longitude = numericOrNull(req.body?.lng ?? req.body?.longitude);

    if (!name || !location || !state || !district || !contact) {
      return res.status(400).json({ message: 'Name, location, state, district, and contact are required.' });
    }

    if (!isInsideIndia(latitude, longitude)) {
      return res.status(400).json({ message: 'Shelter latitude/longitude must be inside India.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO emergency_shelters (
         name, location, state, district, capacity, occupied, supplies, contact, latitude, longitude, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name, location, state, district, capacity, occupied, supplies, contact,
                 latitude AS lat, longitude AS lng, status`,
      [name, location, state, district, capacity, occupied, supplies, contact, latitude, longitude, status]
    );

    return res.status(201).json({
      shelter: {
        ...rows[0],
        id: String(rows[0].id),
        lat: numericValue(rows[0].lat, 20.5937),
        lng: numericValue(rows[0].lng, 78.9629),
      },
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/admin/login', async (req, res, next) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const user = await getAdminByUsername(username);
    const validPassword = user ? await verifyPassword(password, user.password_hash) : false;
    if (!user || !validPassword) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const { token, payload } = signSession(user);
    return res.json({
      token,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      user: toAdminResponse(user),
    });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/events/:id/verify', async (req, res, next) => {
  try {
    const admin = await getRequestAdmin(req);
    if (!admin) {
      return res.status(401).json({ message: 'Admin session is invalid or expired.' });
    }

    const decision = String(req.body?.decision || '');
    if (!['original', 'fake', 'misleading'].includes(decision)) {
      return res.status(400).json({ message: 'Invalid verification decision.' });
    }

    const statusMap: Record<string, FrontendEventStatus> = {
      original: 'verified_original',
      fake: 'marked_fake',
      misleading: 'marked_misleading',
    };
    const newStatus = statusMap[decision];
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : '';
    const officerName =
      typeof req.body?.officerName === 'string' && req.body.officerName.trim()
        ? req.body.officerName.trim()
        : admin.username;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query('SELECT status FROM events WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (current.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Event not found.' });
      }

      await client.query(
        `UPDATE events
         SET status = $2,
             verification_status = $3,
             admin_notes = COALESCE(NULLIF($4, ''), admin_notes),
             verified_by = $5,
             verified_by_name = $6,
             verified_at = NOW(),
             mobile_alert_dispatched = CASE WHEN $2 = 'verified' THEN mobile_alert_dispatched ELSE FALSE END,
             updated_at = NOW()
         WHERE id = $1`,
        [req.params.id, frontendStatusToDb(newStatus), decision.toUpperCase(), notes, admin.id, officerName]
      );

      await client.query(
        `INSERT INTO event_verifications (event_id, decision, admin_id, comments, previous_status)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, decision, admin.id, notes, current.rows[0].status]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json(await loadDisasterData());
  } catch (error) {
    next(error);
  }
});

app.patch('/api/events/:id', async (req, res, next) => {
  try {
    const admin = await getRequestAdmin(req);
    if (!admin) {
      return res.status(401).json({ message: 'Admin session is invalid or expired.' });
    }

    const updates = req.body?.updates && typeof req.body.updates === 'object' ? req.body.updates : {};
    const currentResult = await pool.query('SELECT frontend_metadata FROM events WHERE id = $1', [req.params.id]);
    if (currentResult.rowCount === 0) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    const metadata = parseJson(currentResult.rows[0].frontend_metadata);
    const nextMetadata = {
      ...metadata,
      ...(updates.category ? { category: normalizeCategory(updates.category) } : {}),
      ...(updates.severity && VALID_SEVERITIES.has(String(updates.severity)) ? { severity: updates.severity } : {}),
      ...(updates.affectedRadiusKm !== undefined
        ? { affectedRadiusKm: numericValue(updates.affectedRadiusKm, metadata.affectedRadiusKm || 5) }
        : {}),
      ...(updates.location && typeof updates.location === 'object'
        ? { location: { ...parseJson(metadata.location), ...updates.location } }
        : {}),
      ...(Array.isArray(updates.keyHighlights) ? { keyHighlights: asStringArray(updates.keyHighlights) } : {}),
      ...(Array.isArray(updates.officialSafetyGuidance)
        ? { officialSafetyGuidance: asStringArray(updates.officialSafetyGuidance) }
        : {}),
      ...(Array.isArray(updates.emergencyContacts) ? { emergencyContacts: asContactArray(updates.emergencyContacts) } : {}),
      ...(Array.isArray(updates.mediaUrls) ? { mediaUrls: asStringArray(updates.mediaUrls) } : {}),
    };

    await pool.query(
      `UPDATE events
       SET title = COALESCE(NULLIF($2, ''), title),
           description = COALESCE(NULLIF($3, ''), description),
           event_type = COALESCE(NULLIF($4, ''), event_type),
           frontend_metadata = $5::jsonb,
           updated_at = NOW()
       WHERE id = $1`,
      [
        req.params.id,
        typeof updates.title === 'string' ? updates.title.trim() : '',
        typeof updates.summary === 'string' ? updates.summary.trim() : '',
        updates.category ? normalizeCategory(updates.category) : '',
        jsonb(nextMetadata),
      ]
    );

    res.json(await loadDisasterData());
  } catch (error) {
    next(error);
  }
});

app.post('/api/events/:id/mobile-alert', async (req, res, next) => {
  try {
    const admin = await getRequestAdmin(req);
    if (!admin) {
      return res.status(401).json({ message: 'Admin session is invalid or expired.' });
    }

    const result = await pool.query(
      `UPDATE events
       SET mobile_alert_dispatched = TRUE,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Event not found.' });
    }

    res.json(await loadDisasterData());
  } catch (error) {
    next(error);
  }
});

app.post('/api/citizen-reports', async (req, res, next) => {
  const submission = req.body?.submission || {};
  const title = typeof submission.title === 'string' ? submission.title.trim() : '';
  const description = typeof submission.description === 'string' ? submission.description.trim() : '';
  const locationName = typeof submission.locationName === 'string' ? submission.locationName.trim() : '';
  const district = typeof submission.district === 'string' ? submission.district.trim() : locationName;
  const state = typeof submission.state === 'string' ? submission.state.trim() : 'India';
  const category = normalizeCategory(submission.category);
  const severity = VALID_SEVERITIES.has(String(submission.severity)) ? String(submission.severity) : 'Moderate';

  if (!title || !description || !locationName) {
    return res.status(400).json({ message: 'Title, description, and location are required.' });
  }

  const latitude = numericOrNull(submission.latitude);
  const longitude = numericOrNull(submission.longitude);
  if (!isInsideIndia(latitude, longitude)) {
    return res.status(400).json({ message: 'Citizen reports require latitude/longitude inside India.' });
  }

  const kafkaPayload = buildCitizenReportKafkaPayload({
    submission,
    title,
    description,
    locationName,
    district,
    state,
    category,
    severity,
    latitude,
    longitude,
  });

  if (await publishCitizenReportToKafka(kafkaPayload)) {
    return res.status(202).json({
      ...(await loadDisasterData()),
      reportRouting: {
        mode: 'kafka_listener',
        topic: citizenReportsKafkaTopic,
        messageId: kafkaPayload.message_id,
      },
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const metadata = {
      category,
      severity,
      affectedRadiusKm: severity === 'Critical' ? 10 : 5,
      location: {
        name: locationName,
        district,
        state,
        lat: latitude,
        lng: longitude,
        confidence: 84,
      },
      mediaUrls: submission.imageFile ? [String(submission.imageFile)] : [],
      keyHighlights: [],
      officialSafetyGuidance: [],
      emergencyContacts: [],
    };

    const matchResult = await client.query(
      `SELECT id, source_count, threshold_count
       FROM events
       WHERE event_type = $1
         AND (
           lower(frontend_metadata->'location'->>'state') = lower($2)
           OR lower(frontend_metadata->'location'->>'district') = lower($3)
           OR lower(location_name) LIKE lower($4)
         )
       ORDER BY updated_at DESC
       LIMIT 1
       FOR UPDATE`,
      [category, state, district, `%${district || locationName}%`]
    );

    let eventId: string;
    let sourceCount = 1;
    const threshold = DEFAULT_THRESHOLD;

    if (matchResult.rowCount && matchResult.rows[0]) {
      eventId = String(matchResult.rows[0].id);
      sourceCount = numericValue(matchResult.rows[0].source_count, 0) + 1;
      await client.query(
        `UPDATE events
         SET source_count = $2,
             threshold_count = COALESCE(NULLIF(threshold_count, 0), $3),
             status = CASE WHEN status IN ('verified', 'fake', 'misleading')
                           THEN status
                           ELSE 'admin_review'
                      END,
             verification_status = CASE WHEN status IN ('verified', 'fake', 'misleading')
                                        THEN verification_status
                                        ELSE 'CITIZEN_REVIEW'
                                   END,
             admin_notes = COALESCE(admin_notes, 'Citizen report requires officer verification.'),
             updated_at = NOW()
         WHERE id = $1`,
        [eventId, sourceCount, threshold]
      );
    } else {
      const inserted = await client.query(
        `INSERT INTO events (
           event_type, title, description, latitude, longitude, location_name, event_time,
           status, verification_status, credibility_score, sentiment_score, ml_score,
           source_count, threshold_count, admin_notes, frontend_metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'admin_review', 'CITIZEN_REVIEW', $7, $8, $9, 1, $10, $11, $12::jsonb)
         RETURNING id`,
        [
          category,
          title,
          description,
          metadata.location.lat,
          metadata.location.lng,
          `${locationName}, ${district}, ${state}`,
          0.88,
          submission.immediateRescueNeeded ? 0.95 : 0.72,
          0.84,
          threshold,
          'Citizen report stored by frontend fallback and sent for admin verification.',
          jsonb(metadata),
        ]
      );
      eventId = String(inserted.rows[0].id);
    }

    const rawData = {
      payload: kafkaPayload,
      frontendSubmission: submission,
      fallbackRoute: 'frontend_direct_postgres',
    };

    const sourcePost = await client.query(
      `INSERT INTO source_posts (
         event_id, platform, author_name, content, media_url, published_at,
         credibility_score, is_high_trust, raw_data
       )
       VALUES ($1, 'citizen_report', $2, $3, $4, NOW(), 0.88, FALSE, $5::jsonb)
       RETURNING id`,
      [
        eventId,
        submission.reporterName || 'Anonymous Resident',
        description,
        submission.imageFile || null,
        jsonb(rawData),
      ]
    );

    await client.query(
      `INSERT INTO event_sources (event_id, source_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [eventId, sourcePost.rows[0].id]
    );

    await client.query('COMMIT');
    res.json(await loadDisasterData());
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

app.post('/api/source-posts/simulate', async (req, res, next) => {
  try {
    const sourceType = normalizeSource(req.body?.sourceType);
    const keyword = typeof req.body?.keyword === 'string' && req.body.keyword.trim() ? req.body.keyword.trim() : '#Weather';
    const isHighTrust = sourceType === 'national_media';

    const eventResult = await pool.query(
      `SELECT id, title, location_name, source_count, threshold_count
       FROM events
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1`
    );
    const event = eventResult.rows[0];
    const content = event
      ? `Live database stream update for ${event.location_name || event.title}: ${keyword} corroboration received.`
      : `Live database stream update received without a matched event cluster: ${keyword}.`;

    await pool.query(
      `INSERT INTO source_posts (
         event_id, platform, author_name, content, published_at,
         credibility_score, is_high_trust, raw_data
       )
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7::jsonb)`,
      [
        event?.id || null,
        sourceType,
        isHighTrust ? 'High-trust media source' : 'Simulated database stream',
        content,
        isHighTrust ? 0.99 : 0.72,
        isHighTrust,
        jsonb({
          payload: {
            location: event?.location_name || '',
            hashtags: [keyword, '#IndiaWeather'],
            sentimentUrgency: isHighTrust ? 88 : 70,
            credibilityScore: isHighTrust ? 99 : 72,
          },
          simulated: true,
        }),
      ]
    );

    if (event?.id) {
      const newCount = numericValue(event.source_count, 0) + 1;
      await pool.query(
        `UPDATE events
         SET source_count = $2,
             status = CASE WHEN $2 >= COALESCE(NULLIF(threshold_count, 0), $3)
                           AND status IN ('unverified', 'pending')
                           THEN 'assumed'
                           WHEN $4 = TRUE AND status IN ('unverified', 'pending', 'assumed')
                           THEN 'verified'
                           ELSE status
                      END,
             verification_status = CASE WHEN $4 = TRUE THEN 'ORIGINAL' ELSE verification_status END,
             updated_at = NOW()
         WHERE id = $1`,
        [event.id, newCount, DEFAULT_THRESHOLD, isHighTrust]
      );
    }

    res.json(await loadDisasterData());
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/session', async (req, res, next) => {
  try {
    const payload = verifySession(getBearerToken(req));
    if (!payload) {
      return res.status(401).json({ message: 'Admin session is invalid or expired.' });
    }

    const user = await getAdminById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: 'Admin user no longer exists.' });
    }

    return res.json({ user: toAdminResponse(user), expiresAt: new Date(payload.exp * 1000).toISOString() });
  } catch (error) {
    return next(error);
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'API route not found.' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ message: 'Server error while processing the request.' });
});

if (isProduction) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  const vite = await createViteServer({
    root: __dirname,
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

const start = async () => {
  await pool.query('SELECT 1');
  await ensureFrontendDataSchema();
  await ensureDefaultAdmin();

  app.listen(port, '0.0.0.0', () => {
    console.log(`WAVE frontend and admin API running on http://localhost:${port}`);
  });
};

process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

if (!fs.existsSync(path.join(__dirname, 'dist')) && isProduction) {
  console.warn('Production mode requested, but dist/ was not found. Run npm run build first.');
}

start().catch((error) => {
  console.error('Failed to start frontend server:', error);
  process.exit(1);
});
