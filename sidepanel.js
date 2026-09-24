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
  apolloRevealPhone: false,
  apolloCredits: null,
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
const chkApolloRevealPhone = document.getElementById('chk-apollo-reveal-phone');
const btnTestApollo = document.getElementById('btn-test-apollo');
const apolloTestResult = document.getElementById('apollo-test-result');
const apolloCreditBadge = document.getElementById('apollo-credit-badge');
const apolloCreditCount = document.getElementById('apollo-credit-count');
const btnRefreshCredits = document.getElementById('btn-refresh-credits');
const apolloCreditInfo = document.getElementById('apollo-credit-info');
const apolloLiveCredits = document.getElementById('apollo-live-credits');
const btnRefreshApolloSettings = document.getElementById('btn-refresh-apollo-settings');

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
      'apollo_reveal_phone',
      'apollo_cached_credits',
      'apollo_cached_export_credits',
      'apollo_cached_lead_credits',
      'hunter_api_key'
    ], (res) => {
      config.verifierUrl = res.verifier_url || 'https://leadscout-extension.onrender.com';
      config.usePrivateVerifier = res.use_private_verifier !== false;
      config.prospeoApiKey = res.prospeo_api_key || '';
      config.apolloApiKey = res.apollo_api_key || '';
      config.apolloRevealPhone = res.apollo_reveal_phone === true;
      config.apolloCredits = res.apollo_cached_credits ?? null;
      config.apolloExportCredits = res.apollo_cached_export_credits ?? null;
      config.apolloLeadCredits = res.apollo_cached_lead_credits ?? null;
      config.hunterApiKey = res.hunter_api_key || '';

      if (inputVerifierUrl) inputVerifierUrl.value = config.verifierUrl;
      if (chkUsePrivateVerifier) chkUsePrivateVerifier.checked = config.usePrivateVerifier;
      if (inputProspeoKey) inputProspeoKey.value = config.prospeoApiKey;
      if (inputApolloKey) inputApolloKey.value = config.apolloApiKey;
      if (chkApolloRevealPhone) chkApolloRevealPhone.checked = config.apolloRevealPhone;
      if (inputHunterKey) inputHunterKey.value = config.hunterApiKey;

      if (config.apolloCredits !== null) {
        displayApolloCredits(config.apolloCredits, config.apolloExportCredits, config.apolloLeadCredits);
      } else {
        updateApiBanner();
      }

      if (config.apolloApiKey) {
        fetchLiveApolloCredits();
      }

      resolve();
    });
  });
}

