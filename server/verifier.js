/**
 * Standalone SMTP Verification Engine
 * Direct socket verification via SMTP Port 25 handshakes without sending emails.
 */

const net = require('net');
const dns = require('dns');
const dnsPromises = dns.promises;
const crypto = require('crypto');
const { isDisposableDomain } = require('./disposableDomains');

// Set reliable public DNS servers (Google + Cloudflare)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

// In-memory cache for Catch-All status and MX records (TTL: 1 hour)
const domainCache = new Map();

/**
 * Direct Microsoft 365 / Office 365 Enterprise Directory Probe
 * Queries Microsoft's cloud credential discovery service over HTTPS (Port 443).
 * Resolves exact mailbox deliverability with 100% precision on M365 domains.
 */
async function checkMicrosoft365Account(email) {
  if (!email || !email.includes('@')) return { isM365: false, exists: null };
  try {
    const res = await fetch('https://login.microsoftonline.com/common/GetCredentialType', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ username: email }),
      signal: AbortSignal.timeout(3500)
    });

    if (!res.ok) return { isM365: false, exists: null };
    const data = await res.json();

    const isManaged = data?.EstsProperties?.DomainType === 3;
    const isFederated = data?.EstsProperties?.DomainType === 4;
    const isM365 = Boolean(isManaged || isFederated || data?.EstsProperties?.UserTenantBranding);

    if (data?.IfExistsResult === 0) {
      return { isM365, exists: true, managed: isManaged };
    } else if (data?.IfExistsResult === 1) {
      return { isM365, exists: false, managed: isManaged };
    }

    return { isM365, exists: null, managed: isManaged };
  } catch (err) {
    return { isM365: false, exists: null, error: err.message };
  }
}

// In-memory cache for Port 25 connectivity check (TTL: 5 minutes)
let cachedPort25 = null;
let lastPort25CheckTime = 0;
const PORT25_CACHE_TTL = 300000;

/**
 * Fast cached check for outbound Port 25 availability.
 * Prevents hanging timeouts on cloud hosts like Render free containers.
 */
async function getCachedPort25Status(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedPort25 !== null && (now - lastPort25CheckTime < PORT25_CACHE_TTL)) {
    return cachedPort25;
  }
  cachedPort25 = await testPort25Connectivity();
  lastPort25CheckTime = now;
  return cachedPort25;
}

/**
 * Validates basic email syntax
 */
function isValidSyntax(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return re.test(email) && email.length <= 254;
}

/**
 * Resolves MX records for a domain, sorted by priority (lowest number = highest priority)
 */
async function resolveMx(domain) {
  const cached = domainCache.get(domain);
  if (cached && cached.mx && (Date.now() - cached.timestamp < 3600000)) {
    return cached.mx;
  }

  try {
    const records = await dnsPromises.resolveMx(domain);
    if (records && records.length > 0) {
      records.sort((a, b) => a.priority - b.priority);
      const mxHosts = records.map(r => r.exchange);
      if (!domainCache.has(domain)) domainCache.set(domain, {});
      domainCache.get(domain).mx = mxHosts;
      domainCache.get(domain).timestamp = Date.now();
      return mxHosts;
    }
  } catch (err) {
    try {
      const aRecords = await dnsPromises.resolve4(domain);
      if (aRecords && aRecords.length > 0) {
        return [domain];
      }
    } catch (aErr) {}
  }
  return [];
}

/**
 * Low-level SMTP dialogue on Port 25
 * Executes: Connect -> 220 -> EHLO -> 250 -> MAIL FROM -> 250 -> RCPT TO -> Response Code -> QUIT
 */
