# 🚗✨ Signature Detailing — CRM & Lead Automation Platform

A bespoke, mobile-first CRM and omni-channel automation platform engineered exclusively for **Signature Detailing** (car detailing studio in India).

- **Live Production URL**: [https://signaturedetailing-five.vercel.app](https://signaturedetailing-five.vercel.app)
- **API Health Endpoint**: [https://signaturedetailing-five.vercel.app/api/health](https://signaturedetailing-five.vercel.app/api/health)

---

## 🔐 Studio Access & Security

The CRM terminal is protected by a studio passcode gate to keep customer dossiers, phone numbers, and leads secure:
- **Required Configuration**: Set a unique `STUDIO_PASSCODE` in `.env` / Vercel Environment Variables. There is no default passcode.
- **Lock Terminal**: Click **"Lock Terminal"** in the sidebar (or top bar on mobile) to immediately lock the terminal when stepping away.

---

## ⚡ Quick Start

### 1. Installation
Install dependencies in both `backend/` and `frontend/`:
```bash
# In backend
cd backend && npm install

# In frontend
cd frontend && npm install
```

### 2. Run Automated Verification Suite
Verify all **48 system checks** (Static Serving, Health, Anti-Pausing Heartbeat, Studio Services, Lead Creation & KPIs, Phone Validation, 3-Step Bot Funnel, Webhook Handshakes):
```bash
npm test
# Or run directly:
node backend/tests/system_verification.mjs
```

### 3. Build & Run Standalone Server (Port 5000)
```bash
# Build frontend SPA
npm run build

# Start unified Node.js monolith server
npm start
```
Visit **`http://localhost:5000`** in your browser or mobile phone on the same Wi-Fi network.

### 4. Run in Development Mode (Vite Hot-Reload)
```bash
# Terminal 1: Backend API
node backend/src/server.js

# Terminal 2: Frontend Vite dev server (proxies /api to 5000)
cd frontend && npm run dev
```

---

## 🎯 Architecture & System Design
- **Single-Tenant Business Monolith**: Designed specifically for Signature Detailing without multi-tenant SaaS bloat, Redis, Docker, or Kubernetes overhead.
- **Standalone Node.js Server**: Runs on any VPS, Droplet, or bare-metal host (`node backend/src/server.js`).
  - **Vercel Serverless Ready**: Production deployed to Vercel with zero re-architecture via `api/index.js` and root `vercel.json`.
- **Database & State Management**: PostgreSQL hosted on Supabase with automatic graceful simulation fallback for local offline prototyping.
- **Meta Cloud API Idempotency**: PostgreSQL `meta_message_id UNIQUE` constraint guarantees zero duplicate messages during network retries or serverless cold starts.

---

## 🚀 Supabase Scalability & Keep-Alive Architecture

### 1. 24/7 Keep-Alive & Anti-Pausing System
Supabase free tier automatically pauses projects after 7 days of inactivity. This platform implements dual anti-pausing measures:
- **GitHub Actions Scheduled Ping** ([`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml)): Runs every 30 minutes (`*/30 * * * *`) querying `/api/health`.
- **UptimeRobot HTTP Monitor Integration**: A 5-minute health check ping directly to `https://signaturedetailing-five.vercel.app/api/health`.
  - **Free Tier Quota Impact**:
    - Supabase REST requests: **1.7%** (8,640 of 500,000 monthly limit)
    - Vercel function requests: **8.6%** (8,640 of 100,000 monthly limit)
    - Bandwidth: ~430 KB/month (<0.02% of 2 GB limit)
  - 1-click configuration card provided inside **Settings ➔ APIs, Webhooks & Setup Guides ➔ ⚡ Supabase 24/7 Keep-Alive**.

### 2. High-Volume Message Scalability (Option A + Option B)
To prevent relational table bloat from high-frequency WhatsApp and Instagram chats:
- **Option A — 30-Day Message Retention Policy & Auto-Pruning**:
  - Database function `prune_old_messages(days_to_keep INT DEFAULT 30)` prunes chat message rows older than 30 days.
  - REST endpoint `POST /api/settings/database/prune` triggers automated or on-demand pruning.
  - Customer profiles, leads, vehicle registries, job cards, services catalog, and analytics are **permanently retained**.
- **Option B — NoSQL Document-Style `recent_messages JSONB` Array**:
  - The `conversations` table stores a rolling buffer (`recent_messages JSONB`) containing the last 50 chat messages.
  - Enables single-query chat rendering with zero relational JOIN overhead.
  - Automatically acts as fallback for message history after older rows are cleaned by Option A.

---

## 🛡️ Business Rules & Workflows

1. **Button-Driven 3-Question Funnel**:
   - **Question 1 (Service)**: Client chooses from active studio packages (PPF, Ceramic Coating, etc.) via interactive list/buttons.
   - **Question 2 (Name)**: Client enters their full name.
   - **Question 3 (Phone Number)**:
     - On WhatsApp: Displays verified WhatsApp number with 1-tap confirmation (`✅ Yes, Correct` or `✏️ Alternate Number`).
     - On Instagram: Prompts for 10-digit mobile number with strict validation.
     - **Validation Engine**: Strict Indian mobile validation (+91 format, rejects dummy sequences like `9999999999` and `1234567890`).
   - **Zero Price Quotes**: The bot **never** quotes detailing prices. All pricing is customized by studio specialists during the follow-up consultation call.
2. **Staff Mobile Coexistence (`smb_message_echoes`)**:
   - When studio staff replies directly to a client from their personal WhatsApp mobile app, the CRM detects the outgoing echo, automatically silences the bot (`bot_active = false`), and marks the conversation as `human_takeover`.
3. **Manual Vehicle Entry & Inspection Notes**:
   - Staff logs vehicle specs (make, model, color, registration number, paint condition, inspection notes) directly into the CRM client dossier using the mobile bottom sheet.
4. **Studio Control Center**:
   - **Services Catalog**: Dedicated tab for studio owners to add, edit, or toggle packages and taglines without code changes.
   - **Integrations Vault**: Secure area for Meta WhatsApp & Instagram API tokens, Phone Number IDs, and Webhook verification secrets.
   - **Setup Guides**: Step-by-step visual documentation explaining how to generate Meta access tokens, configure Webhook callbacks, and embed the quote form on the studio website.

---

## 🗄️ Database Setup (Supabase)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Paste and run the entire contents of **[`supabase/schema.sql`](supabase/schema.sql)**.
4. Copy your **Project URL** and **Service Role Secret (API Key)** into `backend/.env`:
```env
PORT=5000
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

---

## 📱 Meta Cloud API Webhook Endpoints

Configure these in Meta Developer Portal (**WhatsApp** > **Configuration** / **Instagram** > **Webhooks**):
- **WhatsApp Callback URL**: `https://signaturedetailing-five.vercel.app/api/webhooks/whatsapp`
- **WhatsApp Verify Token**: Set a unique token in Integrations settings and use the same value in Meta.
- **Instagram Callback URL**: `https://signaturedetailing-five.vercel.app/api/webhooks/instagram`
- **Instagram Verify Token**: Set a unique token in Integrations settings and use the same value in Meta.

---

## 🧪 Testing

Run the full end-to-end verification suite:
```bash
npm test
# Or run directly:
node backend/tests/system_verification.mjs
```
**Results: 59 PASSED, 0 FAILED**
- ✅ Frontend SPA static serving & routing
- ✅ API health check & active Supabase anti-pausing heartbeat
- ✅ Studio Services catalog API with active packages
- ✅ Lead creation & pipeline KPI metrics tracking
- ✅ Phone validation engine & 3-by-3 Instagram Carousel generator
- ✅ WhatsApp & Instagram multi-step bot qualification flows
- ✅ Instagram comment auto-reply (public comment + private DM) & anti-loop guards
- ✅ Pipeline lead & customer data deduplication
- ✅ WhatsApp & Instagram Webhook GET handshake verification
- ✅ Studio Owner lead notification dispatch system
- ✅ Bot transparency disclaimer & owner escalation contact

---

## 📋 Client Handover & Domain Setup

To transfer this project to your client:
1. **GitHub Transfer**: Push this codebase to the client's GitHub repository.
2. **Supabase Project**: Create a new Supabase project in the client's account, run `supabase/schema.sql` in the SQL Editor, and copy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
3. **Vercel Project**: Import the repository into the client's Vercel account, set the environment variables from `.env`, and link their custom domain (e.g. `crm.signaturedetailing.in`) under **Project Settings ➔ Domains**.
4. **Studio Configuration**: Modify `backend/src/config/studio.config.js` to customize the owner's phone number, studio name, addresses, and review URLs.
