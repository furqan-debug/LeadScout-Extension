/**
 * Domain & Mail Exchanger (MX) Verifier
 * Uses Cloudflare DNS-over-HTTPS (free, fast, no API key needed) to verify
 * that the target company domain has active mail servers configured.
 */

export async function verifyDomainMX(domain) {
  if (!domain) {
    return {
      hasMx: false,
      provider: 'Unknown',
      records: [],
      status: 'error',
      message: 'No domain provided'
    };
  }

  const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=MX`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/dns-json'
      }
    });

    if (!response.ok) {
      throw new Error(`DNS Query returned status ${response.status}`);
    }

    const data = await response.json();

    // Status: 0 = NOERROR (successful query)
    if (data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0) {
      const records = data.Answer.map(ans => ans.data);
      const provider = detectEmailProvider(records);

      return {
        hasMx: true,
        domain: cleanDomain,
        provider,
        records,
        status: 'valid',
        message: `Active mail servers verified (${provider})`
      };
    } else {
      return {
        hasMx: false,
        domain: cleanDomain,
        provider: 'None',
        records: [],
        status: 'invalid',
        message: 'No active MX records found for this domain'
      };
    }
  } catch (err) {
    console.warn('[LeadScout] DNS MX Verification error:', err);
    return {
      hasMx: false,
      domain: cleanDomain,
      provider: 'Unknown',
      records: [],
      status: 'unverified',
      message: 'Could not query DNS servers'
    };
  }
}

/**
 * Detects common enterprise email hosting providers from MX records
 */
function detectEmailProvider(records) {
  const combined = records.join(' ').toLowerCase();

  if (combined.includes('google.com') || combined.includes('googlemail.com') || combined.includes('aspmx')) {
    return 'Google Workspace';
  }
  if (combined.includes('outlook.com') || combined.includes('microsoft.com') || combined.includes('office365')) {
    return 'Microsoft 365 / Exchange';
  }
  if (combined.includes('mimecast')) {
    return 'Mimecast Gateway';
  }
  if (combined.includes('pphosted.com') || combined.includes('proofpoint')) {
    return 'Proofpoint Gateway';
  }
  if (combined.includes('barracudanetworks.com')) {
    return 'Barracuda Gateway';
  }
  if (combined.includes('zoho.com')) {
    return 'Zoho Mail';
  }
  if (combined.includes('protonmail.ch') || combined.includes('proton.me')) {
    return 'Proton Mail';
  }
  return 'Custom Corporate Mail Server';
}