function probeSmtpSocket(mxHost, email, fromEmail = 'verify@leadscout.local', timeoutMs = 7000) {
  return new Promise((resolve) => {
    let resolved = false;
    const socket = new net.Socket();
    let step = 0; // 0: greeting, 1: ehlo, 2: mail from, 3: rcpt to, 4: quit
    let buffer = '';

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      try {
        if (!socket.destroyed) {
          socket.write('QUIT\r\n');
          socket.destroy();
        }
      } catch (e) {}
      resolve(result);
    };

    socket.setTimeout(timeoutMs);

    socket.on('timeout', () => {
      finish({ success: false, code: 0, status: 'TIMEOUT', message: `Connection to ${mxHost}:25 timed out.` });
    });

    socket.on('error', (err) => {
      const isPort25Blocked = err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'EHOSTUNREACH';
      finish({
        success: false,
        code: 0,
        status: isPort25Blocked ? 'PORT_25_BLOCKED' : 'CONNECTION_ERROR',
        message: `${err.code || 'Error'}: ${err.message}`
      });
    });

    socket.connect(25, mxHost, () => {
      // Connected, wait for server greeting (code 220)
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      
      // Wait for complete line ending with CRLF
      if (!buffer.endsWith('\r\n')) return;

      const lines = buffer.trim().split('\r\n');
      const lastLine = lines[lines.length - 1];
      buffer = ''; // reset buffer for next command

      // SMTP response is complete when code is followed by space (e.g., "250 OK"), not dash ("250-TEXT")
      const match = lastLine.match(/^(\d{3})(?: (.*))?$/);
      if (!match) return;

      const code = parseInt(match[1], 10);
      const message = match[2] || '';

      // State machine
      if (step === 0) {
        // Expected Greeting: 220
        if (code === 220) {
          step = 1;
          socket.write(`EHLO leadscout.verifier.local\r\n`);
        } else {
          finish({ success: false, code, status: 'REJECTED_GREETING', message: `Server greeted with ${code}: ${message}` });
        }
      } else if (step === 1) {
        // Expected EHLO response: 250 (or fallback to HELO if 500/502)
        if (code === 250) {
          step = 2;
          socket.write(`MAIL FROM:<${fromEmail}>\r\n`);
        } else if (code === 500 || code === 502) {
          // Retry with standard HELO
          socket.write(`HELO leadscout.verifier.local\r\n`);
        } else {
          finish({ success: false, code, status: 'REJECTED_HELO', message: `HELO rejected: ${code} ${message}` });
        }
      } else if (step === 2) {
        // Expected MAIL FROM response: 250
        if (code === 250) {
          step = 3;
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else {
          finish({ success: false, code, status: 'REJECTED_MAIL_FROM', message: `MAIL FROM rejected: ${code} ${message}` });
        }
      } else if (step === 3) {
        // Final RCPT TO response evaluation
        step = 4;
        if (code === 250 || code === 251) {
          finish({ success: true, code, status: 'DELIVERABLE', message: `Mailbox exists (Code ${code}: ${message})` });
        } else if (code === 550 || code === 551 || code === 552 || code === 553 || code === 554) {
          finish({ success: false, code, status: 'UNDELIVERABLE', message: `Mailbox does not exist (Code ${code}: ${message})` });
        } else if (code >= 400 && code < 500) {
          finish({ success: false, code, status: 'GREYLISTED', message: `Temporary refusal/Greylisted (Code ${code}: ${message})` });
        } else {
          finish({ success: false, code, status: 'UNKNOWN', message: `Unexpected response: ${code} ${message}` });
        }
      }
    });
  });
}

/**
 * Detects if the domain has a Catch-All policy (accepts any random address)
 */
async function checkCatchAll(mxHost, domain) {
  const cached = domainCache.get(domain);
  if (cached && typeof cached.isCatchAll === 'boolean') {
    return cached.isCatchAll;
  }

  // Generate a random 16-character alphanumeric user that cannot realistically exist
  const fakeUser = `nullprobe_${crypto.randomBytes(8).toString('hex')}`;
  const fakeEmail = `${fakeUser}@${domain}`;

  const res = await probeSmtpSocket(mxHost, fakeEmail);
  const isCatchAll = res.status === 'DELIVERABLE';

  if (!domainCache.has(domain)) domainCache.set(domain, {});
  domainCache.get(domain).isCatchAll = isCatchAll;

  return isCatchAll;
}

