function stripSchoolWords(value) {
  return String(value || '')
    .replace(/^\s*(?:é|e)cole\s+/i, '')
    .replace(/\s*school\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/** School name only. Campus letters such as (A) or (B) stay off the report title. */
export function reportSchoolTitle(schoolName) {
  const school = stripSchoolWords(schoolName || 'La RACINE') || 'LA RACINE';
  return `ÉCOLE ${school}`;
}
