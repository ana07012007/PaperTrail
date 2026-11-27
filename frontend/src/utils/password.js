// Same password rules as backend/src/utils/password.js, used for the live checklist on the sign-up form.

export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'At least one letter (a–z)', test: (p) => /[A-Za-z]/.test(p) },
  { label: 'At least one number (0–9)', test: (p) => /\d/.test(p) },
  { label: 'At least one special character (e.g. ! @ # $ % & *)', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
  { label: 'No spaces', test: (p) => !/\s/.test(p) },
];

/** Returns a message for the first rule the password breaks, or null if it meets them all. */
export function passwordError(password) {
  if (password.length > 128) return 'Password is too long (128 characters max)';
  const failed = PASSWORD_RULES.find((rule) => !rule.test(password));
  return failed ? `Password needs: ${failed.label.charAt(0).toLowerCase()}${failed.label.slice(1)}` : null;
}