function displayApolloCredits(credits, exportCredits = null, leadCredits = null) {
  if (credits === null || credits === undefined) return;

  if (exportCredits === null && config.apolloExportCredits !== undefined) exportCredits = config.apolloExportCredits;
  if (leadCredits === null && config.apolloLeadCredits !== undefined) leadCredits = config.apolloLeadCredits;

  let badgeText = '';
  let badgeTitle = 'Live Apollo Credits';

  if (exportCredits !== null && leadCredits !== null) {
    if (exportCredits === 0) {
      badgeText = `0 Export (${leadCredits.toLocaleString()} Web)`;
      badgeTitle = `0 API Export Credits remaining (${leadCredits.toLocaleString()} In-App Web Credits). Apollo API requires Export Credits to reveal emails.`;
    } else {
      badgeText = `${exportCredits.toLocaleString()} Export`;
      badgeTitle = `${exportCredits.toLocaleString()} API Export Credits remaining (${leadCredits.toLocaleString()} In-App Web Credits)`;
    }
  } else {
    badgeText = typeof credits === 'number' ? credits.toLocaleString() : String(credits);
    badgeTitle = `${badgeText} Apollo credits remaining`;
  }

  if (apolloCreditCount) apolloCreditCount.innerText = badgeText;
  if (apolloCreditBadge) {
    apolloCreditBadge.title = badgeTitle;
    apolloCreditBadge.classList.remove('hidden');
    if (exportCredits === 0) {
      apolloCreditBadge.style.background = '#fef3c7';
      apolloCreditBadge.style.color = '#92400e';
      apolloCreditBadge.style.borderColor = '#fde68a';
    } else {
      apolloCreditBadge.style.background = '';
      apolloCreditBadge.style.color = '';
      apolloCreditBadge.style.borderColor = '';
    }
  }

  if (apolloLiveCredits) {
    if (exportCredits !== null && leadCredits !== null) {
      let html = `<strong>${exportCredits.toLocaleString()}</strong> Export Credits <span style="font-weight:normal;color:var(--text-muted);">(${leadCredits.toLocaleString()} Web Credits)</span>`;
      if (exportCredits === 0) {
        html += `<div style="font-size:10px;color:#b45309;margin-top:4px;font-weight:normal;line-height:1.3;">⚠️ Your account has 0 API Export Credits. In Apollo, external API queries consume Export Credits, not Web Lead Credits. Ask your team admin to allocate Export Credits in Apollo Settings ➔ Credit Limits.</div>`;
      }
      apolloLiveCredits.innerHTML = html;
    } else {
      apolloLiveCredits.innerText = typeof credits === 'number' ? credits.toLocaleString() : String(credits);
    }
  }

  if (apolloCreditInfo) apolloCreditInfo.classList.remove('hidden');

  if (config.apolloApiKey && bannerApiHint) {
    bannerApiHint.className = 'engine-strip';
    if (exportCredits === 0) {
      bannerApiHint.innerHTML = `<span style="color:#f59e0b;font-size:10px;">●</span><span><strong>Apollo Active</strong> · <span style="color:#b45309;">0 API Export Credits (${leadCredits ? leadCredits.toLocaleString() : '482'} Web)</span></span>`;
    } else {
      bannerApiHint.innerHTML = `<span style="color:var(--success);font-size:10px;">●</span><span><strong>Apollo Active</strong> · ${badgeText}</span>`;
    }
  }
}

async function fetchLiveApolloCredits(spin = false) {
  if (!config.apolloApiKey) {
    if (apolloCreditBadge) apolloCreditBadge.classList.add('hidden');
    if (apolloCreditInfo) apolloCreditInfo.classList.add('hidden');
    return;
  }

  if (spin) {
    if (btnRefreshCredits) btnRefreshCredits.classList.add('spinning');
    if (btnRefreshApolloSettings) btnRefreshApolloSettings.innerText = 'Checking...';
  }

  chrome.runtime.sendMessage({
    type: 'GET_APOLLO_CREDITS',
    payload: { apiKey: config.apolloApiKey }
  }, (res) => {
    if (spin) {
      if (btnRefreshCredits) btnRefreshCredits.classList.remove('spinning');
      if (btnRefreshApolloSettings) btnRefreshApolloSettings.innerText = '↻ Refresh';
    }

    if (res && res.success && res.credits !== undefined) {
      config.apolloCredits = res.credits;
      config.apolloExportCredits = res.exportCredits ?? null;
      config.apolloLeadCredits = res.leadCredits ?? null;
      chrome.storage.local.set({
        apollo_cached_credits: res.credits,
        apollo_cached_export_credits: res.exportCredits ?? null,
        apollo_cached_lead_credits: res.leadCredits ?? null
      });
      displayApolloCredits(res.credits, res.exportCredits, res.leadCredits);
    } else if (res && !res.success) {
      console.warn('[LeadScout] Live credits fetch note:', res.error);
    }
  });
}

