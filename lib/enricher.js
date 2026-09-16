/**
 * Lead Enrichment API Integration
 * Supports:
 * 1. Prospeo.io (75 Free Verified LinkedIn Emails/mo, No CC required)
 * 2. Apollo.io (Paid plans API)
 * 3. Hunter.io (25 Free Domain/Email searches/mo)
 */

/**
 * Queries Prospeo.io LinkedIn Email Finder API
 * Endpoint: POST https://api.prospeo.io/linkedin-email-finder
 * Gives 75 free verified LinkedIn emails per month with 98% deliverability.
 */
export async function enrichWithProspeo(apiKey, linkedinUrl) {
  if (!apiKey || !linkedinUrl) return { found: false, error: 'No Prospeo key or LinkedIn URL provided' };

  try {
    let cleanUrl = linkedinUrl.split('?')[0].split('#')[0];
    const inMatch = cleanUrl.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    if (!inMatch) return { found: false, error: 'Not a valid LinkedIn profile URL (/in/ required)' };
    const slug = inMatch[1].replace(/\/$/, '');
    cleanUrl = `https://www.linkedin.com/in/${slug}`;

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

    if (!response.ok) {
      const msg = res.message || res.error?.message || `Prospeo HTTP ${response.status}`;
      return { found: false, error: msg };
    }

    if (res.error) {
      return { found: false, error: res.message || 'Profile not found in Prospeo database.' };
    }

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
    return { found: false, error: `Prospeo network error: ${err.message}` };
  }
}

/**
 * Tests Prospeo API key
 */
export async function testProspeoApiKey(apiKey) {
  if (!apiKey) return { success: false, error: 'Please enter a Prospeo API key.' };

  try {
    // Check account credits / info
    const response = await fetch('https://api.prospeo.io/account-information', {
      method: 'GET',
      headers: {
        'X-KEY': apiKey.trim()
      }
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      const credits = data?.response?.credits?.remaining || 'Active';
      return { success: true, message: `✓ Prospeo Connected! (${credits} credits available)` };
    }

    const errJson = await response.json().catch(() => ({}));
    return { success: false, error: errJson.message || 'Invalid Prospeo API key. Check key in your dashboard.' };
  } catch (err) {
    return { success: false, error: `Connection failed: ${err.message}` };
  }
}

/**
 * Queries Apollo.io People Match API
 */
export async function enrichWithApollo(apiKey, { linkedinUrl, fullName, company, domain }) {
  if (!apiKey) return { found: false, error: 'No Apollo API key configured' };

  try {
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

    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey.trim()
    };

    let response = await fetch('https://api.apollo.io/api/v1/people/match', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (response.status === 404) {
      response = await fetch('https://api.apollo.io/v1/people/match', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
    }

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      return { found: false, error: errJson.message || errJson.error || `Apollo HTTP ${response.status}` };
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
    return { found: false, error: `Apollo error: ${err.message}` };
  }
}

/**
 * Queries Hunter.io Email Finder API
 */
export async function enrichWithHunter(apiKey, { domain, fullName, company }) {
  if (!apiKey || (!domain && !company)) return null;

  try {
    const parts = (fullName || '').trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    const params = new URLSearchParams({
      api_key: apiKey.trim(),
      first_name: firstName,
      last_name: lastName
    });

    if (domain) {
      params.append('domain', domain);
    } else if (company) {
      params.append('company', company);
    }

    const response = await fetch(`https://api.hunter.io/v2/email-finder?${params.toString()}`);
    if (!response.ok) return null;

    const res = await response.json();
    const data = res?.data;

    if (data && data.email) {
      return {
        source: 'hunter',
        found: true,
        email: data.email,
        score: data.score || 90,
        emailStatus: data.verification?.status === 'valid' ? 'Hunter Verified' : 'High Confidence',
        domain: domain || data.domain
      };
    }
  } catch (err) {
    return null;
  }

  return null;
}
