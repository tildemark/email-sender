import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';

export interface EmailRecord {
  id: string;
  timestamp: string;
  app_name: string;
  recipient: string;
  subject: string;
  reply_to?: string | null;
  status: 'sent' | 'failed';
  message_id?: string | null;
  error_details?: string | null;
}

export interface ApiKeyRecord {
  app_name: string;
  api_key: string;
  created_at: string;
}

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'email_sender.db');
export const db: DatabaseType = new Database(dbPath);

// Enable WAL mode for high concurrency & reliability
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    app_name TEXT NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    reply_to TEXT,
    status TEXT NOT NULL,
    message_id TEXT,
    error_details TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_history_timestamp ON history (timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_history_app ON history (app_name);

  CREATE TABLE IF NOT EXISTS api_keys (
    app_name TEXT PRIMARY KEY,
    api_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );
`);

// Seed static keys from .env if table is empty
const existingKeysCount = db.prepare('SELECT COUNT(*) as count FROM api_keys').get() as { count: number };
if (existingKeysCount.count === 0 && env.ALLOWED_API_KEYS.length > 0) {
  const insertKey = db.prepare('INSERT OR IGNORE INTO api_keys (app_name, api_key, created_at) VALUES (?, ?, ?)');
  const now = new Date().toISOString();
  for (const key of env.ALLOWED_API_KEYS) {
    // Generate app name from key or fallback
    const appName = key.includes('_key_') ? key.split('_key_')[0] : `app_${key.substring(0, 6)}`;
    insertKey.run(appName, key, now);
  }
}

// ── Database Operations ──

export function insertHistory(record: EmailRecord): void {
  const stmt = db.prepare(`
    INSERT INTO history (id, timestamp, app_name, recipient, subject, reply_to, status, message_id, error_details)
    VALUES (@id, @timestamp, @app_name, @recipient, @subject, @reply_to, @status, @message_id, @error_details)
  `);
  stmt.run({
    ...record,
    reply_to: record.reply_to || null,
    message_id: record.message_id || null,
    error_details: record.error_details || null,
  });
}

export function getHistory(limit = 100, offset = 0, filterApp?: string, filterStatus?: string): EmailRecord[] {
  let query = 'SELECT * FROM history WHERE 1=1';
  const params: unknown[] = [];

  if (filterApp) {
    query += ' AND app_name = ?';
    params.push(filterApp);
  }

  if (filterStatus) {
    query += ' AND status = ?';
    params.push(filterStatus);
  }

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params) as EmailRecord[];
}

export function getStats(): { total: number; sent: number; failed: number; apps: number } {
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      COUNT(DISTINCT app_name) as apps
    FROM history
  `).get() as { total: number; sent: number | null; failed: number | null; apps: number };

  return {
    total: stats.total || 0,
    sent: stats.sent || 0,
    failed: stats.failed || 0,
    apps: stats.apps || 0,
  };
}

export function getApiKeys(): ApiKeyRecord[] {
  return db.prepare('SELECT app_name, api_key, created_at FROM api_keys ORDER BY created_at DESC').all() as ApiKeyRecord[];
}

export function isApiKeyValid(key: string): boolean {
  // Check master admin key if set
  if (env.ADMIN_API_KEY && key === env.ADMIN_API_KEY) {
    return true;
  }
  // Check static env list
  if (env.ALLOWED_API_KEYS.includes(key)) {
    return true;
  }
  // Check DB keys
  const row = db.prepare('SELECT 1 FROM api_keys WHERE api_key = ?').get(key);
  return Boolean(row);
}

export function addApiKey(appName: string, key: string): void {
  const stmt = db.prepare('INSERT OR REPLACE INTO api_keys (app_name, api_key, created_at) VALUES (?, ?, ?)');
  stmt.run(appName, key, new Date().toISOString());
}

export function removeApiKey(appName: string): boolean {
  const stmt = db.prepare('DELETE FROM api_keys WHERE app_name = ?');
  const result = stmt.run(appName);
  return result.changes > 0;
}
