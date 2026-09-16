# LeadScout Private SMTP Verification Backend

Independent, zero-dependency SMTP email verification microservice for LeadScout.

## Features
- **Direct Port 25 SMTP Probing**: Non-sending `HELO` -> `MAIL FROM` -> `RCPT TO` socket handshakes.
- **Catch-All Detection**: Automatically identifies if mail server accepts all emails.
- **Permutation Batching**: Takes an array of generated corporate permutations and pinpoints the real mailbox.
- **1,000+ Disposable Domains Filter**: Fast in-memory rejection of temp mail.
- **DNS MX Resolution**: Native DNS resolution with Google/Cloudflare fallback.
- **Zero Cost**: No third-party API keys, credit limits, or monthly fees.

## Quick Start (Local)
```bash
cd server
npm start
```
Server runs on `http://localhost:3000`.

## Endpoints
- `GET /health` - Checks server status and tests outbound Port 25 connectivity.
- `GET /verify?email=user@company.com` - Verifies a single email.
- `POST /verify` with JSON `{ "email": "user@company.com" }` - Verifies single email.
- `POST /verify-batch` with JSON `{ "emails": ["user@company.com", "first.last@company.com"] }` - Batch tests permutations.

## Deploying to Cloud (If Home ISP blocks Port 25)
Residential home internet (Comcast, AT&T, mobile networks) commonly drops outbound Port 25 to prevent spam bots.
Deploy this directory in 1 click to:
1. **Railway / Render / Fly.io / Hetzner / DigitalOcean**:
   - Push this `server/` folder to GitHub.
   - Connect repository on Railway or Render -> Deploy.
   - Copy the public URL (e.g. `https://my-verifier.up.railway.app`) into the LeadScout Extension settings!
