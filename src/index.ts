import express, { Request, Response, NextFunction } from 'express';
import { env } from './config/env';
import { authMiddleware } from './middleware/auth';
import { sendMail } from './controllers/mail';
import { verifyTransport } from './services/smtp';

const app = express();

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(express.json());
app.disable('x-powered-by');

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /health
 * Public endpoint for OCI load balancer / uptime monitors.
 */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

/**
 * POST /send
 * Protected by API key authentication.
 */
app.post('/send', authMiddleware, sendMail);

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
  // Verify SMTP connectivity before accepting traffic
  if (env.NODE_ENV === 'production') {
    try {
      console.log('[email-sender] 🔌 Verifying SMTP connection...');
      await verifyTransport();
      console.log('[email-sender] ✅ SMTP connection verified');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[email-sender] ❌ SMTP verification failed: ${message}`);
      process.exit(1);
    }
  }

  app.listen(env.PORT, () => {
    console.log(`[email-sender] 🚀 Running on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

start();
