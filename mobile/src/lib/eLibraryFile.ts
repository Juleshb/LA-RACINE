import * as FileSystem from 'expo-file-system/legacy';
import { api } from './api';

function extensionFor(item: {
  fileName?: string | null;
  mimeType?: string | null;
  isPdf?: boolean;
  isImage?: boolean;
}, contentType?: string | null): string {
  const fromName = item.fileName?.match(/\.[a-z0-9]+$/i)?.[0];
  if (fromName) return fromName.toLowerCase();

  const mime = (contentType || item.mimeType || '').toLowerCase();
  if (item.isPdf || mime.includes('pdf')) return '.pdf';
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('msword')) return '.doc';
  if (mime.includes('wordprocessingml')) return '.docx';
  if (mime.includes('spreadsheetml')) return '.xlsx';
  if (mime.includes('presentationml')) return '.pptx';
  if (item.isImage) return '.jpg';
  return '';
}

export type DownloadedLibraryFile = {
  uri: string;
  mimeType: string;
  isPdf: boolean;
  isImage: boolean;
};

/**
 * Download an e-library file with auth headers into the app cache.
 * Returns a local file:// URI suitable for Image / WebView / Sharing.
 */
export async function downloadELibraryFile(
  id: string,
  item: {
    fileName?: string | null;
    mimeType?: string | null;
    isPdf?: boolean;
    isImage?: boolean;
  } = {},
): Promise<DownloadedLibraryFile> {
  const source = await api.getELibraryFileSource(id);
  if (!source?.uri || !/^https?:\/\//i.test(source.uri)) {
    throw new Error('Invalid book download address');
  }

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Device storage is not available for downloads');
  }

  const ext = extensionFor(item);
  const target = `${cacheDir}elibrary-${id}${ext || '.bin'}`;

  // Remove stale cache so mime/extension changes don't leave a bad file
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
        ? 'Please sign in again to open this book'
        : downloaded.status === 404
          ? 'File not found on the server'
          : `Could not download file (${downloaded.status})`,
    );
  }

  const headerMime =
    downloaded.headers?.['Content-Type'] ||
    downloaded.headers?.['content-type'] ||
    '';
  const mimeType = String(headerMime || item.mimeType || 'application/octet-stream').split(';')[0].trim();
  const isPdf = item.isPdf || mimeType === 'application/pdf' || downloaded.uri.toLowerCase().endsWith('.pdf');
  const isImage =
    item.isImage ||
    mimeType.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp)$/i.test(downloaded.uri);

  // If we guessed the wrong extension, rename once we know the content type
  const betterExt = extensionFor({ ...item, mimeType, isPdf, isImage }, mimeType);
  let uri = downloaded.uri;
  if (betterExt && !uri.toLowerCase().endsWith(betterExt)) {
    const renamed = `${cacheDir}elibrary-${id}${betterExt}`;
    await FileSystem.moveAsync({ from: uri, to: renamed });
    uri = renamed;
  }

  return { uri, mimeType, isPdf, isImage };
}
