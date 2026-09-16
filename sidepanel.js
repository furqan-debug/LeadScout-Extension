import { resolveDomain } from './lib/domainResolver.js';
import { generateEmailPatterns } from './lib/emailGenerator.js';
import { verifyDomainMX } from './lib/verifier.js';
import { enrichWithApollo, enrichWithHunter } from './lib/enricher.js';
import { getSavedLeads, saveLead, deleteLead, clearAllLeads, exportLeadsToCsv } from './lib/storage.js';

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23ccc'/%3E%3Cpath d='M4 20c0-4 4-6 8-6s8 2 8 6' fill='%23ccc'/%3E%3C/svg%3E";

const ICONS = {
  scan: `<svg class="btn-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  rescan: `<svg class="btn-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`,
  search: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  copied: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  save: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`,
  saved: `<svg width="13" height="13" viewBox="0 0 24 24" fill="#4f46e5" stroke="#4f46e5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`,
  phone: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
  trash: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
  bolt: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`
};

// State
let currentProspect = {
  fullName: '',
  jobTitle: '',
  company: '',
  domain: '',
  directEmail: '',
  emailStatus: '',
  phoneNumbers: [],
  location: '',
  profilePic: '',
  linkedinUrl: '',
  mxStatus: null,
  isEnriched: false
};

let config = {
  verifierUrl: 'https://leadscout-extension.onrender.com',
  usePrivateVerifier: true,
  prospeoApiKey: '',
  apolloApiKey: '',
  hunterApiKey: ''
};

// DOM Elements
const tabProspect = document.getElementById('tab-prospect');
const tabSaved = document.getElementById('tab-saved');
const tabSettings = document.getElementById('tab-settings');
const viewProspect = document.getElementById('view-prospect');
const viewSaved = document.getElementById('view-saved');
const viewSettings = document.getElementById('view-settings');
const savedCount = document.getElementById('saved-count');

const bannerApiHint = document.getElementById('banner-api-hint');
const linkSetupApi = document.getElementById('link-setup-api');

const btnScan = document.getElementById('btn-scan');
const scanHint = document.getElementById('scan-hint');
const prospectCard = document.getElementById('prospect-card');
const prospectAvatar = document.getElementById('prospect-avatar');
const prospectName = document.getElementById('prospect-name');
const prospectHeadline = document.getElementById('prospect-headline');
const prospectLocation = document.getElementById('prospect-location');
const inputCompany = document.getElementById('input-company');
const inputDomain = document.getElementById('input-domain');
const btnResolveDomain = document.getElementById('btn-resolve-domain');

const prospectPhoneCard = document.getElementById('prospect-phone-card');
const prospectPhoneList = document.getElementById('prospect-phone-list');

const mxStatusBox = document.getElementById('mx-status-box');
const mxStatusIcon = document.getElementById('mx-status-icon');
const mxStatusText = document.getElementById('mx-status-text');

const btnGenerateEmails = document.getElementById('btn-generate-emails');
const emailResultsCard = document.getElementById('email-results-card');
const emailResultsTitle = document.getElementById('email-results-title');
const emailResultsSubtext = document.getElementById('email-results-subtext');
const emailCandidatesList = document.getElementById('email-candidates-list');

const savedLeadsList = document.getElementById('saved-leads-list');
const btnExportCsv = document.getElementById('btn-export-csv');
const btnClearAll = document.getElementById('btn-clear-all');

const inputVerifierUrl = document.getElementById('input-verifier-url');
const chkUsePrivateVerifier = document.getElementById('chk-use-private-verifier');
const btnTestVerifier = document.getElementById('btn-test-verifier');
const verifierTestResult = document.getElementById('verifier-test-result');

const inputProspeoKey = document.getElementById('input-prospeo-key');
const btnTestProspeo = document.getElementById('btn-test-prospeo');
const prospeoTestResult = document.getElementById('prospeo-test-result');

const inputApolloKey = document.getElementById('input-apollo-key');
const btnTestApollo = document.getElementById('btn-test-apollo');
const apolloTestResult = document.getElementById('apollo-test-result');
const inputHunterKey = document.getElementById('input-hunter-key');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingsSaveMsg = document.getElementById('settings-save-msg');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  updateSavedCount();
  setupEventListeners();
  autoScanIfLinkedIn();
});

async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      'verifier_url',
      'use_private_verifier',
      'prospeo_api_key',
      'apollo_api_key',
      'hunter_api_key'
    ], (res) => {
      config.verifierUrl = res.verifier_url || 'https://leadscout-extension.onrender.com';
      config.usePrivateVerifier = res.use_private_verifier !== false;
      config.prospeoApiKey = res.prospeo_api_key || '';
      config.apolloApiKey = res.apollo_api_key || '';
      config.hunterApiKey = res.hunter_api_key || '';

      if (inputVerifierUrl) inputVerifierUrl.value = config.verifierUrl;
      if (chkUsePrivateVerifier) chkUsePrivateVerifier.checked = config.usePrivateVerifier;
      if (inputProspeoKey) inputProspeoKey.value = config.prospeoApiKey;
      if (inputApolloKey) inputApolloKey.value = config.apolloApiKey;
      if (inputHunterKey) inputHunterKey.value = config.hunterApiKey;

      updateApiBanner();
      resolve();
    });
  });
}

function updateApiBanner() {
  if (config.usePrivateVerifier) {
    bannerApiHint.className = 'engine-strip';
    bannerApiHint.innerHTML = '<span style="color:var(--success);font-size:10px;">●</span><span><strong>Private SMTP Engine Active</strong> (Self-Hosted / $0 Cost)</span>';
  } else if (config.prospeoApiKey) {
    bannerApiHint.className = 'engine-strip';
    bannerApiHint.innerHTML = '<span style="color:var(--success);font-size:10px;">●</span><span><strong>Prospeo Active</strong> (75 free verified lookups enabled)</span>';
  } else if (config.apolloApiKey) {
    bannerApiHint.className = 'engine-strip';
    bannerApiHint.innerHTML = '<span style="color:var(--success);font-size:10px;">●</span><span><strong>Apollo Active</strong></span>';
  } else {
    bannerApiHint.className = 'engine-strip';
    bannerApiHint.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg><span>Add <a id="link-setup-api" href="#">API key</a> for cloud enrichment fallback.</span>';
    const link = document.getElementById('link-setup-api');
    if (link) link.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('settings');
    });
  }
}

function setupEventListeners() {
  tabProspect.addEventListener('click', () => switchTab('prospect'));
  tabSaved.addEventListener('click', () => {
    switchTab('saved');
    renderSavedLeads();
  });
  tabSettings.addEventListener('click', () => switchTab('settings'));

  btnScan.addEventListener('click', () => handleFullAutoPipeline());

  btnResolveDomain.addEventListener('click', async () => {
    await handleResolveDomain();
    if (currentProspect.domain) {
      await handleGenerateAndVerify();
    }
  });

  btnGenerateEmails.addEventListener('click', handleGenerateAndVerify);

  inputDomain.addEventListener('change', async (e) => {
    const val = e.target.value.trim();
    if (val && val !== currentProspect.domain) {
      currentProspect.domain = val;
      await checkDomainMX(val);
      await handleGenerateAndVerify();
    }
  });

  inputCompany.addEventListener('change', async (e) => {
    const val = e.target.value.trim();
    if (val && val !== currentProspect.company) {
      currentProspect.company = val;
      await handleResolveDomain();
      if (currentProspect.domain) {
        await handleGenerateAndVerify();
      }
    }
  });

  btnExportCsv.addEventListener('click', async () => {
    const leads = await getSavedLeads();
    exportLeadsToCsv(leads);
  });

  btnClearAll.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all saved leads?')) {
      await clearAllLeads();
      renderSavedLeads();
      updateSavedCount();
    }
  });

  // Test Prospeo API button in Settings
  if (btnTestProspeo) {
    btnTestProspeo.addEventListener('click', async () => {
      const key = inputProspeoKey.value.trim();
      if (!key) {
        alert('Please enter a Prospeo API key first.');
        return;
      }
      btnTestProspeo.innerText = 'Testing...';
      btnTestProspeo.disabled = true;

      chrome.runtime.sendMessage({
        type: 'TEST_PROSPEO',
        payload: { apiKey: key }
      }, (res) => {
        btnTestProspeo.innerText = '🔌 Test Prospeo';
        btnTestProspeo.disabled = false;
        prospeoTestResult.classList.remove('hidden');

        if (res && res.success) {
          prospeoTestResult.style.color = '#15803d';
          prospeoTestResult.innerText = res.message || '✓ Prospeo Connected Successfully!';
        } else {
          prospeoTestResult.style.color = '#dc2626';
          prospeoTestResult.innerText = res?.error || '❌ Connection failed. Check your API key.';
        }
      });
    });
  }

  // Test Apollo API button in Settings
  if (btnTestApollo) {
    btnTestApollo.addEventListener('click', async () => {
      const key = inputApolloKey.value.trim();
      if (!key) {
        alert('Please enter an Apollo API key first.');
        return;
      }
      btnTestApollo.innerText = 'Testing...';
      btnTestApollo.disabled = true;

      chrome.runtime.sendMessage({
        type: 'TEST_APOLLO',
        payload: { apiKey: key }
      }, (res) => {
        btnTestApollo.innerText = '🔌 Test Connection';
        btnTestApollo.disabled = false;
        apolloTestResult.classList.remove('hidden');

        if (res && res.success) {
          apolloTestResult.style.color = '#15803d';
          apolloTestResult.innerText = res.message || '✓ Apollo API Connected Successfully!';
        } else {
          apolloTestResult.style.color = '#dc2626';
          apolloTestResult.innerText = res?.error || '❌ Connection failed. Check your API key.';
        }
      });
    });
  }

  // Test Private Verifier Health button in Settings
  if (btnTestVerifier) {
    btnTestVerifier.addEventListener('click', async () => {
      const verifierEndpoint = (inputVerifierUrl ? inputVerifierUrl.value.trim() : '') || 'https://leadscout-extension.onrender.com';
      btnTestVerifier.innerText = 'Checking...';
      btnTestVerifier.disabled = true;
      verifierTestResult.classList.remove('hidden');

      try {
        const res = await fetch(`${verifierEndpoint}/health`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          verifierTestResult.style.color = '#15803d';
          const modeStr = data.port25Open ? 'Direct Port 25 SMTP' : 'Fast Cloud DNS-MX Mode';
          verifierTestResult.innerText = `✓ Connected! ${data.service} v${data.version} (${modeStr})`;
        } else {
          verifierTestResult.style.color = '#dc2626';
          verifierTestResult.innerText = `❌ Server returned HTTP ${res.status}`;
        }
      } catch (err) {
        verifierTestResult.style.color = '#dc2626';
        verifierTestResult.innerText = `❌ Cannot connect to ${verifierEndpoint}. Make sure the verifier server is running (npm start in server/ folder).`;
      } finally {
        btnTestVerifier.innerText = '🔌 Check Engine Health';
        btnTestVerifier.disabled = false;
      }
    });
  }

  btnSaveSettings.addEventListener('click', async () => {
    const verifierUrlVal = inputVerifierUrl ? inputVerifierUrl.value.trim() : 'https://leadscout-extension.onrender.com';
    const useVerifierVal = chkUsePrivateVerifier ? chkUsePrivateVerifier.checked : true;
    const prospeoVal = inputProspeoKey ? inputProspeoKey.value.trim() : '';
    const apolloVal = inputApolloKey ? inputApolloKey.value.trim() : '';
    const hunterVal = inputHunterKey ? inputHunterKey.value.trim() : '';

    chrome.storage.local.set({
      verifier_url: verifierUrlVal,
      use_private_verifier: useVerifierVal,
      prospeo_api_key: prospeoVal,
      apollo_api_key: apolloVal,
      hunter_api_key: hunterVal
    }, () => {
      config.verifierUrl = verifierUrlVal;
      config.usePrivateVerifier = useVerifierVal;
      config.prospeoApiKey = prospeoVal;
      config.apolloApiKey = apolloVal;
      config.hunterApiKey = hunterVal;
      updateApiBanner();

      settingsSaveMsg.classList.remove('hidden');
      setTimeout(() => settingsSaveMsg.classList.add('hidden'), 3000);
    });
  });

  prospectName.addEventListener('blur', () => {
    currentProspect.fullName = prospectName.innerText.trim();
  });
  prospectHeadline.addEventListener('blur', () => {
    currentProspect.jobTitle = prospectHeadline.innerText.trim();
  });
}

function switchTab(tab) {
  tabProspect.classList.remove('active');
  tabSaved.classList.remove('active');
  tabSettings.classList.remove('active');

  viewProspect.classList.add('hidden');
  viewSaved.classList.add('hidden');
  viewSettings.classList.add('hidden');

  if (tab === 'prospect') {
    tabProspect.classList.add('active');
    viewProspect.classList.remove('hidden');
  } else if (tab === 'saved') {
    tabSaved.classList.add('active');
    viewSaved.classList.remove('hidden');
  } else if (tab === 'settings') {
    tabSettings.classList.add('active');
    viewSettings.classList.remove('hidden');
  }
}

/**
 * Inline extraction (injected into LinkedIn tab via chrome.scripting.executeScript)
 * Must be a plain synchronous function (no imports). Mirrors content.js logic.
 */
function extractLinkedInProfileFromPage() {
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
  // In LinkedIn DOM, H1 is inside a div. The next sibling div contains the headline.
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
  // This is where "Hamza Bhatti Productions", "Voices Unbound", etc. appear!
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
      try {
        let rawTarget = '';
        if (href.includes('redir/redirect') || href.includes('safety/go') || href.includes('url=')) {
          rawTarget = new URL(href).searchParams.get('url') || '';
        } else if (!href.includes('linkedin.com')) {
          rawTarget = href;
        }
        if (rawTarget) {
          const decoded = decodeURIComponent(rawTarget);
          const urlObj = new URL(decoded.startsWith('http') ? decoded : `https://${decoded}`);
          const domain = urlObj.hostname.replace(/^www\./, '').toLowerCase();
          if (domain && domain.includes('.') && !domain.includes('linkedin.com')) {
            data.domain = domain; break;
          }
        }
      } catch (e) {}
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

  console.log('[LeadScout] Extracted Profile Data:', JSON.stringify(data));
  return data;
}

