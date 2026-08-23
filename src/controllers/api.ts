import { Request, Response } from 'express';
import crypto from 'crypto';
import { getHistory, getStats, getApiKeys, addApiKey, removeApiKey } from '../services/db';
import { verifyTransport } from '../services/smtp';
import { env } from '../config/env';

/**
 * GET /api/stats
 * Overview numbers for UI dashboard cards
 */
export function getStatsHandler(_req: Request, res: Response): void {
  const stats = getStats();
  res.json({
    success: true,
    data: {
      ...stats,
      uptime: Math.floor(process.uptime()),
      nodeEnv: env.NODE_ENV,
      defaultFrom: env.DEFAULT_FROM,
      smtpHost: env.SMTP_HOST,
      smtpPort: env.SMTP_PORT,
    },
  });
}

/**
 * GET /api/history
 * List email audit logs with pagination and optional filtering
 */
export function getHistoryHandler(req: Request, res: Response): void {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
  const offset = parseInt(req.query.offset as string, 10) || 0;
  const app = (req.query.app as string) || undefined;
  const status = (req.query.status as string) || undefined;

  const records = getHistory(limit, offset, app, status);
  res.json({
    success: true,
    data: records,
    limit,
    offset,
  });
}

/**
 * GET /api/status
 * Test SMTP connection and return live diagnostics
 */
export async function getStatusHandler(_req: Request, res: Response): Promise<void> {
  let smtpHealthy = false;
  let smtpError: string | null = null;

  try {
    await verifyTransport();
    smtpHealthy = true;
  } catch (err) {
    smtpError = err instanceof Error ? err.message : String(err);
  }

  res.json({
    status: smtpHealthy ? 'ok' : 'degraded',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      connected: smtpHealthy,
      error: smtpError,
    },
  });
}

/**
 * GET /api/keys
 * List active client API keys
 */
export function getKeysHandler(_req: Request, res: Response): void {
  const keys = getApiKeys();
  res.json({
    success: true,
    data: keys,
  });
}

/**
 * POST /api/keys
 * Generate or register an API key for a client application
 */
export function createKeyHandler(req: Request, res: Response): void {
  const { appName, apiKey } = req.body;

  if (!appName || typeof appName !== 'string') {
    res.status(400).json({ success: false, error: 'appName is required' });
    return;
  }

  const generatedKey = apiKey && typeof apiKey === 'string'
    ? apiKey.trim()
    : `${appName.toLowerCase().replace(/[^a-z0-9_-]/g, '')}_key_${crypto.randomBytes(12).toString('hex')}`;

  addApiKey(appName.trim(), generatedKey);

  res.status(201).json({
    success: true,
    data: {
      appName: appName.trim(),
      apiKey: generatedKey,
      created_at: new Date().toISOString(),
    },
  });
}

/**
 * DELETE /api/keys/:app
 * Revoke an API key
 */
export function deleteKeyHandler(req: Request, res: Response): void {
  const appName = req.params.app;
  if (!appName) {
    res.status(400).json({ success: false, error: 'appName parameter is required' });
    return;
  }

  const removed = removeApiKey(appName);
  if (!removed) {
    res.status(404).json({ success: false, error: 'API key not found' });
    return;
  }

  res.json({ success: true, message: `API key for '${appName}' revoked` });
}
