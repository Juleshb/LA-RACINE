const PLACEHOLDER_EMAILS = new Set(['manager@laracineschool.rw']);

function formatPersonName(user) {
  return [user?.firstName, user?.lastName]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
}

/** Active school manager shown under the director signature on bulletins. */
export async function resolveDirectorName(db) {
  const managers = await db.user.findMany({
    where: { role: 'SCHOOL_MANAGER', isActive: true },
    select: { firstName: true, lastName: true, email: true },
    orderBy: { createdAt: 'asc' },
  });
  const named = managers
    .map((user) => ({ user, name: formatPersonName(user) }))
    .filter((row) => row.name);
  const director = named.find((row) => !PLACEHOLDER_EMAILS.has(String(row.user.email || '').toLowerCase()))
    || named[0];
  return director?.name || '';
}
