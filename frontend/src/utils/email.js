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
