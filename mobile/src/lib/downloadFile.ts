import * as FileSystem from 'expo-file-system/legacy';

export type DownloadedFile = {
  uri: string;
  mimeType: string;
  isPdf: boolean;
  isImage: boolean;
};

function extensionFor(
  item: {
    fileName?: string | null;
    mimeType?: string | null;
    isPdf?: boolean;
    isImage?: boolean;
  },
  contentType?: string | null,
): string {
  const fromName = item.fileName?.match(/\.[a-z0-9]+$/i)?.[0];
  if (fromName) return fromName.toLowerCase();

  const mime = (contentType || item.mimeType || '').toLowerCase();
  if (item.isPdf || mime.includes('pdf')) return '.pdf';
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('webp')) return '.webp';
  if (item.isImage) return '.jpg';
  return '';
}

/**
 * Download an authenticated API file into app cache.
 */
export async function downloadAuthedFile(opts: {
  cacheKey: string;
  source: { uri: string; headers: Record<string, string> };
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<DownloadedFile> {
  const { cacheKey, source, fileName, mimeType: knownMime } = opts;

  if (!source?.uri || !/^https?:\/\//i.test(source.uri)) {
    throw new Error('Invalid file download address');
  }

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Device storage is not available for downloads');
  }

  const meta = {
    fileName,
    mimeType: knownMime,
    isPdf: knownMime === 'application/pdf',
    isImage: Boolean(knownMime?.startsWith('image/')),
  };
  const ext = extensionFor(meta);
  const target = `${cacheDir}${cacheKey}${ext || '.bin'}`;

  const info = await FileSystem.getInfoAsync(target);
  if (info.exists) {
    await FileSystem.deleteAsync(target, { idempotent: true });
  }

  const downloaded = await FileSystem.downloadAsync(source.uri, target, {
    headers: source.headers,
  });

  if (!downloaded?.uri) {
    throw new Error('Download finished but no file was saved');
  }

  if (downloaded.status < 200 || downloaded.status >= 300) {
    throw new Error(
      downloaded.status === 401 || downloaded.status === 403
        ? 'Please sign in again to open this file'
        : downloaded.status === 404
          ? 'File not found on the server'
          : `Could not download file (${downloaded.status})`,
    );
  }

  const headerMime =
    downloaded.headers?.['Content-Type'] ||
    downloaded.headers?.['content-type'] ||
    '';
  const mimeType = String(headerMime || knownMime || 'application/octet-stream')
    .split(';')[0]
    .trim();
  const isPdf = mimeType === 'application/pdf' || downloaded.uri.toLowerCase().endsWith('.pdf');
  const isImage =
    mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(downloaded.uri);

  const betterExt = extensionFor({ fileName, mimeType, isPdf, isImage }, mimeType);
  let uri = downloaded.uri;
  if (betterExt && !uri.toLowerCase().endsWith(betterExt)) {
    const renamed = `${cacheDir}${cacheKey}${betterExt}`;
    await FileSystem.moveAsync({ from: uri, to: renamed });
    uri = renamed;
  }

  return { uri, mimeType, isPdf, isImage };
}
