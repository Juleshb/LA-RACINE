export const CONTRACT_TYPES = ['TRIAL', 'FIXED', 'OPEN', 'PERMANENT', 'LIFETIME'];
export const ACCOUNT_STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

export function cleanText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

export function parseHireDate(value) {
  const day = String(value ?? '').trim().slice(0, 10);
  if (!day) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  return new Date(`${day}T00:00:00.000Z`);
}

export function displayName(parts) {
  return [parts.lastName, parts.postName, parts.firstName]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
}

/** Fields sent by the staff dossier. Only keys present on the body are returned. */
export function pickStaffProfile(body = {}) {
  const data = {};
  if (body.postName !== undefined) data.postName = cleanText(body.postName);
  if (body.bankName !== undefined) data.bankName = cleanText(body.bankName);
  if (body.bankAccount !== undefined) data.bankAccount = cleanText(body.bankAccount);
  if (body.qualification !== undefined) data.qualification = cleanText(body.qualification);
  if (body.professionalExperience !== undefined) data.professionalExperience = cleanText(body.professionalExperience);
  if (body.contractType !== undefined) {
    const contract = cleanText(body.contractType);
    data.contractType = CONTRACT_TYPES.includes(contract) ? contract : null;
  }
  if (body.hireDate !== undefined) data.hireDate = parseHireDate(body.hireDate);
  if (body.accountStatus !== undefined) {
    const status = ACCOUNT_STATUSES.includes(body.accountStatus) ? body.accountStatus : 'ACTIVE';
    data.accountStatus = status;
    data.isActive = status === 'ACTIVE';
  }
  return data;
}