async function autoScanIfLinkedIn() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const activeTab = tabs && tabs[0];
  if (activeTab && activeTab.url && activeTab.url.includes('linkedin.com/in/')) {
    handleFullAutoPipeline();
  }
}

async function handleFullAutoPipeline() {
  btnScan.disabled = true;
  btnScan.innerHTML = '<span class="btn-icon">⏳</span><span>Prospecting Lead...</span>';
  scanHint.innerText = 'Extracting profile details from active tab...';

  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    let activeTab = tabs && tabs[0];

    if (!activeTab || !activeTab.url || !activeTab.url.includes('linkedin.com/in/')) {
      const allActive = await chrome.tabs.query({ active: true });
      activeTab = allActive.find(t => t.url && t.url.includes('linkedin.com/in/'));
    }

    if (!activeTab || !activeTab.url || !activeTab.url.includes('linkedin.com/in/')) {
      btnScan.disabled = false;
      btnScan.innerHTML = `${ICONS.scan}<span>Scan Active Profile</span>`;
      scanHint.innerText = 'Navigate to a LinkedIn profile tab.';
      return;
    }

    let data = null;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: extractLinkedInProfileFromPage
      });
      if (results && results[0] && results[0].result) {
        data = results[0].result;
      }
    } catch (scriptErr) {
      console.warn('[LeadScout] Direct execution fallback:', scriptErr);
    }

    if (!data || !data.fullName) {
      data = await new Promise((resolve) => {
        chrome.tabs.sendMessage(activeTab.id, { type: 'EXTRACT_PROFILE_DATA' }, (res) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(res?.success && res.data ? res.data : null);
        });
      });
    }

    if (!data) {
      btnScan.disabled = false;
      btnScan.innerHTML = `${ICONS.rescan}<span>Re-Scan Profile</span>`;
      scanHint.innerText = 'Could not read profile data. Try refreshing the LinkedIn tab.';
      return;
    }

    // Discard any degree noise that might have leaked into company
    let safeCompany = (data.company || '').trim();
    if (/^[·•\s]*\d+(st|nd|rd|th)/i.test(safeCompany) || safeCompany.startsWith('·')) {
      safeCompany = '';
    }

    // Reset prospect state completely
    currentProspect = {
      fullName: data.fullName || 'Unknown Name',
      jobTitle: data.jobTitle || 'No Title Listed',
      company: safeCompany,
      domain: data.domain || '',
      directEmail: data.directEmail || '',
      emailStatus: '',
      phoneNumbers: [],
      location: data.location || 'Location Not Specified',
      profilePic: data.profilePic || '',
      linkedinUrl: activeTab.url.split('?')[0].split('#')[0],
      mxStatus: null,
      isEnriched: false
    };

    // Populate UI Card
    prospectName.innerText = currentProspect.fullName;
    prospectHeadline.innerText = currentProspect.jobTitle;
    prospectLocation.innerText = currentProspect.location;
    inputCompany.value = currentProspect.company;
    inputDomain.value = currentProspect.domain;
    prospectAvatar.src = currentProspect.profilePic || DEFAULT_AVATAR;

    // Reset phone box
    prospectPhoneCard.classList.add('hidden');
    prospectPhoneList.innerHTML = '';
    prospectCard.classList.remove('hidden');

    let lastEnrichError = '';

    // STEP 1: Always resolve company domain first
    if (!currentProspect.domain && currentProspect.company) {
      scanHint.innerText = `Finding company domain for ${currentProspect.company}...`;
      await handleResolveDomain();
    } else if (currentProspect.domain) {
      await checkDomainMX(currentProspect.domain);
    }

    // STEP 2: If Private SMTP Engine is prioritized (DEFAULT), verify directly via our engine ($0 / Self-Hosted)
    if (config.usePrivateVerifier && config.verifierUrl && (currentProspect.domain || currentProspect.company)) {
      scanHint.innerText = '⚡ Probing mail server via Private Engine ($0 Cost)...';
      await handleGenerateAndVerify();
    }

    // STEP 3: Fallback to Prospeo ONLY if Private Engine did not verify a direct email
    if (!currentProspect.directEmail && config.prospeoApiKey) {
      scanHint.innerText = '⚡ Checking Prospeo fallback database...';
      const prospeoRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'ENRICH_PROSPEO',
          payload: {
            apiKey: config.prospeoApiKey,
            linkedinUrl: currentProspect.linkedinUrl
          }
        }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ found: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { found: false, error: 'Empty response' });
          }
        });
      });

      if (prospeoRes && prospeoRes.found) {
        currentProspect.isEnriched = true;
        if (prospeoRes.email) {
          currentProspect.directEmail = prospeoRes.email;
          currentProspect.emailStatus = prospeoRes.emailStatus || 'Prospeo 98% Verified';
        }
        if (prospeoRes.company && !currentProspect.company) {
          currentProspect.company = prospeoRes.company;
          inputCompany.value = prospeoRes.company;
        }
        if (prospeoRes.domain && !currentProspect.domain) {
          currentProspect.domain = prospeoRes.domain;
          inputDomain.value = prospeoRes.domain;
        }
        if (prospeoRes.fullName && (!currentProspect.fullName || currentProspect.fullName === 'Unknown Name')) {
          currentProspect.fullName = prospeoRes.fullName;
          prospectName.innerText = prospeoRes.fullName;
        }
        if (prospeoRes.jobTitle && (!currentProspect.jobTitle || currentProspect.jobTitle === 'No Title Listed')) {
          currentProspect.jobTitle = prospeoRes.jobTitle;
          prospectHeadline.innerText = prospeoRes.jobTitle;
        }

        scanHint.innerText = `✓ Matched in Prospeo: ${prospeoRes.email}`;
      } else if (prospeoRes) {
        if (prospeoRes.company && !currentProspect.company) {
          currentProspect.company = prospeoRes.company;
          inputCompany.value = prospeoRes.company;
        }
        if (prospeoRes.domain && !currentProspect.domain) {
          currentProspect.domain = prospeoRes.domain;
          inputDomain.value = prospeoRes.domain;
        }
        if (prospeoRes.error) {
          lastEnrichError = prospeoRes.error;
          scanHint.innerText = `Prospeo: ${prospeoRes.error}`;
        }
      }
    }

    // STEP 4: Fallback to Apollo (only if still no direct email)
    if (!currentProspect.directEmail && config.apolloApiKey) {
      scanHint.innerText = '⚡ Checking Apollo fallback database...';
      const apolloRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'ENRICH_APOLLO',
          payload: {
            apiKey: config.apolloApiKey,
            linkedinUrl: currentProspect.linkedinUrl,
            fullName: currentProspect.fullName,
            company: currentProspect.company,
            domain: currentProspect.domain
          }
        }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ found: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res || { found: false, error: 'Empty response' });
          }
        });
      });

      if (apolloRes && apolloRes.found) {
        currentProspect.isEnriched = true;
        if (apolloRes.email) {
          currentProspect.directEmail = apolloRes.email;
          currentProspect.emailStatus = apolloRes.emailStatus || 'Apollo Verified';
        }
        if (apolloRes.company && !currentProspect.company) {
          currentProspect.company = apolloRes.company;
          inputCompany.value = apolloRes.company;
        }
        if (apolloRes.domain && !currentProspect.domain) {
          currentProspect.domain = apolloRes.domain;
          inputDomain.value = apolloRes.domain;
        }
        if (apolloRes.jobTitle && (!currentProspect.jobTitle || currentProspect.jobTitle === 'No Title Listed')) {
          currentProspect.jobTitle = apolloRes.jobTitle;
          prospectHeadline.innerText = apolloRes.jobTitle;
        }

        // Display Phones
        if (apolloRes.phoneNumbers && apolloRes.phoneNumbers.length > 0) {
          currentProspect.phoneNumbers = apolloRes.phoneNumbers;
          renderPhoneNumbers(apolloRes.phoneNumbers);
        }

        scanHint.innerText = `✓ Matched in Apollo: ${apolloRes.company || 'Verified'}`;
      } else if (apolloRes && apolloRes.error) {
        lastEnrichError = apolloRes.error;
        scanHint.innerText = `Apollo: ${apolloRes.error}`;
      }
    }

    // STEP 5: Fallback to Hunter (only if still no direct email)
    if (!currentProspect.directEmail && config.hunterApiKey && (currentProspect.domain || currentProspect.company)) {
      scanHint.innerText = 'Querying Hunter.io fallback...';
      const hunterRes = await enrichWithHunter(config.hunterApiKey, {
        domain: currentProspect.domain,
        fullName: currentProspect.fullName,
        company: currentProspect.company
      });

      if (hunterRes && hunterRes.found && hunterRes.email) {
        currentProspect.directEmail = hunterRes.email;
        currentProspect.emailStatus = hunterRes.emailStatus;
        if (hunterRes.domain && !currentProspect.domain) {
          currentProspect.domain = hunterRes.domain;
          inputDomain.value = hunterRes.domain;
        }
      }
    }

    // STEP 6: Final render of verified email and candidate pattern pills
    if (currentProspect.domain || currentProspect.directEmail) {
      await handleGenerateAndVerify();
      if (currentProspect.isEnriched) {
        scanHint.innerText = currentProspect.directEmail.includes('@')
          ? `✓ Verified: ${currentProspect.directEmail}`
          : 'Profile scanned · Verified match found';
      } else if (lastEnrichError) {
        scanHint.innerText = `${lastEnrichError}`;
      } else {
        scanHint.innerText = 'Profile scanned successfully';
      }
    } else {
      scanHint.innerText = 'Enter company domain to view email predictions';
    }

    btnScan.disabled = false;
    btnScan.innerHTML = `${ICONS.rescan}<span>Re-Scan Profile</span>`;

  } catch (err) {
    btnScan.disabled = false;
    btnScan.innerHTML = `${ICONS.scan}<span>Scan Active Profile</span>`;
    scanHint.innerText = `${err.message}`;
  }
}

