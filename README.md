# LeadScout - Free LinkedIn Email Prospector (Apollo Alternative)

A 100% free, privacy-friendly Chrome Extension (Manifest V3) that extracts prospect data from LinkedIn profiles, discovers corporate email address patterns, verifies mail server (MX) activity in real-time, and exports leads to CSV.

---

## Key Features

- **In-Browser DOM Extraction**: Extracts name, job title, company name, location, and avatar directly from LinkedIn profile pages (`linkedin.com/in/...`) on-demand.
- **Automated Company Domain Discovery**: Uses Clearbit's free autocomplete API with heuristic fallbacks to resolve company names (e.g. "Stripe", "Airbnb") into official domains (`stripe.com`, `airbnb.com`).
- **Corporate Pattern Generation**: Calculates statistically weighted email permutations:
  - `first.last@domain.com` (48% standard)
  - `first@domain.com` (18% startup/SMB)
  - `flast@domain.com` & `firstl@domain.com` (common enterprise)
  - `first_last@domain.com`
- **DNS MX Mail Server Verification**: Connects to Cloudflare's free DNS-over-HTTPS resolver to verify if the company's domain actively receives email and identifies the provider (Google Workspace, Microsoft 365, Mimecast, Proofpoint, etc.).
- **Chrome Side Panel**: Built on Chrome's native `chrome.sidePanel` API for a side-by-side workflow that doesn't obstruct or inject unwanted DOM into LinkedIn.
- **Lead Management & CSV Export**: Save leads locally and export them in one click to CSV.

---

## How to Install in Google Chrome

1. Open Google Chrome.
2. In the URL bar, go to:
   ```
   chrome://extensions
   ```
3. In the top-right corner, toggle **Developer mode** ON.
4. Click the **Load unpacked** button in the top-left.
5. Select the folder:
   ```
   c:\dev\Email Extractor Extension
   ```
6. The extension **LeadScout - Free LinkedIn Email Prospector** is now installed!
7. Pin the extension icon to your Chrome toolbar for quick access.

---

## How to Use

1. Navigate to any LinkedIn profile (e.g., `https://www.linkedin.com/in/...`).
2. Click the **LeadScout** icon in your Chrome toolbar. The **Side Panel** will slide open on the right side of the screen.
3. Click **"Scan Active LinkedIn Profile"**.
4. LeadScout automatically pulls:
   - Prospect Name & Headline
   - Current Company
   - Auto-finds company domain via Clearbit
   - Performs a live DNS MX check to verify active mail servers
5. Click **"⚡ Generate & Verify Emails"** to see prioritized email patterns with probability ratings.
6. Click **📋** to copy any address, or **💾** to save the prospect.
7. Switch to the **"Saved"** tab and click **"📥 Export CSV"** anytime to download your lead list.

---

## File Structure

```
c:\dev\Email Extractor Extension\
├── manifest.json            # Manifest V3 configuration & permissions
├── background.js           # Background service worker (sidePanel & messaging)
├── content.js              # Injected LinkedIn DOM scraper
├── sidepanel.html          # Side panel UI layout
├── sidepanel.css           # Modern Apollo-style responsive CSS
├── sidepanel.js            # Main controller logic
├── icons/                  # 16px, 48px, 128px extension icons
└── lib/
    ├── domainResolver.js   # Clearbit free domain discovery & heuristics
    ├── emailGenerator.js   # Name cleaner & pattern permutation engine
    ├── verifier.js         # Cloudflare DNS-over-HTTPS MX verifier
    └── storage.js          # chrome.storage.local manager & CSV exporter
```

---

## Zero-Cost Guarantee

This extension requires **no paid subscriptions, no credits, and no third-party database fees**. All processing runs directly in your browser using free public DNS-over-HTTPS and open autocomplete endpoints.
