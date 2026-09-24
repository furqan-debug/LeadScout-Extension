/**
 * Background Service Worker
 * Handles extension lifecycle, Side Panel behavior, and cross-origin Apollo API requests.
 */

// Enable side panel on extension icon click
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error('Error enabling side panel:', error));
  }
});

// Relay messages and handle external API calls securely
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SCAN_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: 'No active tab found' });
        return;
      }

      const activeTab = tabs[0];
      if (!activeTab.url || !activeTab.url.includes('linkedin.com/in/')) {
        sendResponse({
          success: false,
          error: 'Please navigate to a LinkedIn profile (linkedin.com/in/...)'
        });
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { type: 'EXTRACT_PROFILE_DATA' }, (response) => {
        if (chrome.runtime.lastError) {
          chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['content.js']
          }).then(() => {
            chrome.tabs.sendMessage(activeTab.id, { type: 'EXTRACT_PROFILE_DATA' }, (retryResponse) => {
              if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                sendResponse(retryResponse || { success: false, error: 'Empty response from tab' });
              }
            });
          }).catch(err => {
            sendResponse({ success: false, error: `Script injection failed: ${err.message}` });
          });
        } else {
          sendResponse(response || { success: false, error: 'Empty response from content script' });
        }
      });
    });

    return true;
  }

  // Handle Prospeo LinkedIn Email Finder via background
  if (message.type === 'ENRICH_PROSPEO') {
    const { apiKey, linkedinUrl } = message.payload || {};
    enrichProspeoApi(apiKey, linkedinUrl)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ found: false, error: err.message }));
    return true;
  }

  // Test Prospeo API connection
  if (message.type === 'TEST_PROSPEO') {
    const { apiKey } = message.payload || {};
    testProspeoApi(apiKey)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Handle Apollo People Match via background to avoid CORS
  if (message.type === 'ENRICH_APOLLO') {
    const { apiKey, linkedinUrl, fullName, company, domain, revealPhone } = message.payload || {};
    enrichApolloApi(apiKey, { linkedinUrl, fullName, company, domain, revealPhone })
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ found: false, error: err.message }));
    return true;
  }

  // Test Apollo API connection
  if (message.type === 'TEST_APOLLO') {
    const { apiKey } = message.payload || {};
    testApolloApiKey(apiKey)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // Fetch live Apollo credits
  if (message.type === 'GET_APOLLO_CREDITS') {
    const { apiKey } = message.payload || {};
    fetchApolloCredits(apiKey)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function enrichProspeoApi(apiKey, linkedinUrl) {
  if (!apiKey || !linkedinUrl) return { found: false, error: 'No Prospeo key or LinkedIn URL' };
  try {
    // Normalize to: https://www.linkedin.com/in/slug
    let cleanUrl = linkedinUrl.split('?')[0].split('#')[0];
    const inMatch = cleanUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    if (!inMatch) return { found: false, error: 'Not a valid LinkedIn profile URL (/in/ required)' };
    const slug = inMatch[1].replace(/\/$/, '');
    cleanUrl = `https://www.linkedin.com/in/${slug}`;

    console.log('[LeadScout] Prospeo Enrich Person URL:', cleanUrl);

    // Official Prospeo API endpoint: POST https://api.prospeo.io/enrich-person
    const response = await fetch('https://api.prospeo.io/enrich-person', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': apiKey.trim()
      },
      body: JSON.stringify({
        data: {
          linkedin_url: cleanUrl
        }
      })
    });

    const res = await response.json().catch(() => ({}));
    console.log('[LeadScout] Prospeo Raw Response:', JSON.stringify(res));

    if (!response.ok) {
      const msg = res.message || res.error?.message || `Prospeo HTTP ${response.status}`;
      return { found: false, error: msg };
    }

    if (res.error) {
      return { found: false, error: res.message || 'Profile not found in Prospeo database.' };
    }

    // Response contains person object
    const personData = res.person || res.response?.person || res.data || {};
    const companyData = personData.company || res.company || res.response?.company || {};
    const emailData = personData.email || res.email || res.response?.email || {};
    const emailStr = typeof emailData === 'string' ? emailData : (emailData.email || '');

    const fullName = personData.full_name || (personData.first_name ? `${personData.first_name} ${personData.last_name || ''}`.trim() : '');
    const jobTitle = personData.job_title || '';
    const companyName = companyData.name || personData.company_name || '';
    const companyDomain = companyData.domain || personData.company_website || '';

    if (!emailStr) {
      return {
        source: 'prospeo',
        found: false,
        fullName: fullName,
        jobTitle: jobTitle,
        company: companyName,
        domain: companyDomain,
        error: 'No verified email found for this profile in Prospeo.'
      };
    }

    const emailStatus = (typeof emailData === 'object' && emailData.status === 'VERIFIED')
      ? 'Prospeo 98% Verified'
      : (typeof emailData === 'object' && emailData.status ? emailData.status : 'Verified');

    return {
      source: 'prospeo',
      found: true,
      fullName: fullName,
      jobTitle: jobTitle,
      company: companyName,
      domain: companyDomain,
      email: emailStr,
      emailStatus: emailStatus,
      phoneNumbers: []
    };
  } catch (err) {
    return { found: false, error: `Prospeo error: ${err.message}` };
  }
}

