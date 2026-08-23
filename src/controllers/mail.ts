import { Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { getTransport } from '../services/smtp';
import { env } from '../config/env';
import { insertHistory } from '../services/db';

/**
 * Zod schema for the POST /send (and POST /api/send) request body.
 */
const sendSchema = z
  .object({
    app: z.string().min(1, '`app` identifier is required'),
    to: z.string().email('`to` must be a valid email address'),
    subject: z.string().min(1, '`subject` is required'),
    replyTo: z.string().email('`replyTo` must be a valid email address').optional(),
    html: z.string().optional(),
    text: z.string().optional(),
  })
  .refine((data) => data.html || data.text, {
    message: 'At least one of `html` or `text` must be provided',
    path: ['html', 'text'],
  });

export type SendPayload = z.infer<typeof sendSchema>;

/**
 * POST /send and POST /api/send
 * Validates payload, sends via Nodemailer, records dispatch history into SQLite,
 * and returns status response.
 */
export async function sendMail(req: Request, res: Response): Promise<void> {
  const result = sendSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid request payload',
      details: result.error.flatten().fieldErrors,
    });
    return;
  }

  const { app, to, subject, replyTo, html, text } = result.data;
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  try {
    const transport = getTransport();

    const info = await transport.sendMail({
      from: env.DEFAULT_FROM,
      to,
      subject,
      ...(replyTo && { replyTo }),
      ...(html && { html }),
      ...(text && { text }),
      headers: {
        'X-Mailer-App': app,
      },
    });

    console.log(`[email-sender] ✉️  Sent | app=${app} to=${to} messageId=${info.messageId}`);

    // Record successful dispatch in DB
    insertHistory({
      id,
      timestamp,
      app_name: app,
      recipient: to,
      subject,
      reply_to: replyTo,
      status: 'sent',
      message_id: info.messageId,
    });

    res.status(200).json({
      success: true,
      id,
      messageId: info.messageId,
      timestamp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SMTP error';
    console.error(`[email-sender] ❌ Failed | app=${app} to=${to} error=${message}`);

    // Record failure in DB
    insertHistory({
      id,
      timestamp,
      app_name: app,
      recipient: to,
      subject,
      reply_to: replyTo,
      status: 'failed',
      error_details: message,
    });

    res.status(502).json({
      success: false,
      id,
      error: 'Failed to deliver email',
      details: message,
    });
  }
}
