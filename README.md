# LeadScout

> High-accuracy LinkedIn prospect enrichment and direct SMTP deliverability verification engine.

LeadScout is an open-source Chrome extension (Manifest V3) and companion verification microservice designed for outbound sales, recruiting, and contact discovery. It combines on-page DOM parsing with statistical pattern permutation, DNS MX inspection, and an independent Port 25 SMTP handshake engine to verify corporate email addresses without relying exclusively on costly credit-based vendors.

---

## Architecture Overview

```
[ LinkedIn Profile Page ]
           │
           ▼
┌─────────────────────────┐
│ LeadScout Side Panel UI │ ◄── Profile Data (Name, Title, Company)
└──────────┬──────────────┘
           │
           ├──► [ Domain Resolver ] ────► Heuristic & DNS Resolution
           │
           ├──► [ Statistical Permutator ] ──► {first}.{last}, {f}{last}...
           │
           └──► [ Verification Pipeline ]
                     │
                     ├── Priority 1: Self-Hosted SMTP Socket Engine (Port 25)
                     │                 ├── Native MX Resolution
                     │                 ├── Catch-All Sentinel Detection
                     │                 └── Direct RCPT TO Handshake (250 OK)
                     │
                     ├── Priority 2: Prospeo.io API (98% Deliverability Fallback)
                     │
                     └── Priority 3: Apollo.io / Hunter.io APIs (Configurable)
```

---

## Core Capabilities

- **Client-Side Extraction**: Parses full name, job title, company name, location, and avatar directly from active LinkedIn profiles without automated account-flagging API calls.
- **Independent SMTP Handshake Engine (`server/`)**:
  - Direct TCP socket handshake against target mail exchangers (`HELO` &rarr; `MAIL FROM` &rarr; `RCPT TO`).
  - Native catch-all mailbox detection using randomized canary addresses (`nullprobe_xxx@domain`).
  - Built-in filter for 1,000+ disposable and burner email domains.
  - No marketing or test emails are delivered during verification.
- **Statistical Permutation Engine**: Generates weighted corporate email permutations based on industry standard formats (`first.last`, `first`, `flast`, `firstl`, `first_last`).
- **DNS-over-HTTPS Mail Exchanger Inspection**: Resolves MX records via public resolvers (Google / Cloudflare) to confirm active mail routing and infrastructure (Google Workspace, Microsoft 365, Mimecast, Proofpoint).
- **Multi-Provider Cloud Fallback**: Modular adapter layer supporting Prospeo (75 free monthly lookups), Apollo.io, and Hunter.io for enriched direct dials and verified contacts.
- **Local Data Governance**: All leads, API keys, and settings are stored strictly in `chrome.storage.local`. One-click CSV export with zero third-party telemetry.

---

## Project Structure

```
.
├── manifest.json              # Chrome Extension Manifest V3 configuration
├── background.js              # Service worker handling side panel & API routing
├── content.js                 # Content script for LinkedIn DOM extraction
├── sidepanel.html             # Extension side panel layout
├── sidepanel.css              # Enterprise UI stylesheet (Linear / Apollo aesthetic)
├── sidepanel.js               # Side panel lifecycle & state controller
├── lib/
│   ├── domainResolver.js      # Multi-strategy company domain resolution
│   ├── emailGenerator.js      # Statistical pattern permutation generator
│   ├── enricher.js            # Prospeo, Apollo, and Hunter API clients
│   ├── storage.js             # Local storage manager and CSV exporter
│   └── verifier.js            # Client-side DNS-over-HTTPS MX verifier
├── server/
│   ├── server.js              # Node.js microservice HTTP API (CORS enabled)
│   ├── verifier.js            # Port 25 TCP socket engine & catch-all detector
│   ├── disposableDomains.js   # Burner email domain blacklist
│   ├── package.json           # Microservice package specification
│   ├── Dockerfile             # Container definition for cloud deployment
│   └── README.md              # Backend deployment and hosting documentation
└── icons/                     # Extension icons (16px, 48px, 128px)
```

---

## Installation & Setup

### 1. Load the Chrome Extension

1. Clone or download this repository:
   ```bash
   git clone https://github.com/furqan-debug/LeadScout-Extension.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** and select the root directory of this repository.
5. Pin **LeadScout** to your toolbar for quick access.

### 2. (Optional) Run the Private SMTP Verification Engine

For zero-cost, real-time socket verification against target mail exchangers:

```bash
cd server
node server.js
```

The service will bind to `http://localhost:3000`.

To verify connectivity:
```bash
curl http://localhost:3000/health
```

*Note: Residential internet providers frequently block outbound TCP Port 25. For production accuracy, host the `server/` microservice on a VPS (Hetzner, DigitalOcean, Linode) or container service (Railway, Fly.io) with outbound Port 25 unblocked.*

---

## Usage Workflow

1. Navigate to any standard profile on LinkedIn (`linkedin.com/in/...`).
2. Open the **LeadScout** side panel from the extension toolbar.
3. Click **Scan Active Profile**.
4. The extension extracts profile metadata, verifies domain MX routing, and evaluates email candidates:
   - **Green Badge (`● 98% Deliverable` / `● SMTP 250 OK`)**: Validated inbox ready for outreach.
   - **Amber Badge (`● Catch-All`)**: Domain accepts all incoming mail; pattern based on corporate statistical weighting.
   - **Muted Badge (`● Rejected`)**: Explicitly rejected by the receiving mail server.
5. Click **Copy** to place the address on your clipboard, or **Save** to store the lead locally.
6. Open the **Saved** tab to review records and click **Export CSV** for CRM import.

---

## Configuration

In the extension's **Settings** tab, you can configure:

| Setting | Description | Default |
| :--- | :--- | :--- |
| **Private SMTP Engine** | Endpoint URL for the self-hosted verification server | `http://localhost:3000` |
| **Prioritize Private Verifier** | Run direct socket checks before consulting external APIs | `Enabled` |
| **Prospeo API Key** | Optional cloud fallback (includes 75 free verified lookups/mo) | Empty |
| **Apollo API Key** | Optional fallback for direct contact & mobile phone lookups | Empty |
| **Hunter API Key** | Optional pattern resolver fallback | Empty |

---

## License

This project is open-source and available under the [MIT License](LICENSE).