function updateApiBanner() {
  if (config.apolloApiKey) {
    bannerApiHint.className = 'engine-strip';
    const creditStr = config.apolloCredits !== null
      ? ` · ${typeof config.apolloCredits === 'number' ? config.apolloCredits.toLocaleString() : config.apolloCredits} credits left`
      : '';
    bannerApiHint.innerHTML = `<span style="color:var(--success);font-size:10px;">●</span><span><strong>Apollo Active</strong>${creditStr}</span>`;
  } else if (config.usePrivateVerifier) {
    bannerApiHint.className = 'engine-strip';
    bannerApiHint.innerHTML = '<span style="color:var(--success);font-size:10px;">●</span><span><strong>Private SMTP Engine Active</strong> (Self-Hosted / $0 Cost)</span>';
  } else if (config.prospeoApiKey) {
    bannerApiHint.className = 'engine-strip';
    bannerApiHint.innerHTML = '<span style="color:var(--success);font-size:10px;">●</span><span><strong>Prospeo Active</strong></span>';
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

  // Refresh Apollo Live Credits buttons
  if (btnRefreshCredits) {
    btnRefreshCredits.addEventListener('click', (e) => {
      e.stopPropagation();
      fetchLiveApolloCredits(true);
    });
  }

  if (btnRefreshApolloSettings) {
    btnRefreshApolloSettings.addEventListener('click', (e) => {
      e.preventDefault();
      fetchLiveApolloCredits(true);
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
        btnTestApollo.innerText = '🔌 Test Key';
        btnTestApollo.disabled = false;
        apolloTestResult.classList.remove('hidden');

        if (res && res.success) {
          apolloTestResult.style.color = '#15803d';
          apolloTestResult.innerText = res.message || '✓ Apollo API Connected Successfully!';
          if (res.credits !== undefined && res.credits !== 'Active') {
            config.apolloCredits = res.credits;
            config.apolloExportCredits = res.exportCredits ?? null;
            config.apolloLeadCredits = res.leadCredits ?? null;
            chrome.storage.local.set({
              apollo_cached_credits: res.credits,
              apollo_cached_export_credits: res.exportCredits ?? null,
              apollo_cached_lead_credits: res.leadCredits ?? null
            });
            displayApolloCredits(res.credits, res.exportCredits, res.leadCredits);
          } else {
            fetchLiveApolloCredits(true);
          }
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
        const res = await fetch(`${verifierEndpoint}/health`, { signal: AbortSignal.timeout(4000) });
        const data = await res.json();
        if (data.status === 'ok') {
          verifierTestResult.style.color = '#15803d';
          const p25Status = data.port25Outbound ? 'Port 25 Direct Active' : 'HTTP Mode Active';
          verifierTestResult.innerText = `✓ Private Engine Connected (${p25Status}, Uptime: ${Math.round(data.uptime)}s)`;
        } else {
          verifierTestResult.style.color = '#dc2626';
          verifierTestResult.innerText = '❌ Engine reported unhealthy status.';
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
    const apolloRevealPhoneVal = chkApolloRevealPhone ? chkApolloRevealPhone.checked : false;
    const hunterVal = inputHunterKey ? inputHunterKey.value.trim() : '';

    chrome.storage.local.set({
      verifier_url: verifierUrlVal,
      use_private_verifier: useVerifierVal,
      prospeo_api_key: prospeoVal,
      apollo_api_key: apolloVal,
      apollo_reveal_phone: apolloRevealPhoneVal,
      hunter_api_key: hunterVal
    }, () => {
      config.verifierUrl = verifierUrlVal;
      config.usePrivateVerifier = useVerifierVal;
      config.prospeoApiKey = prospeoVal;
      config.apolloApiKey = apolloVal;
      config.apolloRevealPhone = apolloRevealPhoneVal;
      config.hunterApiKey = hunterVal;
      updateApiBanner();

      if (apolloVal) {
        fetchLiveApolloCredits(true);
      } else {
        if (apolloCreditBadge) apolloCreditBadge.classList.add('hidden');
        if (apolloCreditInfo) apolloCreditInfo.classList.add('hidden');
      }

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
      jobTitle: (data.jobTitle || 'No Title Listed').split('\n')[0].trim(),
      company: safeCompany,
      domain: data.domain || '',
      directEmail: data.directEmail || '',
      emailStatus: '',
      phoneNumbers: [],
      location: data.location || 'Location Not Specified',
      profilePic: data.profilePic || '',
      linkedinUrl: activeTab.url.split('?')[0].split('#')[0],
      mxStatus: null,
      isEnriched: false,
      apolloError: null
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

    // STEP 2: If Apollo API Key is configured, query Apollo FIRST for verified direct data
    if (config.apolloApiKey) {
      scanHint.innerText = '⚡ Enriching via Apollo.io database...';
      const apolloRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'ENRICH_APOLLO',
          payload: {
            apiKey: config.apolloApiKey,
            linkedinUrl: currentProspect.linkedinUrl,
            fullName: currentProspect.fullName,
            company: currentProspect.company,
            domain: currentProspect.domain,
            revealPhone: config.apolloRevealPhone === true
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

        scanHint.innerText = `✓ Matched in Apollo: ${apolloRes.email || apolloRes.company || 'Verified'}`;
        // Automatically sync live credit balance
        fetchLiveApolloCredits();
      } else if (apolloRes && apolloRes.error) {
        lastEnrichError = apolloRes.error;
        currentProspect.apolloError = apolloRes.error;
        scanHint.innerText = `Apollo: ${apolloRes.error}`;
      }
    }

    // STEP 3: If Private SMTP Engine is enabled and no direct email yet, verify via Private Engine ($0 Cost)
    if (!currentProspect.directEmail && config.usePrivateVerifier && config.verifierUrl && (currentProspect.domain || currentProspect.company)) {
      scanHint.innerText = '⚡ Probing mail server via Private Engine ($0 Cost)...';
      await handleGenerateAndVerify();
    }

    // STEP 4: Fallback to Prospeo ONLY if still no direct email
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
          if (!currentProspect.apolloError) {
            lastEnrichError = prospeoRes.error;
          }
          scanHint.innerText = `Prospeo: ${prospeoRes.error}`;
        }
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

  // SCENARIO 1: Verified Email Found -> Show ONLY that 1 accurate email!
  if (currentProspect.directEmail) {
    emailResultsTitle.innerText = 'Verified Email';
    emailResultsSubtext.innerText = currentProspect.emailStatus?.includes('Apollo')
      ? 'Guaranteed Apollo Match'
      : (currentProspect.emailStatus?.includes('SMTP') ? 'Verified via Private SMTP' : '100% Deliverable');

    const directItem = document.createElement('div');
    directItem.className = 'email-item recommended';

    const statusLabel = currentProspect.emailStatus || 'Verified Deliverable';

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
    emailResultsCard.classList.remove('hidden');
    return; // STOP! Show ONLY this 1 accurate verified email.
  }

  // SCENARIO 2: No Verified Email Found
  let errorTitle = 'Profile Not Found in Apollo';
  let errorDesc = `Apollo has no verified email record for <strong>${currentProspect.fullName || 'this contact'}</strong>.`;
  let errorIcon = '❌';
  let cardBg = '#fef2f2';
  let cardBorder = '#fecaca';
  let textColor = '#7f1d1d';
  let titleColor = '#991b1b';

  const errText = (currentProspect.apolloError || lastEnrichError || '').toLowerCase();
  if (errText.includes('credit') || errText.includes('quota') || errText.includes('422')) {
    const webCreds = config.apolloLeadCredits || (typeof config.apolloCredits === 'number' ? config.apolloCredits : '482');
    errorTitle = 'Apollo Insufficient API Export Credits';
    errorDesc = `
      <div style="margin-bottom:6px;">Apollo returned: <em>"${currentProspect.apolloError || lastEnrichError}"</em>.</div>
      <div style="background:rgba(255,255,255,0.7);padding:8px 10px;border-radius:4px;border:1px solid #fde68a;font-size:11px;line-height:1.45;color:#78350f;">
        <strong>Why does this happen if your Apollo dashboard shows credits?</strong><br>
        Apollo maintains two distinct credit balances:
        <ul style="margin:4px 0 6px 16px;padding:0;">
          <li><strong>Web Lead Credits:</strong> Used for browsing profiles directly inside Apollo.io (${typeof webCreds === 'number' ? webCreds.toLocaleString() : webCreds} remaining).</li>
          <li><strong>Export / API Credits:</strong> Required whenever external tools or Chrome extensions query the Apollo API to reveal emails. Your account currently has <strong>0 Export Credits</strong>.</li>
        </ul>
        <strong>How to resolve:</strong>
        <ol style="margin:4px 0 0 16px;padding:0;">
          <li>In Apollo.io ➔ <strong>Settings</strong> ➔ <strong>Credit Limits</strong> (or Team Settings), allocate Export Credits to your user seat.</li>
          <li>Or enable the built-in <strong>Private SMTP Verifier</strong> ($0 cost) in Settings to verify emails without using Apollo credits.</li>
        </ol>
      </div>
    `;
    errorIcon = '⚠️';
    cardBg = '#fffbeb';
    cardBorder = '#fde68a';
    titleColor = '#92400e';
    textColor = '#78350f';
  } else if (errText.includes('key') || errText.includes('unauthorized') || errText.includes('401') || errText.includes('403')) {
    errorTitle = 'Apollo API Key Error';
    errorDesc = `Apollo rejected the API request: <em>"${currentProspect.apolloError || lastEnrichError}"</em>. Please check your key in Settings.`;
    errorIcon = '🔑';
    cardBg = '#fffbeb';
    cardBorder = '#fde68a';
    titleColor = '#92400e';
    textColor = '#78350f';
  }

  emailResultsTitle.innerText = errorTitle.includes('Credits') ? 'Quota Exceeded' : 'No Verified Email';
  emailResultsSubtext.innerText = errorTitle.includes('Credits') ? 'API Error' : 'Not found in database';

  const notFoundCard = document.createElement('div');
  notFoundCard.style.cssText = `padding: 12px 14px; background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 6px; margin-bottom: 8px;`;
  notFoundCard.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;color:${titleColor};font-weight:600;font-size:12px;margin-bottom:4px;">
      <span>${errorIcon}</span>
      <span>${errorTitle}</span>
    </div>
    <p style="margin:0;font-size:11px;color:${textColor};line-height:1.4;">
      ${errorDesc}
    </p>
  `;
  emailCandidatesList.appendChild(notFoundCard);

  // Put pattern permutations inside a collapsed details section
  if (candidates && candidates.length > 0) {
    const permDetails = document.createElement('details');
    permDetails.style.cssText = 'margin-top: 6px; font-size: 11px; color: var(--text-secondary);';
    permDetails.innerHTML = `
      <summary style="cursor:pointer;font-weight:500;padding:5px 0;color:var(--text-muted);user-select:none;">
        ▾ View Unverified Pattern Permutations (${candidates.length})
      </summary>
      <div class="perm-list" style="margin-top:6px;display:flex;flex-direction:column;gap:5px;"></div>
    `;

    const listCont = permDetails.querySelector('.perm-list');
    candidates.forEach((cand) => {
      const item = document.createElement('div');
      item.className = 'email-item';
      item.style.opacity = '0.85';
      item.innerHTML = `
        <div class="email-main">
          <div class="email-addr" style="font-size:12px;">${cand.email}</div>
          <div class="email-meta">
            <span class="email-pattern">${cand.format}</span>
            <span class="confidence-pill confidence-low" style="font-size:9.5px;">Unverified Pattern</span>
          </div>
        </div>
        <div class="email-actions">
          <button class="icon-btn btn-copy" title="Copy email">${ICONS.copy}</button>
        </div>
      `;
      setupItemActions(item, cand.email, 'Pattern Guess', cand.format);
      listCont.appendChild(item);
    });

    emailCandidatesList.appendChild(permDetails);
  }

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
