// Same format rules as backend/src/utils/email.js, for instant feedback on the sign-up form.
// The server also blocks throwaway (disposable) domains.

const LOCAL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

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
