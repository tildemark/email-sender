import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { env } from './config/env';
import { authMiddleware, dashboardAuthMiddleware } from './middleware/auth';
import { sendMail } from './controllers/mail';
import { verifyTransport } from './services/smtp';
import {
  getStatsHandler,
  getHistoryHandler,
  getStatusHandler,
  getKeysHandler,
  createKeyHandler,
  deleteKeyHandler,
} from './controllers/api';

const app = express();

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.disable('x-powered-by');

// ─── Static UI Dashboard ──────────────────────────────────────────────────────
const staticDir = path.resolve(process.cwd(), 'static');
// Protect dashboard UI with optional basic auth
app.use(dashboardAuthMiddleware);
app.use(express.static(staticDir));

// ─── Public Endpoints ─────────────────────────────────────────────────────────

/**
 * GET /health
 * Public health check for OCI load balancers & uptime monitors
 */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

/**
 * GET /api/status
 * Live diagnostic check including SMTP connection
 */
app.get('/api/status', getStatusHandler);

// ─── Dashboard Data APIs ──────────────────────────────────────────────────────
app.get('/api/stats', getStatsHandler);
app.get('/api/history', getHistoryHandler);
app.get('/api/keys', getKeysHandler);
app.post('/api/keys', createKeyHandler);
app.delete('/api/keys/:app', deleteKeyHandler);

// ─── Email Relay Endpoint ─────────────────────────────────────────────────────
/**
 * POST /send and POST /api/send
 * Authenticated via X-API-KEY header
 */
app.post('/send', authMiddleware, sendMail);
app.post('/api/send', authMiddleware, sendMail);

// ─── SPA Route Fallback ───────────────────────────────────────────────────────
app.get(['/', '/history', '/settings', '/integration'], (_req: Request, res: Response) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[email-sender] Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  // Test SMTP connectivity in production (warn instead of hard crash so container can still boot UI to diagnose)
  try {
    console.log('[email-sender] 🔌 Verifying SMTP connection...');
    await verifyTransport();
    console.log('[email-sender] ✅ SMTP connection verified');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[email-sender] ⚠️ SMTP initial check warning: ${message}`);
  }

  app.listen(env.PORT, () => {
    console.log(`[email-sender] 🚀 Server running at http://localhost:${env.PORT} (${env.NODE_ENV})`);
    console.log(`[email-sender] 📊 Dashboard available at http://localhost:${env.PORT}`);
  });
}

start();