function renderPhoneNumbers(phoneNumbers) {
  prospectPhoneList.innerHTML = '';
  phoneNumbers.forEach(p => {
    const item = document.createElement('div');
    item.className = 'phone-item';
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        ${ICONS.phone}
        <span>${p.number} <span style="font-size:10.5px;font-weight:400;opacity:0.8;">(${p.type})</span></span>
      </div>
      <button class="icon-btn btn-copy-phone" title="Copy phone">${ICONS.copy}</button>
    `;

    item.querySelector('.btn-copy-phone').addEventListener('click', async () => {
      await navigator.clipboard.writeText(p.number);
      const btn = item.querySelector('.btn-copy-phone');
      btn.innerHTML = ICONS.copied;
      setTimeout(() => { btn.innerHTML = ICONS.copy; }, 1500);
    });

    prospectPhoneList.appendChild(item);
  });

  prospectPhoneCard.classList.remove('hidden');
}

async function handleResolveDomain() {
  const company = inputCompany.value.trim() || currentProspect.company;
  if (!company) return;

  btnResolveDomain.innerText = 'Searching...';
  btnResolveDomain.disabled = true;

  try {
    const res = await resolveDomain(company, currentProspect.location);
    if (res.domain) {
      inputDomain.value = res.domain;
      currentProspect.domain = res.domain;
      if (res.mxStatus) {
        currentProspect.mxStatus = res.mxStatus;
        renderMxStatus(res.mxStatus);
      } else {
        await checkDomainMX(res.domain);
      }
    } else {
      inputDomain.placeholder = 'Type domain (e.g. company.com)';
    }
  } finally {
    btnResolveDomain.innerText = 'Auto-Find';
    btnResolveDomain.disabled = false;
  }
}

async function checkDomainMX(domain) {
  if (!domain) return;

  mxStatusBox.className = 'mx-status-row checking';
  mxStatusBox.classList.remove('hidden');
  mxStatusIcon.innerText = '●';
  mxStatusText.innerText = `Verifying mail servers for ${domain}...`;

  const mxRes = await verifyDomainMX(domain);
  currentProspect.mxStatus = mxRes;
  renderMxStatus(mxRes);
}

function renderMxStatus(mxRes) {
  if (!mxRes) return;
  if (mxRes.hasMx) {
    mxStatusBox.className = 'mx-status-row valid';
    mxStatusIcon.innerText = '●';
    mxStatusText.innerText = `${mxRes.provider} · MX Active`;
  } else {
    mxStatusBox.className = 'mx-status-row invalid';
    mxStatusIcon.innerText = '●';
    mxStatusText.innerText = mxRes.message || 'No MX records detected';
  }
}

async function handleGenerateAndVerify() {
  const name = prospectName.innerText.trim();
  const domain = inputDomain.value.trim() || currentProspect.domain;

  if (!domain && !currentProspect.directEmail) return;

  if (domain && (!currentProspect.mxStatus || currentProspect.domain !== domain)) {
    await checkDomainMX(domain);
  }

  const patterns = domain ? generateEmailPatterns(name, domain) : [];

  // If Private SMTP Verifier is active, query it for real-time batch verification
  if (config.usePrivateVerifier && config.verifierUrl && patterns.length > 0 && !currentProspect.directEmail) {
    try {
      scanHint.innerText = '⚡ Probing mail server via Private Engine...';
      const emailList = patterns.map(p => p.email);
      const res = await fetch(`${config.verifierUrl}/verify-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: emailList }),
        signal: AbortSignal.timeout(4000)
      });

      if (res.ok) {
        const batchData = await res.json();
        if (batchData.found && batchData.verifiedEmail) {
          currentProspect.directEmail = batchData.verifiedEmail;
          currentProspect.emailStatus = batchData.winnerStatus === 'DELIVERABLE'
            ? 'Private SMTP 250 OK'
            : (batchData.winnerStatus === 'MX_VERIFIED' ? 'MX Verified Active' : 'Catch-All Verified');
          currentProspect.isEnriched = true;
          scanHint.innerText = `✓ Verified via Private Engine: ${batchData.verifiedEmail}`;
        }

        if (Array.isArray(batchData.results)) {
          const resultMap = new Map(batchData.results.map(r => [r.email.toLowerCase(), r]));
          patterns.forEach(p => {
            const r = resultMap.get(p.email.toLowerCase());
            if (r) {
              p.smtpStatus = r.status;
              if (r.status === 'DELIVERABLE') {
                p.score = 99;
                p.likelihood = '✓ SMTP 250 OK';
              } else if (r.status === 'MX_VERIFIED') {
                p.score = Math.max(p.score || 0, 75);
                p.likelihood = '✓ MX Active';
              } else if (r.status === 'PORT_25_BLOCKED') {
                p.score = Math.max(p.score || 0, 60);
                p.likelihood = '✓ MX Route OK';
              } else if (r.status === 'UNDELIVERABLE') {
                p.score = 5;
                p.likelihood = '❌ Rejected';
              } else if (r.status === 'CATCH_ALL') {
                p.score = 65;
                p.likelihood = '⚠ Catch-All';
              }
            }
          });
          patterns.sort((a, b) => b.score - a.score);
        }
      }
    } catch (err) {
      console.debug('[LeadScout] Private verifier query note:', err.message);
      if (scanHint && scanHint.innerText.includes('Probing mail server')) {
        scanHint.innerText = currentProspect.directEmail ? '✓ Prospect Enriched' : 'Pattern Permutations Ready';
      }
    }
  }

  renderEmailCandidates(patterns);
}

