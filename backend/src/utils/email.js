// Email rules for sign-up. The frontend has the same format rules (frontend/src/utils/email.js)
// for instant feedback; this file is the one that is enforced.

import dns from 'node:dns';

const LOCAL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Returns a message describing what is wrong with the address, or null if the format is valid. */
export function emailFormatError(email) {
  if (!email) return 'Email is required';
  if (/\s/.test(email)) return 'Email cannot contain spaces';
  if (email.length > 254) return 'Email is too long (254 characters max)';

  const parts = email.split('@');
  if (parts.length !== 2) return 'Email must contain exactly one @';
  const [local, domain] = parts;

  if (!local) return 'Add the part before the @';
  if (local.length > 64) return 'The part before the @ is too long (64 characters max)';
  if (!LOCAL_RE.test(local)) return 'The part before the @ has characters that are not allowed';
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return 'Dots cannot start or end the part before the @, or appear twice in a row';
  }

  if (!domain) return 'Add the domain after the @, e.g. gmail.com';
  const labels = domain.toLowerCase().split('.');
  if (labels.length < 2) return 'The domain needs a dot, e.g. gmail.com';
  if (domain.length > 253 || labels.some((l) => !l || l.length > 63 || !LABEL_RE.test(l))) {
    return 'Check the domain after the @, e.g. gmail.com';
  }
  if (!/^[a-z]{2,}$/.test(labels[labels.length - 1])) return 'The domain must end in letters, e.g. .com or .in';
  return null;
}

// Common throwaway-inbox providers. Subdomains are blocked too (e.g. x.mailinator.com).
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com', '10minutemail.net', '20minutemail.com', '33mail.com', 'anonaddy.me', 'burnermail.io',
  'byom.de', 'deadaddress.com', 'discard.email', 'dispostable.com', 'dropmail.me', 'emailondeck.com',
  'fakeinbox.com', 'fakemail.net', 'getairmail.com', 'getnada.com', 'guerrillamail.biz', 'guerrillamail.com',
  'guerrillamail.de', 'guerrillamail.info', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamailblock.com',
  'harakirimail.com', 'inboxbear.com', 'incognitomail.org', 'jetable.org', 'mail-temp.com', 'mailcatch.com',
  'maildrop.cc', 'mailinator.com', 'mailinator.net', 'mailinator2.com', 'mailnesia.com', 'mailnull.com',
  'mailpoof.com', 'mailsac.com', 'mailtemp.net', 'mintemail.com', 'moakt.com', 'mohmal.com', 'mytemp.email',
  'mytrashmail.com', 'nada.email', 'one-time.email', 'sharklasers.com', 'spam4.me', 'spambog.com',
  'spamgourmet.com', 'temp-mail.io', 'temp-mail.org', 'tempail.com', 'tempinbox.com', 'tempmail.com',
  'tempmail.dev', 'tempmail.net', 'tempmailo.com', 'tempr.email', 'throwawaymail.com', 'trash-mail.com',
  'trashmail.com', 'trashmail.de', 'trashmail.net', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
]);

export function isDisposableEmail(email) {
  const labels = email.toLowerCase().split('@')[1]?.split('.') ?? [];
  for (let i = 0; i < labels.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}

// ---- Domain check: can this domain receive email at all? ----
// Catches made-up domains (asdf@jsaldf.com). It cannot tell whether a mailbox exists at a real
// provider (random@gmail.com); only a verification email can do that.

const resolver = new dns.promises.Resolver({ timeout: 2500, tries: 2 });
const domainCache = new Map(); // domain -> { ok, expires }
const CACHE_MS = 60 * 60 * 1000;
// DNS answers that mean "this name definitely has no records" (as opposed to a lookup failure).
const NOT_FOUND = new Set(['ENOTFOUND', 'ENODATA', 'NXDOMAIN']);

async function hasRecords(lookup) {
  try {
    return (await lookup()).length > 0;
  } catch (err) {
    if (NOT_FOUND.has(err.code)) return false;
    throw err;
  }
}

/**
 * true  – the domain has mail servers (MX), or an address record that mail falls back to (RFC 5321)
 * false – the domain does not exist, or publishes a "null MX" saying it accepts no mail (RFC 7505)
 * null  – DNS could not be reached; callers should let the sign-up through rather than block everyone
 */
export async function domainAcceptsMail(email) {
  const domain = email.toLowerCase().split('@')[1];
  const cached = domainCache.get(domain);
  if (cached && cached.expires > Date.now()) return cached.ok;

  let ok;
  try {
    let mx = [];
    try {
      mx = await resolver.resolveMx(domain);
    } catch (err) {
      if (!NOT_FOUND.has(err.code)) throw err;
    }
    if (mx.length) {
      ok = mx.some((r) => r.exchange && r.exchange !== '.');
    } else {
      ok = (await hasRecords(() => resolver.resolve4(domain))) || (await hasRecords(() => resolver.resolve6(domain)));
    }
  } catch (err) {
    console.warn(`Email domain check skipped for ${domain}: ${err.code || err.message}`);
    return null;
  }
  domainCache.set(domain, { ok, expires: Date.now() + CACHE_MS });
  return ok;
}
