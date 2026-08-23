# 📧 email-sender

A lightweight, enterprise-ready, containerized **Node.js / TypeScript / Express** microservice that acts as a centralized **HTTP Email Relay API gateway** for OCI Email Delivery (or any STARTTLS-compatible SMTP server).

Designed to run on **Oracle Cloud Infrastructure (OCI) Always Free tier**.

---

## ✨ Features

- `POST /send` — Send emails from any authorized client app via a single HTTP call
- `GET /health` — Public health check for OCI load balancers and uptime monitors
- **API Key authentication** via `X-API-KEY` header
- **Zod** schema validation on all inputs (environment + request body)
- **Nodemailer** singleton transport with STARTTLS enforcement
- **Multi-stage Docker** build (Alpine, non-root user)
- Structured JSON logging with source app tagging

---

## 🚀 Quick Start

### 1. Clone & Configure

```bash
git clone <repo-url>
cd email-sender
cp .env.example .env
# Edit .env with your OCI SMTP credentials and API keys
```

### 2. Run with Docker Compose

```bash
docker compose up -d
```

### 3. Test the Health Endpoint

```bash
curl http://localhost:3001/health
# { "status": "ok", "timestamp": "...", "uptime": 12 }
```

### 4. Send a Test Email

```bash
curl -X POST http://localhost:3001/send \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: your_api_key_here" \
  -d '{
    "app": "solutions-portfolio",
    "to": "derf@sanchez.ph",
    "subject": "Test Email",
    "html": "<h1>Hello!</h1><p>This is a test from email-sender.</p>",
    "text": "Hello! This is a test from email-sender."
  }'
```

---

## 🔑 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default: `3001`) | HTTP server port |
| `NODE_ENV` | No (default: `production`) | `development` \| `production` \| `test` |
| `SMTP_HOST` | ✅ | OCI SMTP endpoint (e.g. `smtp.email.ap-tokyo-1.oci.oraclecloud.com`) |
| `SMTP_PORT` | No (default: `587`) | SMTP port |
| `SMTP_SECURE` | No (default: `false`) | `true` for TLS on connect (port 465), `false` for STARTTLS (port 587) |
| `SMTP_USER` | ✅ | OCI SMTP username (OCID format) |
| `SMTP_PASS` | ✅ | OCI SMTP approved password |
| `DEFAULT_FROM` | ✅ | Sender address, e.g. `"Sanchez Solutions <noreply@sanchez.ph>"` |
| `ALLOWED_API_KEYS` | ✅ | Comma-separated list of authorized client API keys |

---

## 📡 API Reference

### `GET /health`

Public. No authentication required.

**Response `200`:**
```json
{
  "status": "ok",
  "timestamp": "2026-08-23T10:00:00.000Z",
  "uptime": 123
}
```

---

### `POST /send`

**Headers:**

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `X-API-KEY` | Your authorized API key |

**Request Body:**

| Field | Type | Required | Description |
|---|---|---|---|
| `app` | `string` | ✅ | Identifier of the source application |
| `to` | `string` | ✅ | Recipient email address |
| `subject` | `string` | ✅ | Email subject line |
| `replyTo` | `string` | No | Reply-To email address |
| `html` | `string` | One of html/text | HTML email body |
| `text` | `string` | One of html/text | Plain-text fallback body |

**Response `200`:**
```json
{
  "success": true,
  "messageId": "<abc123@smtp.email.oci.com>",
  "timestamp": "2026-08-23T10:00:00.000Z"
}
```

**Error Responses:**

| Status | Meaning |
|---|---|
| `400` | Invalid/missing request body fields |
| `401` | Missing `X-API-KEY` header |
| `403` | Invalid API key |
| `502` | SMTP delivery failure |

---

## 🐳 OCI Deployment Guide

### Prerequisites

- OCI Compute instance (Always Free, ARM or x86)
- OCI Email Delivery enabled with an approved sender and SMTP credentials
- Docker + Docker Compose installed on the instance

### Steps

1. **Copy files to the instance:**
   ```bash
   scp -r . opc@<instance-ip>:~/email-sender/
   ```

2. **SSH in and configure:**
   ```bash
   ssh opc@<instance-ip>
   cd ~/email-sender
   cp .env.example .env
   nano .env  # Fill in SMTP credentials and API keys
   ```

3. **Start the service:**
   ```bash
   docker compose up -d --build
   ```

4. **Configure OCI Security List** to allow inbound TCP on port `3001` (or put behind an OCI Load Balancer / Nginx reverse proxy on port 443).

---

## 🛡️ Email Deliverability & Anti-Spam (Gmail Best Practices)

To prevent Gmail, Google Workspace, and other inbox providers from marking emails as spam or outright rejecting them, adhere to the following DNS authentication protocols and content guidelines:

### 1. Mandatory DNS Authentication (SPF, DKIM, DMARC) on Cloudflare

Gmail enforces strict authentication policies for inbound emails. In your **Cloudflare Dashboard > DNS > Records**, configure the following records for your sending domain (e.g., `sanchez.ph`):

> [!IMPORTANT]
> **Cloudflare Proxy Warning (DNS-Only / Grey Cloud)**:
> All email-related DNS records (**TXT**, **MX**, and DKIM **CNAME** records) must have Proxy status set to **DNS only** (Grey Cloud ⚪), never Proxied (Orange Cloud 🟠).

#### A. SPF (Sender Policy Framework)
Authorizes OCI Email Delivery to send emails on behalf of your domain.
- **Type**: `TXT`
- **Name / Host**: `@` (or root domain)
- **Content**:
  ```text
  v=spf1 include:email.mail.<oci-region>.oraclecloud.com ~all
  ```
  *(Replace `<oci-region>` with your OCI region identifier, e.g. `ap-tokyo-1`)*
- **TTL**: Auto

> [!NOTE]
> If you already have an existing SPF TXT record (e.g. for Google Workspace or Microsoft 365), do **not** add a second SPF record. Instead, combine them into one:
> `v=spf1 include:_spf.google.com include:email.mail.ap-tokyo-1.oci.oraclecloud.com ~all`

#### B. DKIM (DomainKeys Identified Mail)
Cryptographically signs outbound emails to verify sender authenticity and integrity.
1. In the **OCI Console**, navigate to **Developer Services > Email Delivery > Email Domains**.
2. Select your email domain and click **Add DKIM Key**.
3. OCI will provide a **DNS CNAME record** (e.g. `selector1._domainkey` pointing to `selector1.<domain>.dkim.<region>.oraclecloud.com`).
4. In **Cloudflare DNS**:
   - **Type**: `CNAME`
   - **Name**: The selector prefix provided by OCI (e.g. `oci._domainkey` or `s1._domainkey`)
   - **Target**: The OCI DKIM hostname value
   - **Proxy status**: **DNS only** (Grey Cloud ⚪ — mandatory!)
5. Back in the OCI Console, wait 1-2 minutes and verify that the DKIM status shows **Active**.

#### C. DMARC (Domain-based Message Authentication)
Tells recipient servers (like Gmail) what to do if SPF or DKIM fails.
- **Type**: `TXT`
- **Name**: `_dmarc`
- **Content**:
  ```text
  v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com; pct=100;
  ```
  *(Start with `p=none` for monitoring if you prefer, then step up to `p=quarantine` or `p=reject`)*
- **TTL**: Auto

#### D. MX Records (Optional / If Receiving or using Catch-All)
If using Cloudflare Email Routing or external mailboxes, keep your MX records active and set to **DNS only**.

---

### 2. OCI Approved Sender & Envelope Alignment
- Ensure your `DEFAULT_FROM` address (or the `from` field) matches an **Approved Sender** configured in OCI Email Delivery.
- Keep the domain of the `From:` header aligned with the domain authenticated by SPF and DKIM.

---

### 3. Content & Header Best Practices

- **Provide Both HTML and Plain-Text**: Always include both `html` and `text` parts in request payloads (the microservice supports both). Missing plain-text alternatives is a common spam trigger.
- **Avoid Spam Trigger Keywords**: Avoid aggressive marketing language (e.g., `$$$`, `URGENT ACTION REQUIRED`, `100% FREE`, excessive exclamation marks) in subjects and content.
- **Valid `Reply-To` and `From` Headers**: Ensure addresses in headers are legitimate, active mailboxes capable of receiving responses.
- **Proper HTML Formatting**: Keep HTML clean, properly closed, and avoid embedding suspicious scripts, hidden text, or URL shorteners (e.g., bit.ly).
- **Include Sender Address/Identity**: In transactional emails, clearly state who sent the email and include physical or contact business details where applicable.
- **Unsubscribe Link (For Bulk/Marketing)**: If sending notifications to lists, include an unsubscribe mechanism and `List-Unsubscribe` headers.

---

## 🔧 Local Development

```bash
npm install
cp .env.example .env
# Fill in SMTP credentials
npm run dev
```

TypeScript type-check:
```bash
npm run typecheck
```

---

## 📂 Project Structure

```
email-sender/
├── src/
│   ├── config/env.ts          # Zod environment variable validation
│   ├── middleware/auth.ts     # X-API-KEY authentication middleware
│   ├── services/smtp.ts       # Singleton Nodemailer SMTP transport
│   ├── controllers/mail.ts    # POST /send request handler
│   └── index.ts               # Express app entrypoint
├── templates/                 # Optional HTML email templates
├── docs/
│   └── agents.md              # AI agent specification
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```
