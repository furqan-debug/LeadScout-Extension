const http = require('http');
const { verifyEmail, verifyBatch, testPort25Connectivity } = require('./verifier');

const PORT = process.env.PORT || 3000;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  try {
    // ── 1. GET /health ──────────────────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/health') {
      const port25Check = await testPort25Connectivity();
      return sendJson(res, 200, {
        status: 'online',
        service: 'LeadScout Private SMTP Verifier',
        version: '1.0.0',
        port25Open: port25Check.open,
        port25Status: port25Check.reason,
        timestamp: new Date().toISOString()
      });
    }

    // ── 2. GET /verify?email=... or POST /verify ───────────────────────────
    if ((req.method === 'GET' || req.method === 'POST') && pathname === '/verify') {
      let targetEmail = '';
      if (req.method === 'GET') {
        targetEmail = reqUrl.searchParams.get('email') || '';
      } else {
        const body = await parseBody(req);
        targetEmail = body.email || '';
      }

      if (!targetEmail) {
        return sendJson(res, 400, { error: 'Please provide an email to verify.' });
      }

      const result = await verifyEmail(targetEmail);
      return sendJson(res, 200, result);
    }

    // ── 3. POST /verify-batch ───────────────────────────────────────────────
    if (req.method === 'POST' && pathname === '/verify-batch') {
      const body = await parseBody(req);
      const emails = body.emails || [];

      if (!Array.isArray(emails) || emails.length === 0) {
        return sendJson(res, 400, { error: 'Please provide an array of emails in body.emails.' });
      }

      const batchResult = await verifyBatch(emails);
      return sendJson(res, 200, batchResult);
    }

    // 404
    return sendJson(res, 404, { error: 'Not found. Available endpoints: /health, /verify, /verify-batch' });
  } catch (err) {
    console.error('[Server Error]', err);
    return sendJson(res, 500, { error: `Internal error: ${err.message}` });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use by another process.`);
    console.error(`To stop it, run in PowerShell:`);
    console.error(`Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
  } else {
    console.error(`Server error:`, err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` LeadScout Private SMTP Verifier Engine v1.0.0`);
  console.log(` Running on: http://localhost:${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});
