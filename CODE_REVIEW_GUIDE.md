# Signature Detailing CRM - Code Review & Feature Guide

## 1. Project Overview & Philosophy
The Signature Detailing CRM is designed around speed, simplicity, and zero-friction lead capture. It bridges your marketing channels (WhatsApp, Instagram, Website) directly into a Kanban-style pipeline.

**Core Philosophy:** 
- **No Complex Settings:** All core text and integration links are hardcoded in a single file (`backend/src/config/studio.config.js`). No massive database tables for simple string changes.
- **Zero-Friction Bot:** The AI bot does not ask annoying questions. It asks for the package, verifies the phone number, and instantly books the lead.
- **Aggressive Deduplication:** The system prevents clutter by merging multiple inquiries from the same person into a single lead card.

---

## 2. Feature Guide

### 📱 Multi-Channel Webhooks (WhatsApp & Instagram)
- **WhatsApp Fast 2-Tap Flow:** When a user messages your WhatsApp Business number, the bot replies with a list of packages. Once a package is tapped, it extracts their phone number from the Meta payload and asks them to confirm it ("Yes, Correct"). It then creates the lead.
- **Instagram DM Flow:** The bot sends an interactive 3x3 Carousel of your detailing packages. When tapped, it asks the user to type their 10-digit number.
- **Instagram Comment Automation:** When someone comments on a Reel or Post, the bot replies publicly (e.g., "Hi @username! Please check your DMs 🚗") and sends a private DM with the service carousel.

### 👥 Customer & Lead Deduplication
- **Robust Phone Matching:** Whether a phone number is saved as `917008457284` or `+917008457284`, the system strips prefixes and matches the core digits to prevent duplicate customer profiles.
- **Robust Phone Matching:** Whether a phone number is saved as `919820112345` or `+91 98201 12345`, the system strips prefixes and matches the core digits to prevent duplicate customer profiles.
- **Pipeline Merging:** If a customer asks about "Ceramic Coating" on Monday, and "PPF" on Tuesday, the CRM will **not** create two cards. It finds their open "New" lead and merges the services and notes together.

### 🛑 Human Takeover & Reset
- The bot monitors the conversation state. If a human agent replies via the Meta Business Suite, the bot marks the chat as `human_takeover` and goes silent to prevent interrupting you.
- If the customer types "reset", "menu", or "hi", the bot wakes back up.

### ⚙️ Centralized Configuration
- All bot messages, website links, Google review links, and business hours live in one place: `backend/src/config/studio.config.js`.

---

## 3. How to Review the Code (Line-by-Line Guide)

When you review the codebase, focus on these primary files. I have stripped out unnecessary abstractions so the logic is easy to trace top-to-bottom.

### Step 1: Configuration
File: `backend/src/config/studio.config.js`
- **What to look for:** This is where you change the bot's final confirmation text, your website URL, and your studio name. Notice how simple it is compared to a database-backed settings page.

### Step 2: The Bot Brain
File: `backend/src/services/bot.service.js`
- **What to look for:** This is the most important file in the project. 
- Look at `processBotMessage(payload)`. This function is the entry point for every WhatsApp/IG message.
- Trace the `bot_step` logic. See how it transitions from `awaiting_service` -> `awaiting_phone_input` -> `completed`.
- Review `completeLeadCapture()`. This is where the bot takes the collected data and hands it off to the CRM.

### Step 3: Webhook Receiver
File: `backend/src/controllers/webhook.controller.js`
- **What to look for:** See how the system securely handles verification challenges from Meta, strips out duplicate/echo events, and triggers `bot.service.js` asynchronously so Meta doesn't timeout.

### Step 4: Deduplication Logic
Files: `backend/src/services/customer.service.js` & `backend/src/services/lead.service.js`
- **What to look for:** 
  - In `customer.service.js`, look at `findOrCreateCustomer`. See the logic where it creates `phoneWithoutPlus` and `phoneWithPlus` to ensure it always finds the right customer.
  - In `lead.service.js`, look at `createLead`. See the `.update()` logic where it searches for an existing `['new', 'contacted']` lead and merges the `service_name` strings instead of inserting a duplicate.

### Step 5: Frontend Dashboard
File: `frontend/src/components/DashboardView.tsx`
- **What to look for:** This is the main UI. Search for `formatExactTime` to see how we format timestamps ("Sep 21, 10:30 AM"). Notice how the Kanban and Table views share the exact same underlying `leads` array.

