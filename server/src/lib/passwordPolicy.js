const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const PASSWORD_POLICY_HINT =
  'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.';

export function validateStrongPassword(password) {
  const value = String(password || '');
  if (!STRONG_PASSWORD_REGEX.test(value)) {
    return { ok: false, error: PASSWORD_POLICY_HINT };
  }
  return { ok: true };
}

/** Temporary password sent by email — also meets the strong policy. */
export function generateTemporaryPassword(length = 12) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;

  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  for (let i = chars.length; i < length; i += 1) {
    chars.push(pick(all));
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
