/** Full student name in school order: last name, surname (post-nom), first name. */
export function studentFullName(student) {
  if (!student) return '';
  const parts = [student.lastName, student.postName, student.firstName]
    .map((part) => String(part || '').trim())
    .filter(Boolean);
  if (parts.length) return parts.join(' ');
  return String(student.name || '').trim();
}

/** Father and mother names for the student ID card. Falls back to the generic parent name. */
export function studentParentFacts(student) {
  const father = String(student?.fatherName || '').trim();
  const mother = String(student?.motherName || '').trim();
  const facts = [];
  if (father) facts.push({ label: 'Père', value: father });
  if (mother) facts.push({ label: 'Mère', value: mother });
  if (!facts.length) {
    const parent = String(student?.parentName || '').trim();
    if (parent) facts.push({ label: 'Parent', value: parent });
  }
  return facts;
}
