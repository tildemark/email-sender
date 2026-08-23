import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { isApiKeyValid } from '../services/db';

/**
 * API Key authentication middleware.
 * Verifies against DB dynamic keys, ALLOWED_API_KEYS (.env), and ADMIN_API_KEY.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({
      success: false,
      error: 'Missing X-API-KEY header',
    });
    return;
  }

  if (!isApiKeyValid(apiKey)) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key',
    });
    return;
  }

  next();
}

/**
 * HTTP Basic Authentication middleware for Dashboard UI.
 * Only applied if DASHBOARD_PASSWORD is configured.
 */
export function dashboardAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!env.DASHBOARD_PASSWORD) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Email Sender Dashboard"');
    res.status(401).send('Dashboard authentication required');
    return;
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (username === env.DASHBOARD_USERNAME && password === env.DASHBOARD_PASSWORD) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Email Sender Dashboard"');
  res.status(401).send('Invalid dashboard credentials');
}
