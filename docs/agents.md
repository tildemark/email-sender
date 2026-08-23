Create a lightweight, enterprise-ready, containerized Node.js (TypeScript / Express) microservice called `email-sender` designed to run on Oracle Cloud Infrastructure (OCI) Always Free tier.

This microservice acts as a centralized HTTP Email Relay API gateway, similar to an `sms-sender` service. It will accept HTTP POST requests from multiple client applications (Solutions Portfolio, TRACE, EquiYield, CCARD Studio, etc.) and deliver emails via OCI Email Delivery (or generic SMTP).

### 🛠️ Key Technical Specifications

- **Language/Framework**: Node.js + TypeScript + Express + `nodemailer`
- **Containerization**: Includes a production-ready `Dockerfile` and `docker-compose.yml`
- **Validation**: `zod` for payload schema validation
- **Security**: API key authentication header (`X-API-KEY`) matched against authorized client application keys in `.env`.

### 📂 Directory Structure

email-sender/
├── src/
│   ├── config/env.ts             # Environment variable validation with Zod
│   ├── middleware/auth.ts        # API Key authentication middleware
│   ├── services/smtp.ts          # Nodemailer transport configured for OCI Email Delivery
│   ├── controllers/mail.ts       # POST /send payload controller
│   └── index.ts                  # Express app server entrypoint
├── templates/                    # Optional simple HTML email templates
├── .env.example
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md

### ⚙️ API Endpoints Required

1. **`GET /health`**
   - Returns `{ status: "ok", timestamp: "...", uptime: 123 }` (For OCI health checks / uptime monitors)

2. **`POST /send`**
   - **Headers**:
     - `Content-Type: application/json`
     - `X-API-KEY: <CLIENT_API_KEY>`
   - **Request Body JSON**:

     ```json
     {
       "app": "solutions-portfolio",
       "to": "derf@sanchez.ph",
       "subject": "New Licensing Inquiry: CCARD Studio",
       "replyTo": "client@example.com",
       "html": "<h3>New Quote Request</h3><p><b>Name:</b> Alfredo</p><p><b>Message:</b> ...</p>",
       "text": "New Quote Request..."
     }
     ```

   - **Response**: `{ "success": true, "messageId": "<...>", "timestamp": "..." }`

### 🔑 Environment Variables (`.env.example`)

```env
PORT=3001
NODE_ENV=production

# OCI Email Delivery / SMTP Configuration
SMTP_HOST=smtp.email.ap-tokyo-1.oci.oraclecloud.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ocid1.user.oc1...
SMTP_PASS=your_oci_smtp_approved_password
DEFAULT_FROM="Sanchez Solutions Notifications <noreply@sanchez.ph>"

# Authorized Client API Keys (Comma-separated or JSON)
ALLOWED_API_KEYS=trace_key_123,equiyield_key_456,solutions_key_789
