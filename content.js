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

  // 1. Full Name: document.title is clean and fast
  if (document.title) {
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
  const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
  if (ogImage && !ogImage.includes('static.licdn.com/aero-v1/sc/h/')) {
    data.profilePic = ogImage;
  }

  // 3. Locate Top Profile Card
  let topCard = null;
  if (nameH1) {
    topCard = nameH1.closest('section.artdeco-card') ||
              nameH1.closest('section') ||
              nameH1.closest('.artdeco-card') ||
              nameH1.closest('[data-view-name="profile-card"]') ||
              nameH1.parentElement?.parentElement?.parentElement?.parentElement ||
              nameH1.parentElement?.parentElement?.parentElement;
  }
  if (!topCard) topCard = document.querySelector('main section') || document.querySelector('main');

  // 4. Job Title (Headline):
  // Strategy A: Targeted CSS classes
  const headlineSelectors = [
    '.text-body-medium.break-words',
    '.pv-text-details__left-panel div.text-body-medium',
    'div.text-body-medium.break-words',
    '[data-generated-suggestion-target]',
    '.ph5 .text-body-medium',
    'div.text-body-medium'
  ];
  for (const sel of headlineSelectors) {
    const el = topCard ? topCard.querySelector(sel) : document.querySelector(sel);
    if (el) {
      const t = (el.innerText || el.textContent || '').trim();
      if (t && t !== data.fullName && !isDegreeOrNoise(t) && t.length > 5 && !t.includes('connections')) {
        data.jobTitle = t.split('\n')[0].trim();
        break;
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
      if (t && t !== data.fullName && !isDegreeOrNoise(t) && t.length > 5 && !t.includes('connections')) {
        data.jobTitle = t.split('\n')[0].trim();
        break;
      }
      nextEl = nextEl.nextElementSibling;
    }
  }

  // Strategy C: Left panel direct children
  if (!data.jobTitle && topCard) {
    const leftPanel = topCard.querySelector('.pv-text-details__left-panel');
    if (leftPanel) {
      const children = Array.from(leftPanel.children);
      for (const child of children) {
        if (child.contains(nameH1)) continue;
        const t = (child.innerText || child.textContent || '').trim();
        if (t && t !== data.fullName && !isDegreeOrNoise(t) && t.length > 8 && !t.includes('connections')) {
          data.jobTitle = t.split('\n')[0].trim();
          break;
        }
      }
    }
  }

  // 5. Current Company:
  // Strategy A: From Right Panel (Top card right side list)
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

  // Strategy B: Right panel buttons / links
  if (!data.company && topCard) {
    for (const sel of [
      '.pv-text-details__right-panel a',
      '.pv-text-details__right-panel button',
      'button[aria-label*="Current company"]',
      'a[aria-label*="Current company"]'
    ]) {
      const el = topCard.querySelector(sel);
      if (el) {
        const raw = (el.innerText || el.textContent || '').trim().replace(/^Current company:\s*/i, '').split('\n')[0].trim();
        const lo = raw.toLowerCase();
        if (raw && raw.length > 1 && !isDegreeOrNoise(raw) &&
            !lo.includes('university') && !lo.includes('college') && !lo.includes('school') &&
            !lo.includes('institute') && !lo.includes('academy')) {
          data.company = raw;
          break;
        }
      }
    }
  }

  // Strategy C: Parse "@ Company" or "at Company" or "Founder @ Company" from headline
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

  // 6. Location:
  function looksLikeLocation(text) {
    const t = text.trim();
    if (isDegreeOrNoise(t)) return false;
    const companySuffixes = /\b(productions?|studios?|inc\.?|llc\.?|ltd\.?|corp\.?|group|agency|media|digital|brand|labs?|works?|design|creative|consulting)\b/i;
    const hasComma = t.includes(',');
    const geoWords = /\b(area|region|city|metro|greater|united|emirates|kingdom|states|pakistan|india|uk|usa|uae|canada|australia|europe|asia|africa|remote|worldwide|global|dubai|karachi|lahore|islamabad|london|new york|san francisco)\b/i;
    if (!hasComma && companySuffixes.test(t) && !geoWords.test(t)) return false;
    return t.length > 2 && t.length < 100;
  }

  const locationSelectors = [
    '.pv-text-details__left-panel span.text-body-small',
    'span.text-body-small.inline.t-black--light.break-words',
    '.text-body-small.t-black--light',
    '.ph5 span.text-body-small',
    'span.text-body-small[dir]',
    '[data-field="location"]'
  ];
  for (const sel of locationSelectors) {
    const el = topCard ? topCard.querySelector(sel) : null;
    const elDoc = el || document.querySelector(sel);
    if (elDoc) {
      const t = (elDoc.innerText || elDoc.textContent || '').trim().replace(/·.*$/, '').trim();
      if (t && looksLikeLocation(t) && !t.toLowerCase().includes('connection') && !t.toLowerCase().includes('follower') && !t.toLowerCase().includes('contact info')) {
        data.location = t;
        break;
      }
    }
  }

  if (!data.location) {
    const searchArea = topCard || document;
    for (const el of searchArea.querySelectorAll('span, div')) {
      if (el.children.length > 3) continue;
      const text = (el.innerText || el.textContent || '').trim();
      if (text && text.includes('Contact info')) {
        const prev = el.previousElementSibling;
        if (prev) {
          const pt = (prev.innerText || prev.textContent || '').trim().replace(/·.*$/, '').trim();
          if (pt && looksLikeLocation(pt)) {
            data.location = pt;
            break;
          }
        }
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
