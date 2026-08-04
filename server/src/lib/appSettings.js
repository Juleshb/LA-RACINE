import prisma from './prisma.js';

export const SETTING_KEYS = {
  OTP_ENABLED: 'security.otpEnabled',
};

const DEFAULTS = {
  [SETTING_KEYS.OTP_ENABLED]: 'true',
};

export async function getSetting(key) {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (row) return row.value;
  return DEFAULTS[key] ?? null;
}

export async function setSetting(key, value, updatedBy = null) {
  const normalized = String(value);
  return prisma.appSetting.upsert({
    where: { key },
    create: { key, value: normalized, updatedBy },
    update: { value: normalized, updatedBy },
  });
}

/** When true, login and student deletion require email OTP. Default: enabled. */
export async function isOtpEnabled() {
  const value = await getSetting(SETTING_KEYS.OTP_ENABLED);
  return value !== 'false';
}

export async function getSecuritySettings() {
  return {
    otpEnabled: await isOtpEnabled(),
  };
}

export async function updateSecuritySettings({ otpEnabled }, updatedBy = null) {
  if (typeof otpEnabled === 'boolean') {
    await setSetting(SETTING_KEYS.OTP_ENABLED, otpEnabled ? 'true' : 'false', updatedBy);
  }
  return getSecuritySettings();
}