async function testProspeoApi(apiKey) {
  if (!apiKey) return { success: false, error: 'Please enter a Prospeo API key.' };
  try {
    const response = await fetch('https://api.prospeo.io/account-information', {
      method: 'GET',
      headers: { 'X-KEY': apiKey.trim() }
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && !data.error) {
      const remaining = data?.response?.credits?.remaining ?? data?.credits?.remaining ?? data?.data?.credits?.remaining ?? data?.remaining_credits;
      if (remaining !== undefined) {
        if (remaining <= 0) {
          return { success: false, error: 'Prospeo free quota exhausted (0 credits remaining). Renew or use Private Verifier.' };
        }
        return { success: true, message: `✓ Prospeo Connected! (${remaining} credits remaining)` };
      }
      return { success: true, message: `✓ Prospeo Connected & Ready!` };
    }

    const errorMsg = data.message || data.error?.message || (response.status === 402 ? 'Prospeo credits depleted (0 remaining).' : 'Invalid Prospeo API key.');
    return { success: false, error: errorMsg };
  } catch (err) {
    return { success: false, error: `Connection failed: ${err.message}` };
  }
}

async function enrichApolloApi(apiKey, { linkedinUrl, fullName, company, domain, revealPhone = false }) {
  if (!apiKey) return { found: false, error: 'No Apollo API key configured' };

  const cleanUrl = linkedinUrl ? linkedinUrl.split('?')[0].replace(/\/$/, '') : '';
  const payload = {};

  if (revealPhone === true) {
    payload.reveal_phone_number = true;
  }

  if (cleanUrl) {
    payload.linkedin_url = cleanUrl;
  }
  if (fullName) {
    // Strip emojis, audio badges, and degree text
    const cleanFull = fullName
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/\b(seek to live|currently behind live)\b/gi, '')
      .replace(/(\s*[•·|,].*)$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    const parts = cleanFull.split(/\s+/);
    payload.first_name = parts[0] || '';
    const last = parts.slice(1).join(' ').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').trim();
    if (last && last.length > 1) {
      payload.last_name = last;
    }
  }
  if (company) payload.organization_name = company;
  if (domain && !domain.endsWith('.az') && !domain.endsWith('.ru')) {
    payload.domain = domain;
  }

  try {
    let response = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey.trim()
      },
      body: JSON.stringify(payload)
    });

    // If 422 occurred with phone reveal, retry immediately without phone reveal
    if (response.status === 422 && payload.reveal_phone_number) {
      console.warn('[LeadScout] Retrying Apollo match without reveal_phone_number to preserve credits...');
      delete payload.reveal_phone_number;
      response = await fetch('https://api.apollo.io/api/v1/people/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey.trim()
        },
        body: JSON.stringify(payload)
      });
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      let detailedError = errJson.message || errJson.error || `Apollo HTTP ${response.status}`;
      // Clean HTML tags from Apollo message (e.g. <a href='...'>Upgrade plan</a>)
      detailedError = detailedError.replace(/<[^>]*>?/gm, '').trim();
      console.warn('[LeadScout] Apollo people/match error:', response.status, detailedError);
      return { found: false, error: detailedError, statusCode: response.status };
    }

    const data = await response.json();
    let person = data?.person;

    // Retry with pure linkedin_url if person has no email and extra filters were sent
    if ((!person || (!person.email && (!person.phone_numbers || person.phone_numbers.length === 0))) && cleanUrl && (payload.domain || payload.organization_name)) {
      console.log('[LeadScout] Retrying Apollo match with clean linkedin_url alone...');
      const fallbackPayload = { linkedin_url: cleanUrl };
      if (payload.reveal_phone_number) fallbackPayload.reveal_phone_number = true;

      const retryRes = await fetch('https://api.apollo.io/api/v1/people/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': apiKey.trim()
        },
        body: JSON.stringify(fallbackPayload)
      }).catch(() => null);

      if (retryRes && retryRes.ok) {
        const retryData = await retryRes.json().catch(() => ({}));
        if (retryData?.person && (retryData.person.email || (retryData.person.phone_numbers && retryData.person.phone_numbers.length > 0))) {
          person = retryData.person;
        }
      }
    }

    if (!person || (!person.email && (!person.phone_numbers || person.phone_numbers.length === 0))) {
      return { found: false, error: 'Profile not found in Apollo database.' };
    }

    const phoneNumbers = [];
    if (Array.isArray(person.phone_numbers)) {
      person.phone_numbers.forEach(p => {
        const num = p.raw_number || p.sanitized_number;
        if (num) {
          phoneNumbers.push({
            number: num,
            type: p.type || 'mobile'
          });
        }
      });
    }

    return {
      source: 'apollo',
      found: true,
      fullName: person.name || fullName,
      jobTitle: person.title || '',
      company: person.organization?.name || '',
      domain: person.organization?.primary_domain || '',
      email: person.email || '',
      emailStatus: person.email_status === 'verified' ? 'Apollo Verified' : (person.email ? 'Likely Valid' : ''),
      phoneNumbers,
      photoUrl: person.photo_url || ''
    };
  } catch (err) {
    return { found: false, error: `Network error connecting to Apollo: ${err.message}` };
  }
}

