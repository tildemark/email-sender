import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

let transport: Transporter | null = null;

/**
 * Returns a singleton Nodemailer transporter configured for
 * OCI Email Delivery (or any STARTTLS-capable SMTP server).
 */
export function getTransport(): Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE, // true = TLS on connect (port 465), false = STARTTLS (port 587)
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      // OCI Email Delivery requires STARTTLS — enforce it
      requireTLS: !env.SMTP_SECURE,
    });
  }
  return transport;
}

/**
 * Verifies the SMTP connection. Useful at startup to catch mis-configuration
 * early rather than at first send.
 */
export async function verifyTransport(): Promise<void> {
  const t = getTransport();
  await t.verify();
}
