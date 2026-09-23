import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
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

app.use('/api', express.json({ limit: '1mb' }));

app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'postgres' });
  } catch (error) {
    next(error);
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