function renderEmailCandidates(candidates) {
  emailCandidatesList.innerHTML = '';

  // Display Verified Email at the very top
  if (currentProspect.directEmail) {
    emailResultsTitle.innerText = 'Contact Emails';
    emailResultsSubtext.innerText = currentProspect.emailStatus?.includes('SMTP')
      ? 'Verified via Private SMTP Handshake'
      : (currentProspect.isEnriched ? 'Verified Contact' : 'Direct Contact');

    const directItem = document.createElement('div');
    directItem.className = 'email-item recommended';

    const statusLabel = currentProspect.emailStatus || '100% Deliverable';

    directItem.innerHTML = `
      <div class="email-main">
        <div class="email-addr">${currentProspect.directEmail}</div>
        <div class="email-meta">
          <span class="confidence-pill confidence-high">● ${statusLabel}</span>
        </div>
      </div>
      <div class="email-actions">
        <button class="btn-copy-main btn-copy" title="Copy to clipboard">${ICONS.copy}<span>Copy</span></button>
        <button class="icon-btn btn-save" title="Save lead">${ICONS.save}</button>
        <a class="icon-btn btn-search" title="Search Google" href="https://www.google.com/search?q=%22${encodeURIComponent(currentProspect.directEmail)}%22" target="_blank">${ICONS.search}</a>
      </div>
    `;

    setupItemActions(directItem, currentProspect.directEmail, statusLabel, 'Direct Match');
    emailCandidatesList.appendChild(directItem);
  } else {
    emailResultsTitle.innerText = 'Predicted Emails';
    emailResultsSubtext.innerText = 'Permutation Analysis';
  }

  if (!candidates || candidates.length === 0) {
    if (!currentProspect.directEmail) {
      emailCandidatesList.innerHTML = '<p class="empty-state">No email permutations could be created.</p>';
    }
    emailResultsCard.classList.remove('hidden');
    return;
  }

  candidates.forEach((cand, idx) => {
    if (cand.email.toLowerCase() === currentProspect.directEmail?.toLowerCase()) return;

    const isTop = idx === 0 && !currentProspect.directEmail;
    const item = document.createElement('div');
    item.className = `email-item ${isTop ? 'recommended' : ''}`;

    let pillClass = 'confidence-low';
    if (cand.score >= 80 || cand.smtpStatus === 'DELIVERABLE') {
      pillClass = 'confidence-high';
    } else if (cand.score >= 50 || cand.smtpStatus === 'CATCH_ALL') {
      pillClass = 'confidence-medium';
    }

    item.innerHTML = `
      <div class="email-main">
        <div class="email-addr">${cand.email}</div>
        <div class="email-meta">
          <span class="email-pattern">${cand.format}</span>
          <span class="confidence-pill ${pillClass}">● ${cand.likelihood}</span>
        </div>
      </div>
      <div class="email-actions">
        <button class="icon-btn btn-copy" title="Copy email">${ICONS.copy}</button>
        <button class="icon-btn btn-save" title="Save lead">${ICONS.save}</button>
        <a class="icon-btn btn-search" title="Search Google for this email" href="https://www.google.com/search?q=%22${encodeURIComponent(cand.email)}%22" target="_blank">${ICONS.search}</a>
      </div>
    `;

    setupItemActions(item, cand.email, cand.likelihood, cand.format);
    emailCandidatesList.appendChild(item);
  });

  emailResultsCard.classList.remove('hidden');
}

