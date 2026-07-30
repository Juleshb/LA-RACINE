/**
 * Shared client-side password strength checks (mirrors server policy).
 */
export const PASSWORD_POLICY_HINT =
  'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function validateStrongPassword(password) {
  const value = String(password || '');
  if (!STRONG_PASSWORD_REGEX.test(value)) {
    return { ok: false, error: PASSWORD_POLICY_HINT };
  }
  return { ok: true };
}

export function passwordStrengthLabel(password) {
  const value = String(password || '');
  if (!value) return { label: '', level: 0 };
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (score <= 2) return { label: 'Weak', level: 1 };
  if (score <= 4) return { label: 'Fair', level: 2 };
  return { label: 'Strong', level: 3 };
}
