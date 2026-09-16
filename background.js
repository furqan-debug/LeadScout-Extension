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
    const { apiKey, linkedinUrl, fullName, company, domain } = message.payload || {};
    enrichApolloApi(apiKey, { linkedinUrl, fullName, company, domain })
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

async function enrichApolloApi(apiKey, { linkedinUrl, fullName, company, domain }) {
  if (!apiKey) return { found: false, error: 'No Apollo API key configured' };

  const cleanUrl = linkedinUrl ? linkedinUrl.split('?')[0].replace(/\/$/, '') : '';
  const payload = {
    reveal_personal_emails: true,
    reveal_phone_number: true
  };

  if (cleanUrl) {
    payload.linkedin_url = cleanUrl;
  } else {
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      payload.first_name = parts[0] || '';
      payload.last_name = parts.slice(1).join(' ') || '';
    }
    if (company) payload.organization_name = company;
    if (domain) payload.domain = domain;
  }

  try {
    const response = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey.trim()
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const detailedError = errJson.message || errJson.error || `Apollo HTTP ${response.status}`;
      console.warn('[LeadScout] Apollo people/match error:', response.status, detailedError);
      return { found: false, error: detailedError };
    }

    const data = await response.json();
    const person = data?.person;

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
    // 1. Test Auth Health
    const response = await fetch('https://api.apollo.io/api/v1/auth/health', {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey.trim()
      }
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return { success: false, error: err.message || err.error || `HTTP ${response.status}` };
    }

    // 2. Test People Match permission with a sample query
    const matchRes = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey.trim()
      },
      body: JSON.stringify({
        first_name: 'Satya',
        last_name: 'Nadella',
        organization_name: 'Microsoft'
      })
    });

    if (!matchRes.ok) {
      const matchErr = await matchRes.json().catch(() => ({}));
      return {
        success: false,
        error: matchErr.message || matchErr.error || `Match endpoint rejected (HTTP ${matchRes.status}). Check if key has Master/Match permissions.`
      };
    }

    return { success: true, message: '✓ Apollo API Key & People Match verified working!' };
  } catch (err) {
    return { success: false, error: `Connection failed: ${err.message}` };
  }
}
