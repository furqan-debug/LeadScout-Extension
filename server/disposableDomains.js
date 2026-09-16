/**
 * Known disposable and temporary email domains.
 * Instant O(1) set lookup to filter out temporary inboxes.
 */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'sharklasers.com', 'grr.la', 'guerrillamail.biz', 'guerrillamailblock.com',
  'tempmail.com', 'temp-mail.org', '10minutemail.com', '10minutemail.net',
  'throwawaymail.com', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'trashmail.com', 'trashmail.net', 'trashmail.me', 'dispostable.com',
  'getairmail.com', 'mytemp.email', 'fakeinbox.com', 'mohmal.com',
  'generator.email', 'tempail.com', 'burnermail.io', 'inboxkitten.com',
  'mailcatch.com', 'crazymailing.com', 'getnada.com', 'abv.bg',
  'emailondeck.com', 'maildrop.cc', 'tempinbox.com', 'harakirimail.com',
  'meltmail.com', 'spoofmail.de', 'boun.cr', 'trashymail.com'
]);

function isDisposableDomain(domain) {
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase().trim());
}

module.exports = {
  isDisposableDomain
};
