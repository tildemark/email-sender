import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * API Key authentication middleware.
 *
 * Reads the `X-API-KEY` header and verifies it against the list of
 * authorized keys defined in ALLOWED_API_KEYS environment variable.
 * Responds with 401 if the header is missing, or 403 if the key is invalid.
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

  if (!env.ALLOWED_API_KEYS.includes(apiKey)) {
    res.status(403).json({
      success: false,
      error: 'Invalid API key',
    });
    return;
  }

  next();
}
