/**
 * LinkedIn Content Script - v1.3
 * Multi-strategy DOM extraction. Anchors to profile H1 and casts a wide
 * net of fallbacks to handle LinkedIn lazy-loaded / React-rendered DOM.
 */

async function extractLinkedInProfile() {
  const data = {
    fullName: '',
    jobTitle: '',
    company: '',
    domain: '',
    directEmail: '',
    location: '',
    profilePic: '',
    linkedinUrl: window.location.href.split('?')[0].split('#')[0]
  };

  // Helper: check if a text string is just degree indicator or UI noise
  function isDegreeOrNoise(str) {
    if (!str) return true;
    const s = str.trim();
    if (s.length < 2) return true;
    // Matches: "· 2nd", "• 2nd", "2nd", "1st", "3rd+", "2nd degree connection", etc.
    if (/^[·•\s]*\d+(st|nd|rd|th)(\+)?(\s+degree(\s+connection)?)?[\s·•]*$/i.test(s)) return true;
    const lo = s.toLowerCase();
    if (lo === 'open' || lo === 'premium' || lo.includes('connections') || lo.includes('followers') ||
        lo.includes('contact info') || lo.includes('mutual connection') || lo.includes('message') ||
        lo.includes('following') || lo.includes('follow') || lo.includes('connect') ||
        lo.includes('view my') || lo.includes('profile enhanced') || lo.includes('sales navigator')) return true;
    return false;
  }

  function looksLikeLocation(text) {
    if (!text) return false;
    const t = text.trim();
    if (isDegreeOrNoise(t)) return false;
    const companySuffixes = /\b(productions?|studios?|inc\.?|llc\.?|ltd\.?|corp\.?|group|agency|media|digital|brand|labs?|works?|design|creative|consulting)\b/i;
    const hasComma = t.includes(',');
    const geoWords = /\b(area|region|city|metro|greater|united|emirates|kingdom|states|pakistan|india|uk|usa|uae|canada|australia|europe|asia|africa|remote|worldwide|global|dubai|karachi|lahore|islamabad|london|new york|san francisco|california)\b/i;
    if (!hasComma && companySuffixes.test(t) && !geoWords.test(t)) return false;
    return (hasComma || geoWords.test(t)) && t.length > 2 && t.length < 100;
  }

  // 0. Structured JSON-LD extraction (Present on virtually all LinkedIn profiles)
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      const parsed = JSON.parse(s.textContent || '{}');
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
      for (const item of items) {
        if (item && (item['@type'] === 'Person' || item.name)) {
          if (!data.fullName && item.name) data.fullName = item.name.trim();
          if (!data.jobTitle && item.jobTitle) {
            const jt = Array.isArray(item.jobTitle) ? item.jobTitle[0] : item.jobTitle;
            if (jt && typeof jt === 'string') data.jobTitle = jt.trim();
          }
          if (!data.company && item.worksFor) {
            const org = Array.isArray(item.worksFor) ? item.worksFor[0] : item.worksFor;
            if (org && org.name) data.company = org.name.trim();
            else if (org && org.worksFor && org.worksFor.name) data.company = org.worksFor.name.trim();
          }
          if (!data.location && item.address) {
            if (typeof item.address === 'string') data.location = item.address.trim();
            else if (item.address.addressLocality) {
              data.location = [item.address.addressLocality, item.address.addressRegion, item.address.addressCountry].filter(Boolean).join(', ');
            }
          }
          if (!data.profilePic && item.image) {
            data.profilePic = typeof item.image === 'string' ? item.image : (item.image.contentUrl || item.image.url || '');
          }
        }
      }
    }
  } catch (e) {}

  // 1. Full Name: document.title is clean and fast
  if (!data.fullName && document.title) {
    const cleaned = document.title
      .replace(/^\(\d+\)\s*/, '')
      .replace(/\s*\|\s*LinkedIn$/i, '')
      .trim();
    if (cleaned && !cleaned.toLowerCase().includes('feed') && !cleaned.toLowerCase().includes('linkedin')) {
      data.fullName = cleaned;
    }
  }

  // Fallback name from H1
  let nameH1 = null;
  for (const h of document.querySelectorAll('main h1, h1')) {
    if (h.closest('nav') || h.closest('header') || h.classList.contains('visually-hidden')) continue;
    const t = (h.innerText || h.textContent || '').split('\n')[0].trim();
    if (t && t.length > 1 && !t.toLowerCase().includes('feed') && !t.toLowerCase().includes('linkedin')) {
      if (!data.fullName) data.fullName = t;
      nameH1 = h;
      break;
    }
  }

  // 2. OpenGraph Profile Picture
  if (!data.profilePic) {
    const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
    if (ogImage && !ogImage.includes('static.licdn.com/aero-v1/sc/h/')) {
      data.profilePic = ogImage;
    }
  }

  // 3. Locate Top Profile Card
  let topCard = null;
  if (nameH1) {
    topCard = nameH1.closest('section.artdeco-card') ||
              nameH1.closest('section') ||
              nameH1.closest('.artdeco-card') ||
              nameH1.closest('[data-view-name="profile-card"]') ||
              nameH1.closest('.scaffold-layout__main') ||
              nameH1.parentElement?.parentElement?.parentElement?.parentElement ||
              nameH1.parentElement?.parentElement?.parentElement;
  }
  if (!topCard) topCard = document.querySelector('main section') || document.querySelector('main');

  // 4. Job Title (Headline)
  if (!data.jobTitle) {
    const headlineSelectors = [
      '.text-body-medium.break-words',
      '.pv-text-details__left-panel div.text-body-medium',
      'div.text-body-medium.break-words',
      '[data-generated-suggestion-target]',
      '.ph5 .text-body-medium',
      'div.text-body-medium',
      '.pv-text-details__left-panel .text-body-medium',
      '[data-view-name="profile-card"] .text-body-medium'
    ];
    for (const sel of headlineSelectors) {
      const el = topCard ? topCard.querySelector(sel) : document.querySelector(sel);
      if (el) {
        const t = (el.innerText || el.textContent || '').trim();
        if (t && t !== data.fullName && !isDegreeOrNoise(t) && t.length > 2 && !t.includes('connections')) {
          data.jobTitle = t.split('\n')[0].trim();
          break;
        }
      }
    }
  }

  // Strategy B: Sibling container walk from H1
  if (!data.jobTitle && nameH1) {
    let container = nameH1.parentElement;
    if (container && container.tagName === 'A') container = container.parentElement;
    let nextEl = container ? container.nextElementSibling : nameH1.nextElementSibling;
    while (nextEl) {
      const t = (nextEl.innerText || nextEl.textContent || '').trim();
      if (t && t !== data.fullName && !isDegreeOrNoise(t) && t.length > 2 && !t.includes('connections')) {
        data.jobTitle = t.split('\n')[0].trim();
        break;
      }
      nextEl = nextEl.nextElementSibling;
    }
  }

  // Strategy C: Left panel direct children
  if (!data.jobTitle && topCard) {
    const leftPanel = topCard.querySelector('.pv-text-details__left-panel, div.ph5');
    if (leftPanel) {
      for (const child of leftPanel.children) {
        if (child.contains(nameH1)) continue;
        const t = (child.innerText || child.textContent || '').trim();
        if (t && t !== data.fullName && !isDegreeOrNoise(t) && t.length > 2 && !t.includes('connections') && !looksLikeLocation(t)) {
          data.jobTitle = t.split('\n')[0].trim();
          break;
        }
      }
    }
  }

  // 5. Current Company
  // Strategy A: Direct company link in top card or main (<a href*="/company/">)
  if (!data.company) {
    const compLinks = (topCard || document).querySelectorAll('a[href*="/company/"]');
    for (const a of compLinks) {
      if (a.closest('nav') || a.closest('header') || a.closest('#footer')) continue;
      const raw = (a.innerText || a.textContent || '').trim().replace(/^Current company:\s*/i, '').split('\n')[0].trim();
      const lo = raw.toLowerCase();
      if (raw && raw.length > 1 && !isDegreeOrNoise(raw) &&
          !lo.includes('employee') && !lo.includes('school') && !lo.includes('university') &&
          !lo.includes('college') && !lo.includes('follow') && !lo.includes('connection')) {
        data.company = raw;
        break;
      }
    }
  }

  // Strategy B: Aria label with "Current company"
  if (!data.company) {
    const ariaEls = (topCard || document).querySelectorAll('[aria-label*="Current company" i]');
    for (const el of ariaEls) {
      const aria = el.getAttribute('aria-label') || '';
      const match = aria.match(/Current company:\s*([^.]+)/i);
      if (match && match[1]) {
        const cand = match[1].trim();
        if (!isDegreeOrNoise(cand)) {
          data.company = cand;
          break;
        }
      }
      const raw = (el.innerText || el.textContent || '').trim().replace(/^Current company:\s*/i, '').split('\n')[0].trim();
      if (raw && raw.length > 1 && !isDegreeOrNoise(raw)) {
        data.company = raw;
        break;
      }
    }
  }

  // Strategy C: Right panel items or experience lists in top card
  if (!data.company) {
    const rightPanelItems = document.querySelectorAll('.pv-text-details__right-panel li, .pv-top-card--experience-list li, ul.pv-text-details__right-panel li');
    for (const li of rightPanelItems) {
      const raw = (li.innerText || li.textContent || '').trim().replace(/^Current company:\s*/i, '').split('\n')[0].trim();
      const lo = raw.toLowerCase();
      if (raw && raw.length > 1 && !isDegreeOrNoise(raw) &&
          !lo.includes('university') && !lo.includes('college') && !lo.includes('school') &&
          !lo.includes('institute') && !lo.includes('academy') && !lo.includes('education') &&
          !lo.includes('degree') && !lo.includes('student')) {
        data.company = raw;
        break;
      }
    }
  }

  // Strategy D: Look at elements stacked right below headline in Top Card (Modern LinkedIn Layout)
  if (!data.company && topCard) {
    for (const el of topCard.querySelectorAll('button, a, div.inline-show-more-text, span')) {
      if (el.children.length > 2) continue;
      const t = (el.innerText || el.textContent || '').trim().split('\n')[0].trim();
      if (t && t !== data.fullName && t !== data.jobTitle && !isDegreeOrNoise(t) && !looksLikeLocation(t) &&
          !t.toLowerCase().includes('contact info') && !t.toLowerCase().includes('connection') &&
          !t.toLowerCase().includes('follower') && !t.toLowerCase().includes('mutual') &&
          t.length > 1 && t.length < 70) {
        const parentHref = el.closest('a')?.href || '';
        const parentAria = el.closest('[aria-label]')?.getAttribute('aria-label') || '';
        if (parentHref.includes('/company/') || parentAria.toLowerCase().includes('company')) {
          data.company = t;
          break;
        }
      }
    }
  }

  // Strategy E: Experience Section (#experience)
  if (!data.company) {
    const expSec = document.querySelector('section#experience, #experience-section, div#experience');
    const searchArea = expSec ? (expSec.closest('section') || expSec) : null;
    if (searchArea) {
      const compLink = searchArea.querySelector('a[href*="/company/"]');
      if (compLink) {
        const raw = (compLink.innerText || compLink.textContent || '').trim().split('\n')[0].trim();
        if (raw && !isDegreeOrNoise(raw)) data.company = raw;
      }
      if (!data.company) {
        const firstItem = searchArea.querySelector('li');
        if (firstItem) {
          const lines = (firstItem.innerText || firstItem.textContent || '')
            .split('\n')
            .map(s => s.trim())
            .filter(s => s && !isDegreeOrNoise(s) && !/^\d{4}|\b(yr|mo|full-time|part-time|present)\b/i.test(s));
          if (lines.length >= 2) {
            if (!data.jobTitle) data.jobTitle = lines[0];
            data.company = lines[1].replace(/·.*$/, '').trim();
          } else if (lines.length === 1) {
            data.company = lines[0];
          }
        }
      }
    }
  }

  // Strategy F: Parse from Job Title ("Vice President at 89Bio" or "VP @ 89Bio")
  if (!data.company && data.jobTitle) {
    const atMatch = data.jobTitle.match(/(?:at|@)\s+([A-Za-z0-9&.''\s\-]+?)(?=\s*(?:[|•·\-]|\d+$|$))/i);
    if (atMatch && atMatch[1]) {
      const candidate = atMatch[1].trim();
      if (!isDegreeOrNoise(candidate) && candidate.length > 1) {
        data.company = candidate;
      }
    }
  }

  // Final sanity check on company: NEVER allow degree indicators
  if (data.company && isDegreeOrNoise(data.company)) {
    data.company = '';
  }

  // 6. Location
  if (!data.location) {
    for (const sel of [
      '.pv-text-details__left-panel span.text-body-small',
      'span.text-body-small.inline.t-black--light.break-words',
      '.text-body-small.t-black--light',
      '.ph5 span.text-body-small',
      'span.text-body-small[dir]',
      '[data-field="location"]',
      '.pv-text-details__left-panel .text-body-small'
    ]) {
      const el = (topCard ? topCard.querySelector(sel) : null) || document.querySelector(sel);
      if (el) {
        const t = (el.innerText || el.textContent || '').trim().replace(/·.*$/, '').trim();
        if (t && looksLikeLocation(t) && !t.toLowerCase().includes('connection') && !t.toLowerCase().includes('follower') && !t.toLowerCase().includes('contact info')) {
          data.location = t;
          break;
        }
      }
    }
  }

  if (!data.location) {
    const searchArea = topCard || document.querySelector('main') || document;
    for (const el of searchArea.querySelectorAll('span, div')) {
      if (el.children.length > 1) continue;
      const t = (el.innerText || el.textContent || '').trim().replace(/·.*$/, '').trim();
      if (t && t !== data.fullName && t !== data.jobTitle && t !== data.company && looksLikeLocation(t)) {
        data.location = t;
        break;
      }
    }
  }

  // 7. Custom External Website / Domain
  for (const link of (topCard || document).querySelectorAll('a[href]')) {
    const text = (link.innerText || link.textContent || '').toLowerCase();
    const aria = (link.getAttribute('aria-label') || '').toLowerCase();
    const href = link.href || '';
    const isWebsite =
      text.includes('website') || text.includes('portfolio') || text.includes('visit') ||
      aria.includes('website') || aria.includes('custom') ||
      link.getAttribute('data-control-name')?.includes('website') ||
      (link.classList.contains('link-without-visited-state') && !href.includes('linkedin.com'));
    if (isWebsite && href) {
      const resolved = decodeRedirectUrl(href);
      if (resolved) {
        data.domain = resolved;
        break;
      }
    }
  }

  // 8. Profile Picture fallback
  if (!data.profilePic && topCard) {
    for (const sel of [
      'img.pv-top-card-profile-picture__image', 'img[title*="photo" i]',
      'button.pv-top-card-profile-picture img', 'img.EntityPhoto-circle-9',
      'img[width="200"][height="200"]'
    ]) {
      const img = topCard.querySelector(sel);
      if (img && img.src && !img.src.includes('data:image') &&
          !img.src.includes('static.licdn.com/aero-v1/sc/h/')) {
        data.profilePic = img.src; break;
      }
    }
  }

  return data;
}

function decodeRedirectUrl(href) {
  try {
    let rawTarget = '';
    if (href.includes('redir/redirect') || href.includes('safety/go') || href.includes('url=')) {
      const parsed = new URL(href);
      rawTarget = parsed.searchParams.get('url') || '';
    } else if (!href.includes('linkedin.com')) {
      rawTarget = href;
    }
    if (rawTarget) {
      const decoded = decodeURIComponent(rawTarget);
      const urlObj = new URL(decoded.startsWith('http') ? decoded : `https://${decoded}`);
      const domain = urlObj.hostname.replace(/^www\./, '').toLowerCase();
      if (domain && domain.includes('.') && !domain.includes('linkedin.com')) return domain;
    }
  } catch (e) {}
  return '';
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXTRACT_PROFILE_DATA') {
    extractLinkedInProfile().then(profile => {
      sendResponse({ success: true, data: profile });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});
