/** Normalize CMS gallery items into albums (cover + external album URL). */
export function normalizeGalleryAlbum(item) {
  if (!item) return { title: '', coverUrl: '', albumUrl: '' };
  if (typeof item === 'string') {
    return { title: '', coverUrl: item, albumUrl: '' };
  }
  return {
    title: String(item.title || item.caption || '').trim(),
    coverUrl: String(item.coverUrl || item.imageUrl || item.url || item.body || '').trim(),
    albumUrl: String(item.albumUrl || item.link || '').trim(),
  };
}

export function galleryAlbums(items) {
  return (Array.isArray(items) ? items : [])
    .map(normalizeGalleryAlbum)
    .filter((album) => album.coverUrl || album.albumUrl || album.title);
}
