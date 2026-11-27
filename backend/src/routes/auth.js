import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { config } from '../config.js';
import {
  closestAllowedEmail, domainAcceptsMail, emailFormatError, emailTypoSuggestion, isDisposableEmail,
  MAJOR_EMAIL_DOMAINS, resolveAllowedDomains,
} from '../utils/email.js';
import { passwordError } from '../utils/password.js';

const router = Router();
// null = any domain allowed (open mode); otherwise only these domains can sign up.
const ALLOWED_DOMAINS = resolveAllowedDomains(config.allowedEmailDomains);

function describeAllowed() {
  if (ALLOWED_DOMAINS === MAJOR_EMAIL_DOMAINS) return 'Gmail, Outlook, Yahoo, iCloud or another major provider';
  const shown = ALLOWED_DOMAINS.slice(0, 4).join(', ');
  const more = ALLOWED_DOMAINS.length - 4;
  return more > 0 ? `${shown} or one of ${more} other accepted domains` : `an address at ${shown}`;
}

// Lets the sign-up form check the domain instantly with the same list the server enforces.
router.get('/email-rules', (_req, res) => {
  res.json({ allowedDomains: ALLOWED_DOMAINS });
});
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const googleClient = new OAuth2Client(config.googleClientId);

router.post('/register', authLimiter, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!name) throw new HttpError(400, 'Name is required');
  const emailError = emailFormatError(email);
  if (emailError) throw new HttpError(400, emailError);
  if (ALLOWED_DOMAINS) {
    const domain = email.split('@')[1];
    if (!ALLOWED_DOMAINS.includes(domain)) {
      const suggestion = closestAllowedEmail(email, ALLOWED_DOMAINS);
      throw new HttpError(400, suggestion
        ? `Did you mean ${suggestion}? Please check the spelling after the @.`
        : `"${domain}" is not an accepted email provider. Please sign up with ${describeAllowed()}.`);
    }
  } else {
    // Open mode (ALLOWED_EMAIL_DOMAINS=*): any domain, as long as it is real and not a throwaway.
    const suggestion = emailTypoSuggestion(email);
    if (suggestion) throw new HttpError(400, `Did you mean ${suggestion}? Please check the spelling after the @.`);
    if (isDisposableEmail(email)) {
      throw new HttpError(400, 'Temporary or disposable email addresses are not allowed. Please use your regular email.');
    }
    if ((await domainAcceptsMail(email)) === false) {
      throw new HttpError(400, `The email domain "${email.split('@')[1]}" doesn't exist or can't receive email. ` +
        'Check the part after the @ for typos.');
    }
  }
  const pwError = passwordError(password);
  if (pwError) throw new HttpError(400, pwError);
  if (await User.exists({ email })) throw new HttpError(409, 'An account with this email already exists');

  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: signToken(user), user: user.toPublic() });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Enter a valid email address');
  if (!password) throw new HttpError(400, 'Password is required');

  const user = await User.findOne({ email }).select('+passwordHash');
  let passwordMatches = false;

  if (user?.passwordHash) {
    try {
      passwordMatches = await bcrypt.compare(password, user.passwordHash);
    } catch (err) {
      console.error(`Unable to validate password hash for user ${user._id}: ${err.message}`);
    }
  }

  if (!user || !passwordMatches) {
    throw new HttpError(401, 'Incorrect email or password');
  }
  res.json({ token: signToken(user), user: user.toPublic() });
});

router.post('/google', authLimiter, async (req, res) => {
  const credential = String(req.body?.credential || '');
  if (!credential) throw new HttpError(400, 'Google credential is required');
  if (!config.googleClientId) throw new HttpError(500, 'Google login is not configured');

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    });
  } catch {
    throw new HttpError(401, 'Google login could not be verified');
  }

  const payload = ticket.getPayload();
  if (!payload?.email_verified || !payload.email || !payload.sub) {
    throw new HttpError(401, 'Google account email could not be verified');
  }

  const email = payload.email.trim().toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });

  if (user) {
    if (!user.googleId) {
      user.googleId = payload.sub;
      await user.save();
    }
  } else {
    user = await User.create({
      name: String(payload.name || email.split('@')[0]).trim().slice(0, 80),
      email,
      googleId: payload.sub,
    });
  }

  res.json({ token: signToken(user), user: user.toPublic() });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'Account not found');
  res.json({ user: user.toPublic() });
});

export default router;
