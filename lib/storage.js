/**
 * Lead Storage & Export Manager
 * Manages local Chrome storage and CSV export generation.
 */

const STORAGE_KEY = 'leadscout_saved_leads';

export async function getSavedLeads() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve(result[STORAGE_KEY] || []);
    });
  });
}

export async function saveLead(lead) {
  const currentLeads = await getSavedLeads();
  
  // Check if lead already exists by linkedinUrl or email
  const existingIndex = currentLeads.findIndex(item => 
    (lead.linkedinUrl && item.linkedinUrl === lead.linkedinUrl) ||
    (lead.email && item.email === lead.email)
  );

  const enrichedLead = {
    ...lead,
    id: lead.id || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    savedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    currentLeads[existingIndex] = enrichedLead;
  } else {
    currentLeads.unshift(enrichedLead);
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: currentLeads }, () => {
      resolve(enrichedLead);
    });
  });
}

export async function deleteLead(leadId) {
  const currentLeads = await getSavedLeads();
  const filtered = currentLeads.filter(lead => lead.id !== leadId);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: filtered }, () => {
      resolve(filtered);
    });
  });
}

export async function clearAllLeads() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEY], () => {
      resolve();
    });
  });
}

export function exportLeadsToCsv(leads) {
  if (!leads || leads.length === 0) {
    alert('No leads to export!');
    return;
  }

  const headers = [
    'Full Name',
    'First Name',
    'Last Name',
    'Job Title',
    'Company',
    'Domain',
    'Primary Email',
    'Email Status',
    'Email Confidence',
    'Mail Provider',
    'LinkedIn URL',
    'Location',
    'Date Saved'
  ];

  const rows = leads.map(l => [
    escapeCsv(l.fullName || ''),
    escapeCsv(l.firstName || ''),
    escapeCsv(l.lastName || ''),
    escapeCsv(l.jobTitle || ''),
    escapeCsv(l.company || ''),
    escapeCsv(l.domain || ''),
    escapeCsv(l.email || ''),
    escapeCsv(l.emailStatus || ''),
    escapeCsv(l.confidence || ''),
    escapeCsv(l.mailProvider || ''),
    escapeCsv(l.linkedinUrl || ''),
    escapeCsv(l.location || ''),
    escapeCsv(l.savedAt ? new Date(l.savedAt).toLocaleDateString() : '')
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `LeadScout_Prospects_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsv(str) {
  const text = String(str || '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