function setupItemActions(item, email, confidence, format) {
  const btnCopy = item.querySelector('.btn-copy');
  if (btnCopy) {
    btnCopy.addEventListener('click', async () => {
      await navigator.clipboard.writeText(email);
      const isMain = btnCopy.classList.contains('btn-copy-main');
      if (isMain) {
        btnCopy.innerHTML = `${ICONS.copied}<span>Copied</span>`;
        setTimeout(() => { btnCopy.innerHTML = `${ICONS.copy}<span>Copy</span>`; }, 1500);
      } else {
        btnCopy.innerHTML = ICONS.copied;
        setTimeout(() => { btnCopy.innerHTML = ICONS.copy; }, 1500);
      }
    });
  }

  const btnSave = item.querySelector('.btn-save');
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const leadToSave = {
        fullName: prospectName.innerText.trim(),
        firstName: email.split('@')[0].split('.')[0],
        lastName: email.split('@')[0].split('.')[1] || '',
        jobTitle: prospectHeadline.innerText.trim(),
        company: inputCompany.value.trim(),
        domain: inputDomain.value.trim(),
        email: email,
        emailStatus: currentProspect.mxStatus?.hasMx ? 'MX Verified' : 'Unverified',
        confidence: confidence,
        mailProvider: currentProspect.mxStatus?.provider || 'Unknown',
        phoneNumbers: currentProspect.phoneNumbers || [],
        linkedinUrl: currentProspect.linkedinUrl,
        location: prospectLocation.innerText.trim()
      };

      await saveLead(leadToSave);
      btnSave.innerHTML = ICONS.saved;
      btnSave.disabled = true;
      updateSavedCount();
    });
  }
}