async function testApolloApiKey(apiKey) {
  if (!apiKey) return { success: false, error: 'Please enter an Apollo API key.' };

  try {
    const response = await fetch('https://api.apollo.io/api/v1/auth/health', {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey.trim()
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, error: err.message || err.error || `Apollo HTTP ${response.status} (Check key permissions)` };
    }

    // Attempt live credit fetch
    const creditRes = await fetchApolloCredits(apiKey);
    let creditMsg = '';
    if (creditRes.success && creditRes.credits !== undefined && creditRes.credits !== 'Active') {
      const numStr = typeof creditRes.credits === 'number' ? creditRes.credits.toLocaleString() : creditRes.credits;
      creditMsg = ` (${numStr} credits remaining)`;
    }

    return {
      success: true,
      message: `✓ Apollo API Connected & Active!${creditMsg}`,
      credits: creditRes.credits
    };
  } catch (err) {
    return { success: false, error: `Connection failed: ${err.message}` };
  }
}

async function fetchApolloCredits(apiKey) {
  if (!apiKey) return { success: false, error: 'No Apollo API key' };

  try {
    // 1. Primary: GET /api/v1/users/api_profile?include_credit_usage=true (0 credits cost)
    const response = await fetch('https://api.apollo.io/api/v1/users/api_profile?include_credit_usage=true', {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey.trim()
      }
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      console.log('[LeadScout] Apollo api_profile credit response:', data);

      const parsed = parseCreditsFromApolloResponse(data);
      if (parsed !== null) {
        return {
          success: true,
          credits: parsed.remaining,
          total: parsed.total,
          source: 'api_profile'
        };
      }
    }

    // 2. Secondary fallback: POST /api/v1/usage_stats/api_usage_stats
    try {
      const statsRes = await fetch('https://api.apollo.io/api/v1/usage_stats/api_usage_stats', {
        method: 'POST',
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey.trim()
        }
      });

      if (statsRes.ok) {
        const statsData = await statsRes.json().catch(() => ({}));
        console.log('[LeadScout] Apollo usage_stats response:', statsData);
        const parsed = parseCreditsFromApolloResponse(statsData);
        if (parsed !== null) {
          return {
            success: true,
            credits: parsed.remaining,
            total: parsed.total,
            source: 'usage_stats'
          };
        }
      }
    } catch (e) {
      console.debug('[LeadScout] Apollo usage_stats fallback skipped:', e.message);
    }

    // 3. Header check fallback from health endpoint
    const healthRes = await fetch('https://api.apollo.io/api/v1/auth/health', {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey.trim()
      }
    });

    if (healthRes.ok) {
      const limitRem = healthRes.headers.get('x-ratelimit-remaining') || healthRes.headers.get('x-credits-remaining');
      if (limitRem && !isNaN(parseInt(limitRem, 10))) {
        return { success: true, credits: parseInt(limitRem, 10), total: null, source: 'headers' };
      }
      return { success: true, credits: 'Active', total: null, source: 'health' };
    }

    return { success: false, error: `Apollo returned HTTP ${response.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function parseCreditsFromApolloResponse(data) {
  if (!data || typeof data !== 'object') return null;

  // 1. Direct check: num_credits_remaining is Apollo's primary unified active credit balance
  if (typeof data.num_credits_remaining === 'number') {
    return {
      remaining: data.num_credits_remaining,
      total: data.effective_num_lead_credits || null
    };
  }

  // 2. Search containers for unified/remaining credits
  const containers = [
    data.credit_usage,
    data.user?.credit_usage,
    data.team?.credit_usage,
    data.usage_stats,
    data.usage,
    data.user,
    data.team,
    data
  ].filter(Boolean);

  for (const c of containers) {
    if (typeof c.num_credits_remaining === 'number') {
      return { remaining: c.num_credits_remaining, total: c.effective_num_lead_credits || null };
    }
    const targets = [c.unified_credits, c.lead_credits, c.credits, c.export_credits, c];
    for (const t of targets) {
      if (t && typeof t === 'object') {
        if (typeof t.remaining === 'number') {
          return { remaining: t.remaining, total: typeof t.limit === 'number' ? t.limit : null };
        }
        if (typeof t.available === 'number') {
          return { remaining: t.available, total: typeof t.limit === 'number' ? t.limit : null };
        }
        if (typeof t.limit === 'number' && typeof t.used === 'number') {
          return { remaining: Math.max(0, t.limit - t.used), total: t.limit };
        }
      }
    }
  }

  // Fallback: direct numeric property search
  for (const c of containers) {
    for (const key of ['num_credits_remaining', 'remaining_credits', 'available_credits', 'credits_left', 'credits']) {
      if (typeof c[key] === 'number') {
        return { remaining: c[key], total: null };
      }
    }
  }

  return null;
}
