# LeadScout v1.3

> High-accuracy LinkedIn prospect enrichment, Apollo.io integration, and direct SMTP deliverability verification engine.

**LeadScout** is a Chrome extension (Manifest V3) and companion verification microservice designed for outbound sales, recruiting, and B2B contact discovery. It combines clean on-page DOM parsing, statistical email pattern generation, DNS-over-HTTPS MX inspection, live Apollo.io enrichment with balance tracking, and an independent Port 25 SMTP handshake engine to verify corporate email addresses.

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Key Features](#key-features)
3. [Installation & Setup](#installation--setup)
4. [How to Use (Workflow)](#how-to-use-workflow)
5. [Enrichment & Verification Engines](#enrichment--verification-engines)
   - [Apollo.io Integration](#apolloio-integration)
   - [Private SMTP Engine ($0 / Unlimited)](#private-smtp-engine-0--unlimited)
   - [Prospeo.io & Hunter.io Fallbacks](#prospeoio--hunterio-fallbacks)
6. [Settings & Configuration Guide](#settings--configuration-guide)
7. [Troubleshooting & FAQs](#troubleshooting--faqs)
8. [File Structure](#file-structure)
9. [Sharing the Extension with Teammates](#sharing-the-extension-with-teammates)
10. [License](#license)

---

## Architecture Overview

```
                      [ Active LinkedIn Profile ]
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │  LeadScout Side Panel UI  │
                    └─────────────┬─────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
   [ LinkedIn Scraper ]  [ Domain Resolver ]   [ MX / DNS Probe ]
   • Cleans emojis       • Multi-TLD checks    • Google / Cloudflare
   • Filters audio text  • Active MX filter      DNS-over-HTTPS
   • Extracts headline   • Rejects dead domains
            │                     │                     │
            └─────────────────────┼─────────────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │   Enrichment Pipeline     │
                    └─────────────┬─────────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            ▼                     ▼                     ▼
     Priority 1: Apollo    Priority 2: Private   Priority 3: Fallback
     • Direct Match        • Permutation Gen     • Prospeo.io
     • Live Credit Sync    • Port 25 Handshake   • Hunter.io
     • Pure URL Retry      • Catch-All Probe
```

---

## Key Features

- **DOM Extraction**: Automatically parses clean names, headlines, companies, locations, and profile avatars from LinkedIn. Filters out emojis (e.g. `🟣`), badges, and accessibility audio player text (`Seek to live, currently behind live`).
- **Live Apollo.io Integration**:
  - Direct verified email discovery and direct mobile dials.
  - Live Apollo credit display in the header pill (`⚡ 20,176`) and Settings with instant auto-refresh.
  - Automatic fallback retry with pure `linkedin_url` to prevent false negatives caused by unverified guessed domains.
- **Private SMTP Engine ($0 Cost / Unlimited)**:
  - Generates statistical corporate email permutations (`first.last`, `first`, `flast`, `firstl`, `first_last`).
  - Executes real-time `RCPT TO` socket handshakes (250 OK) against mail exchangers.
  - Detects catch-all domains using canary probe addresses.
  - Built-in filter for 1,000+ disposable / burner domains.
  - Pre-configured with Render cloud deployment (`https://leadscout-extension.onrender.com`).
- **Tactile Enterprise UI**:
  - Chrome Side Panel integration (stays open alongside your LinkedIn tabs).
  - Modern Linear / Apollo-inspired styling.
  - Dynamic button animations: interactive scale on press, loading spinners, and vivid success confirmations (`✓ Saved Successfully!`).
- **Data Privacy & Export**:
  - All leads and API keys are stored locally in your browser (`chrome.storage.local`).
  - Zero external tracking or telemetry.
  - 1-click **Export to CSV** for CRM import (HubSpot, Salesforce, Apollo, outreach tools).

---

## Installation & Setup

### 1. Load into Google Chrome

1. Clone or download this repository:
   ```bash
   git clone https://github.com/furqan-debug/LeadScout-Extension.git
   ```
2. Open Google Chrome and go to `chrome://extensions/`.
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `Email Extractor Extension` root folder (where `manifest.json` is located).
6. Click the extension puzzle icon in Chrome and **Pin LeadScout** to your toolbar.

### 2. (Optional) Run Local SMTP Server

If you prefer self-hosting the Port 25 verification engine on your own machine instead of using the Render cloud instance:
```bash
cd server
npm install
npm start
```
The server binds to `http://localhost:3000`.

---

## How to Use (Workflow)

1. Open LinkedIn and visit any prospect's profile (`linkedin.com/in/...`).
2. Click the **LeadScout icon** in your Chrome toolbar to open the Side Panel.
3. Click **Scan Active Profile** (or **Re-Scan Profile**):
   - LeadScout scrapes the profile name, headline, location, and company.
   - It verifies whether the company has active mail servers (`Google Workspace · MX Active` or `Microsoft 365 · MX Active`).
   - If an Apollo API key is configured, Apollo queries its database for verified direct email and phone records.
   - If Apollo has no match, the Private SMTP Engine tests pattern permutations directly against the company's mail server.
4. Review the result:
   - **Green Match (`● Apollo Verified` / `● SMTP 250 OK`)**: Ready for outbound email.
   - **Click-to-Copy**: Click the **Copy** button to copy the email.
   - **Click-to-Save**: Click **Save Lead** to store the contact.
5. In the **Saved** tab:
   - View your saved leads list.
   - Click **Export CSV** to download a spreadsheet with Name, Job Title, Company, Email, Verification Status, Phone, and LinkedIn URL.

---

## Enrichment & Verification Engines

### Apollo.io Integration
- **How it works**: Queries `POST https://api.apollo.io/api/v1/people/match` for 100% verified corporate emails and phone numbers.
- **Credit Syncing**: Fetches your live credit balance from `GET /api/v1/users/api_profile` without consuming any credits.
- **Smart URL Retry**: If initial match fails due to guessed domains, LeadScout immediately retries with `linkedin_url` alone, allowing Apollo's database to match profiles directly.
- **Optional Phone Reveal**: A toggle in Settings allows phone numbers to be revealed (uses 8 Apollo credits).

### Private SMTP Engine ($0 / Unlimited)
- **Endpoint**: Default is `https://leadscout-extension.onrender.com`.
- **How it works**: Generates candidate email permutations and connects via TCP socket to the company's MX exchange (`HELO` &rarr; `MAIL FROM` &rarr; `RCPT TO`). If the server returns code `250 OK`, the email is deliverable.
- **Cost**: Completely free and unlimited.

### Prospeo.io & Hunter.io Fallbacks
- **Prospeo**: Official `/enrich-person` endpoint (free plan includes 75 lookups/month).
- **Hunter**: Optional domain search fallback.

---

## Settings & Configuration Guide

Click the **Settings** tab inside the side panel:

| Setting | Purpose | Default |
| :--- | :--- | :--- |
| **Private SMTP Engine Endpoint** | URL of the verification microservice | `https://leadscout-extension.onrender.com` |
| **Use Private Verifier as Primary Engine** | Check to verify email permutations when Apollo has no match | Checked |
| **Check Engine Health** | Pings the verifier endpoint to confirm connectivity and Port 25 status | — |
| **Apollo.io API Key** | Paste your key from [developer.apollo.io](https://developer.apollo.io/#/keys) | — |
| **Reveal Mobile Numbers** | Reveals mobile phones in Apollo (uses 8 credits) | Unchecked |
| **Live Apollo Credits** | Displays your current active Apollo credit balance with refresh button | Auto-synced |
| **Prospeo.io API Key** | Optional fallback if you have a Prospeo account | — |
| **Hunter.io API Key** | Optional pattern resolver fallback | — |

Click **Save Configuration** to store your keys. The button provides instant tactile click feedback and confirms with `✓ Saved Successfully!`.

---

## Troubleshooting & FAQs

### Q: Why does Apollo say "Profile not found in Apollo database"?
Apollo has over 275M B2B records, but does not index every individual (e.g. newly founded local startups, non-profits, or small regional businesses). When Apollo has no record:
- Enable the **Private SMTP Engine** in Settings. LeadScout will automatically test generated email permutations (e.g. `first.last@company.com`) against the company's mail server for free.

### Q: Why does the domain show "No active MX records"?
If a company domain does not exist or has no mail servers configured, the domain cannot receive email. You can type or edit the company domain directly in the **Domain** input field in the side panel and click **Re-verify Email Permutations**.

### Q: Does LeadScout consume Apollo credits on every scan?
- LeadScout only consumes 1 Apollo credit when Apollo successfully reveals a verified contact.
- If Apollo returns "Profile not found", 0 credits are spent.
- Fetching live credit balances uses 0 credits.

---

## Sharing the Extension with Teammates

To share LeadScout with your team:

### Option A: Share Zip File
1. Zip the `Email Extractor Extension` folder (excluding `.git`).
2. Send the `.zip` file to your team member.
3. Have them unzip it, open `chrome://extensions`, enable **Developer mode**, and click **Load unpacked**.

### Option B: Share via GitHub
1. Send them the repository link: `https://github.com/furqan-debug/LeadScout-Extension`.
2. They can clone or download the ZIP from GitHub and load it into Chrome.

---

## Project Structure

```
Email Extractor Extension/
├── manifest.json              # Chrome Extension Manifest V3 configuration
├── background.js              # Service worker: Apollo, Prospeo, credit fetch & CORS proxy
├── content.js                 # LinkedIn DOM parser with noise & audio filtering
├── sidepanel.html             # Extension layout (Prospect, Saved, Settings)
├── sidepanel.css              # Linear / Apollo enterprise design system
├── sidepanel.js               # Side panel controller, state manager, & animations
├── lib/
│   ├── domainResolver.js      # Multi-strategy company domain & MX resolver
│   ├── emailGenerator.js      # Corporate email pattern permutator
│   ├── enricher.js            # Prospeo, Apollo, and Hunter client library
│   ├── storage.js             # Chrome storage manager & CSV exporter
│   └── verifier.js            # DNS-over-HTTPS MX verifier
├── server/                    # Companion SMTP microservice
│   ├── server.js              # Node.js Express server
│   ├── verifier.js            # Direct Port 25 TCP socket engine
│   └── Dockerfile             # Container definition for cloud hosting
└── icons/                     # Extension branding icons
```

---

## License

This project is open-source and available under the [MIT License](LICENSE).