async function updateSavedCount() {
  const leads = await getSavedLeads();
  savedCount.innerText = leads.length;
}

async function renderSavedLeads() {
  const leads = await getSavedLeads();
  savedLeadsList.innerHTML = '';

  if (leads.length === 0) {
    savedLeadsList.innerHTML = '<p class="empty-state">No saved leads yet. Prospect profiles to add them here.</p>';
    return;
  }

  leads.forEach((lead) => {
    const item = document.createElement('div');
    item.className = 'saved-item';
    
    let phoneHtml = '';
    if (lead.phoneNumbers && lead.phoneNumbers.length > 0) {
      phoneHtml = `<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#166534;margin-top:3px;">${ICONS.phone}<span>${lead.phoneNumbers[0].number}</span></div>`;
    }

    item.innerHTML = `
      <div>
        <div class="saved-name">${lead.fullName}</div>
        <div class="saved-details">${lead.jobTitle} at <strong>${lead.company || lead.domain}</strong></div>
        <div class="saved-email">${lead.email} <span style="font-size:10.5px;color:var(--text-muted);font-weight:normal;">(${lead.emailStatus || 'Saved'})</span></div>
        ${phoneHtml}
      </div>
      <button class="saved-delete" title="Delete lead">${ICONS.trash}</button>
    `;

    item.querySelector('.saved-delete').addEventListener('click', async () => {
      await deleteLead(lead.id);
      renderSavedLeads();
      updateSavedCount();
    });

    savedLeadsList.appendChild(item);
  });
}
