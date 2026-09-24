/**
 * Domain Resolver & Discovery Engine
 * Resolves the true company domain through multi-source validation:
 * 1. Smart TLD Permutation (e.g. ImagineArt -> imagine.art, imagineart.com, imagineart.ai)
 * 2. Real-time MX Mail Server Verification
 * 3. Clearbit Autocomplete filtered by geographical and top-tier TLD relevance
 */

import { verifyDomainMX } from './verifier.js';

export async function resolveDomain(companyName, location = '') {
  if (!companyName || typeof companyName !== 'string') {
    return { domain: '', logo: null, companyName: '', confidence: 'none' };
  }

  const cleaned = cleanCompanyName(companyName);

  // 1. Generate Smart Candidate Domains based on company name
  const candidates = generateDomainCandidates(cleaned);

  // 2. Test Candidates against DNS MX records in parallel
  // The first candidate with active Google Workspace, Microsoft 365, or valid MX is selected!
  for (const candidate of candidates) {
    const mxResult = await verifyDomainMX(candidate);
    if (mxResult && mxResult.hasMx) {
      return {
        domain: candidate,
        logo: null,
        companyName,
        mxStatus: mxResult,
        confidence: 'mx_verified'
      };
    }
  }

  // 3. Fallback to Clearbit Autocomplete with Geo/TLD Filtering
  try {
    const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(cleaned)}`;
    const response = await fetch(url);
    if (response.ok) {
      const suggestions = await response.json();
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        // Filter out irrelevant country-code TLDs (e.g. .ro, .pl, .za) unless user location matches
        const best = pickBestClearbitMatch(suggestions, cleaned, location);
        if (best) {
          const mx = await verifyDomainMX(best.domain);
          if (mx && mx.hasMx) {
            return {
              domain: best.domain,
              logo: best.logo,
              companyName: best.name || companyName,
              mxStatus: mx,
              confidence: 'clearbit'
            };
          }
        }
      }
    }
  } catch (err) {
    console.debug('[LeadScout] Clearbit query failed:', err);
  }

  // 4. Default fallback: cleaned.com
  const defaultDomain = candidates[0] || `${cleaned.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
  return {
    domain: defaultDomain,
    logo: null,
    companyName,
    mxStatus: null,
    confidence: 'heuristic'
  };
}

function cleanCompanyName(name) {
  return name
    .replace(/\b(Inc\.?|LLC\.?|Ltd\.?|Limited|Corp\.?|Corporation|GmbH|Co\.?|Group|Technologies|Solutions)\b/gi, '')
    .trim();
}

/**
 * Generates smart domain candidates
 * E.g. "ImagineArt" -> ["imagine.art", "imagineart.ai", "imagineart.com", "imagineart.io"]
 */
function generateDomainCandidates(name) {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const candidates = [];

  // Check if name ends with a known tech/modern TLD (e.g. Art, AI, IO, Tech, App, Dev)
  const tldMatches = [
    { suffix: 'art', tld: '.art' },
    { suffix: 'ai', tld: '.ai' },
    { suffix: 'io', tld: '.io' },
    { suffix: 'tech', tld: '.tech' },
    { suffix: 'app', tld: '.app' },
    { suffix: 'dev', tld: '.dev' },
    { suffix: 'cloud', tld: '.cloud' }
  ];

  for (const { suffix, tld } of tldMatches) {
    if (sanitized.endsWith(suffix) && sanitized.length > suffix.length) {
      const stem = sanitized.slice(0, -suffix.length);
      candidates.push(`${stem}${tld}`); // e.g. imagine.art
    }
  }

  // Common corporate TLDs
  candidates.push(`${sanitized}.com`);
  candidates.push(`${sanitized}.ai`);
  candidates.push(`${sanitized}.io`);
  candidates.push(`${sanitized}.co`);
  candidates.push(`${sanitized}.net`);

  return candidates;
}

/**
 * Rejects strange country-code TLDs from Clearbit unless location matches
 */
function pickBestClearbitMatch(suggestions, companyName, location) {
  const safeTlds = ['.com', '.io', '.ai', '.art', '.co', '.org', '.net', '.tech', '.app', '.dev'];
  const locLower = (location || '').toLowerCase();

  // First check if any suggestion has a top-tier or tech TLD
  for (const item of suggestions) {
    if (item.domain) {
      const lowerDom = item.domain.toLowerCase();
      if (safeTlds.some(tld => lowerDom.endsWith(tld))) {
        return item;
      }
    }
  }

  // If user location specifies country (e.g. UK, Germany), allow matching cTLD
  for (const item of suggestions) {
    const dom = item.domain.toLowerCase();
    if (locLower.includes('united kingdom') && dom.endsWith('.uk')) return item;
    if (locLower.includes('germany') && dom.endsWith('.de')) return item;
    if (locLower.includes('canada') && dom.endsWith('.ca')) return item;
    if (locLower.includes('france') && dom.endsWith('.fr')) return item;
  }

  // Otherwise pick first only if it doesn't look like a completely random local TLD
  const first = suggestions[0];
  const firstDom = (first.domain || '').toLowerCase();
  const suspiciousTlds = ['.ro', '.pl', '.cz', '.za', '.ru', '.ir', '.by', '.sk'];
  if (!suspiciousTlds.some(tld => firstDom.endsWith(tld))) {
    return first;
  }

  return null;
}
