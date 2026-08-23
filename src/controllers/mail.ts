import { Request, Response } from 'express';
import { z } from 'zod';
import { getTransport } from '../services/smtp';
import { env } from '../config/env';

/**
 * Zod schema for the POST /send request body.
 * Both `html` and `text` are optional individually, but at least one must be
 * present — enforced by the `.refine()` at the bottom.
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
 * POST /send
 * Validates the request body, sends the email via SMTP, and returns
 * the Nodemailer messageId on success.
 */
export async function sendMail(req: Request, res: Response): Promise<void> {
  // 1. Validate request body
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
        // Tag source app for audit/tracing
        'X-Mailer-App': app,
      },
    });

    console.log(`[email-sender] ✉️  Sent | app=${app} to=${to} messageId=${info.messageId}`);

    res.status(200).json({
      success: true,
      messageId: info.messageId,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SMTP error';
    console.error(`[email-sender] ❌ Failed | app=${app} to=${to} error=${message}`);

    res.status(502).json({
      success: false,
      error: 'Failed to deliver email',
      details: message,
    });
  }
}