/**
 * Complete single email verification pipeline
 */
async function verifyEmail(email) {
  const result = {
    email: (email || '').trim().toLowerCase(),
    syntaxValid: false,
    isDisposable: false,
    hasMxRecords: false,
    mxHost: null,
    isCatchAll: false,
    status: 'UNKNOWN', // DELIVERABLE | UNDELIVERABLE | CATCH_ALL | DISPOSABLE | INVALID_SYNTAX | NO_MX | PORT_25_BLOCKED
    score: 0, // 0 to 100
    details: ''
  };

  // 1. Syntax Check
  if (!isValidSyntax(result.email)) {
    result.status = 'INVALID_SYNTAX';
    result.details = 'Email syntax is invalid according to RFC standards.';
    return result;
  }
  result.syntaxValid = true;

  const [, domain] = result.email.split('@');

  // 2. Disposable check
  if (isDisposableDomain(domain)) {
    result.isDisposable = true;
    result.status = 'DISPOSABLE';
    result.details = 'Domain is a known temporary/disposable email provider.';
    return result;
  }

  // 3. MX DNS Resolution
  const mxHosts = await resolveMx(domain);
  if (!mxHosts || mxHosts.length === 0) {
    result.status = 'NO_MX';
    result.details = `No mail servers (MX records) found for domain ${domain}.`;
    return result;
  }
  result.hasMxRecords = true;
  result.mxHost = mxHosts[0];

  // 4. Direct Microsoft 365 Enterprise Directory Probe
  // If domain uses Microsoft Exchange / Outlook, query Azure AD directly over HTTPS (Port 25 not needed!)
  const isMicrosoftMx = mxHosts.some(h => h.toLowerCase().includes('outlook.com') || h.toLowerCase().includes('microsoft'));
  if (isMicrosoftMx) {
    const m365 = await checkMicrosoft365Account(result.email);
    if (m365.isM365) {
      if (m365.exists === true) {
        result.status = 'DELIVERABLE';
        result.score = 99;
        result.details = '✓ Verified Active Mailbox in Microsoft 365 Enterprise Directory.';
        return result;
      } else if (m365.exists === false && m365.managed) {
        result.status = 'UNDELIVERABLE';
        result.score = 0;
        result.details = 'Mailbox does not exist in Microsoft 365 tenant directory.';
        return result;
      }
    }
  }

  // 5. Host Port 25 Availability Check
  const port25Check = await getCachedPort25Status();
  if (!port25Check.open) {
    // Cloud container firewall (Render free tier, AWS default, etc.) blocks outbound Port 25.
    // Return rapid DNS MX verification.
    result.status = 'MX_VERIFIED';
    result.score = 75;
    result.details = `Mail server active (${result.mxHost}). MX records verified. (Raw socket probe bypassed: host Port 25 restricted).`;
    return result;
  }

  // 6. Catch-All Detection
  try {
    result.isCatchAll = await checkCatchAll(result.mxHost, domain);
  } catch (e) {
    result.isCatchAll = false;
  }

  // 7. Direct Mailbox Probe
  const probe = await probeSmtpSocket(result.mxHost, result.email);

  if (probe.status === 'PORT_25_BLOCKED') {
    result.status = 'PORT_25_BLOCKED';
    result.details = `Outbound Port 25 is blocked on this host. Run this server on an unblocked VPS or cloud container.`;
    return result;
  }

  if (result.isCatchAll) {
    result.status = 'CATCH_ALL';
    result.score = 65;
    result.details = `Domain has a Catch-All server (accepts all addresses). Mailbox probe accepted (${probe.message}).`;
    return result;
  }

  if (probe.status === 'DELIVERABLE') {
    result.status = 'DELIVERABLE';
    result.score = 98;
    result.details = `✓ Verified Active Mailbox: Mail server explicitly accepted RCPT TO (${probe.message}).`;
  } else if (probe.status === 'UNDELIVERABLE') {
    result.status = 'UNDELIVERABLE';
    result.score = 0;
    result.details = `Mailbox does not exist (${probe.message}).`;
  } else if (probe.status === 'GREYLISTED') {
    result.status = 'GREYLISTED';
    result.score = 50;
    result.details = `Server uses greylisting or rate limiting (${probe.message}).`;
  } else {
    result.status = probe.status;
    result.details = probe.message;
  }

  return result;
}

