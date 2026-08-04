function slugify(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Resolve a program detail from academics CMS (and home cards as fallback). */
export function findProgram(academics, home, slug) {
  const fromAcademics = Array.isArray(academics?.programs) ? academics.programs : [];
  const fromHome = Array.isArray(home?.programs) ? home.programs : [];
  const all = [...fromAcademics, ...fromHome];
  const needle = String(slug || '').toLowerCase();
  return all.find((p) => {
    const s = (p.slug || slugify(p.title)).toLowerCase();
    return s === needle;
  }) || null;
}

/** Merge home card with academics detail for richer listing cards. */
export function enrichProgramCard(card, academicsPrograms = []) {
  if (!card) return card;
  const slug = card.slug || slugify(card.title);
  const detail = (academicsPrograms || []).find((p) => (p.slug || slugify(p.title)) === slug);
  if (!detail) return { ...card, slug, to: card.to || `/academics/${slug}` };
  return {
    ...detail,
    ...card,
    slug,
    to: card.to || `/academics/${slug}`,
    points: card.points?.length ? card.points : detail.points,
    imageUrl: card.imageUrl || detail.imageUrl,
    body: card.body || detail.body,
    ages: card.ages || detail.ages,
    levelLine: card.levelLine || detail.levelLine,
    cardFacts: card.cardFacts?.length ? card.cardFacts : detail.cardFacts,
    badge: card.badge || detail.badge,
  };
}

export { slugify };
