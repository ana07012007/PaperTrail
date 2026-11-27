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

/** Is DNS itself working? Used to tell a broken domain apart from a network outage. */
async function dnsIsReachable() {
  try {
    return (await resolver.resolveMx('gmail.com')).length > 0;
  } catch {
    return false;
  }
}

/**
 * true  – the domain publishes mail servers (MX records)
 * false – the domain does not exist, has no mail servers (e.g. a parked typo domain like gfmail.com),
 *         publishes a "null MX" saying it accepts no mail (RFC 7505), or its DNS is broken
 * null  – DNS could not be reached; callers should let the sign-up through rather than block everyone
 *
 * Mail servers are required: the standard allows mail to fall back to a plain address record, but
 * real email providers always publish MX, while parked look-alike domains often only have a website.
 */
export async function domainAcceptsMail(email) {
  const domain = email.toLowerCase().split('@')[1];
  const cached = domainCache.get(domain);
  if (cached && cached.expires > Date.now()) return cached.ok;

  let ok;
  try {
    const mx = await resolver.resolveMx(domain);
    ok = mx.some((r) => r.exchange && r.exchange !== '.');
  } catch (err) {
    if (NOT_FOUND.has(err.code)) {
      ok = false;
    } else if (await dnsIsReachable()) {
      ok = false; // DNS works for others, so this domain's own DNS is broken (e.g. SERVFAIL)
    } else {
      console.warn(`Email domain check skipped for ${domain}: ${err.code || err.message}`);
      return null;
    }
  }
  domainCache.set(domain, { ok, expires: Date.now() + CACHE_MS });
  return ok;
}

// ---- Typo check: "asdasd@gfmail.com" → "Did you mean asdasd@gmail.com?" ----

// Real domains that must never be flagged as typos (some are one letter away from a popular one).
const KNOWN_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'rocketmail.com',
  'outlook.com', 'outlook.in', 'hotmail.com', 'hotmail.co.in', 'live.com', 'live.in', 'msn.com', 'icloud.com',
  'me.com', 'mac.com', 'aol.com', 'protonmail.com', 'proton.me', 'pm.me', 'zoho.com', 'zohomail.in',
  'rediffmail.com', 'mail.com', 'email.com', 'gmx.com', 'gmx.net', 'yandex.com', 'gla.ac.in',
]);
// Domains we suggest when someone mistypes one.
const SUGGEST_DOMAINS = ['gmail.com', 'yahoo.com', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'icloud.com',
  'rediffmail.com', 'protonmail.com', 'live.com', 'gla.ac.in'];

/** Edit distance counting a swap of two neighbouring letters as one edit (gmial → gmail). */
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Returns the corrected address if the domain looks like a typo of a popular provider, else null. */
export function emailTypoSuggestion(email) {
  const [local, domain = ''] = email.toLowerCase().split('@');
  if (!domain || KNOWN_DOMAINS.has(domain)) return null;
  let best = null;
  for (const target of SUGGEST_DOMAINS) {
    const distance = editDistance(domain, target);
    const allowed = target.length >= 10 ? 2 : 1; // longer names tolerate one more slip
    if (distance <= allowed && (!best || distance < best.distance)) best = { target, distance };
  }
  return best ? `${local}@${best.target}` : null;
}