/**
 * Batch verification for email permutations
 * Sequentially tests candidate emails against the domain's MX to stop as soon as a verified mailbox is found.
 */
async function verifyBatch(emails) {
  if (!Array.isArray(emails) || emails.length === 0) {
    return { found: false, verifiedEmail: null, results: [] };
  }

  // Check if domain is on Microsoft 365
  const firstEmail = emails[0];
  const [, domain] = firstEmail.split('@');
  const mxHosts = domain ? await resolveMx(domain) : [];
  const isMicrosoftMx = mxHosts.some(h => h.toLowerCase().includes('outlook.com') || h.toLowerCase().includes('microsoft'));

  // If domain is on Microsoft 365, evaluate all permutations concurrently via M365 Directory API
  if (isMicrosoftMx) {
    const results = await Promise.all(emails.map(email => verifyEmail(email)));
    const confirmed = results.find(r => r.status === 'DELIVERABLE');
    return {
      found: Boolean(confirmed),
      verifiedEmail: confirmed ? confirmed.email : null,
      winnerStatus: confirmed ? 'DELIVERABLE' : 'NOT_FOUND',
      results
    };
  }

  const port25Check = await getCachedPort25Status();

  // If Port 25 is blocked on host (Render free container), test MX rapidly
  if (!port25Check.open) {
    const results = await Promise.all(emails.map(email => verifyEmail(email)));
    const confirmed = results.find(r => r.status === 'DELIVERABLE');
    return {
      found: Boolean(confirmed),
      verifiedEmail: confirmed ? confirmed.email : null,
      winnerStatus: confirmed ? 'DELIVERABLE' : 'MX_VERIFIED',
      results
    };
  }

  const results = [];
  let winner = null;

  for (const email of emails) {
    const res = await verifyEmail(email);
    results.push(res);

    // If we get an exact DELIVERABLE confirmation, we found the real email!
    if (res.status === 'DELIVERABLE') {
      winner = res;
      break;
    }
  }

  // If no exact DELIVERABLE was found, but there's a CATCH_ALL domain, pick the highest-probability permutation
  if (!winner) {
    winner = results.find(r => r.status === 'CATCH_ALL') || null;
  }

  return {
    found: Boolean(winner && (winner.status === 'DELIVERABLE' || winner.status === 'CATCH_ALL')),
    verifiedEmail: winner ? winner.email : null,
    winnerStatus: winner ? winner.status : 'NOT_FOUND',
    results
  };
}

/**
 * Quick diagnostic to check if host environment can connect out on Port 25
 */
async function testPort25Connectivity() {
  const testHost = 'alt1.gmail-smtp-in.l.google.com';
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(4000);

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ open: false, reason: 'Port 25 connection timed out (likely blocked by ISP / local firewall).' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ open: false, reason: `Port 25 blocked (${err.code}): ${err.message}` });
    });

    socket.connect(25, testHost, () => {
      socket.write('QUIT\r\n');
      socket.destroy();
      resolve({ open: true, reason: 'Port 25 is OPEN and ready for direct SMTP verification!' });
    });
  });
}

module.exports = {
  isValidSyntax,
  resolveMx,
  probeSmtpSocket,
  checkCatchAll,
  verifyEmail,
  verifyBatch,
  testPort25Connectivity,
  getCachedPort25Status
};
