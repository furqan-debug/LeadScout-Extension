/**
 * Email Pattern Generator
 * Generates corporate email address permutations based on industry standard frequency patterns.
 */

export function parseName(fullName) {
  if (!fullName) return { firstName: '', lastName: '', rawName: '' };

  // Clean titles, credentials, and suffixes (e.g., PhD, MBA, Jr., Sr., III, PMP)
  const cleaned = fullName
    .replace(/,\s*(PhD|MD|MBA|CPA|PMP|Esq\.?|Jr\.?|Sr\.?|II|III|IV).*$/i, '')
    .replace(/\(.*?\)/g, '')
    .trim();

  const parts = cleaned.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { firstName: '', lastName: '', rawName: fullName };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '', rawName: fullName };
  }

  const firstName = parts[0];
  const lastName = parts[parts.length - 1];

  return { firstName, lastName, rawName: fullName };
}

function sanitize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents / diacritics
    .replace(/[^a-z0-9]/g, ''); // keep alphanumeric only
}

export function generateEmailPatterns(fullName, domain) {
  if (!domain) return [];

  const { firstName, lastName } = parseName(fullName);
  const fn = sanitize(firstName);
  const ln = sanitize(lastName);
  const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  if (!fn) return [];

  const patterns = [];

  // If we have both first and last name
  if (fn && ln) {
    patterns.push({
      email: `${fn}.${ln}@${cleanDomain}`,
      format: '{first}.{last}',
      likelihood: 'High (48%)',
      score: 90
    });
    patterns.push({
      email: `${fn}@${cleanDomain}`,
      format: '{first}',
      likelihood: 'Moderate (18%)',
      score: 75
    });
    patterns.push({
      email: `${fn.charAt(0)}${ln}@${cleanDomain}`,
      format: '{f}{last}',
      likelihood: 'Common (12%)',
      score: 65
    });
    patterns.push({
      email: `${fn}${ln.charAt(0)}@${cleanDomain}`,
      format: '{first}{l}',
      likelihood: 'Common (9%)',
      score: 60
    });
    patterns.push({
      email: `${fn}_${ln}@${cleanDomain}`,
      format: '{first}_{last}',
      likelihood: 'Occasional (5%)',
      score: 50
    });
    patterns.push({
      email: `${fn.charAt(0)}.${ln}@${cleanDomain}`,
      format: '{f}.{last}',
      likelihood: 'Occasional (4%)',
      score: 45
    });
    patterns.push({
      email: `${ln}.${fn}@${cleanDomain}`,
      format: '{last}.{first}',
      likelihood: 'Rare (3%)',
      score: 30
    });
    patterns.push({
      email: `${ln}@${cleanDomain}`,
      format: '{last}',
      likelihood: 'Rare (2%)',
      score: 25
    });
  } else {
    // Only single name available
    patterns.push({
      email: `${fn}@${cleanDomain}`,
      format: '{first}',
      likelihood: 'High',
      score: 80
    });
  }

  return patterns;
}
