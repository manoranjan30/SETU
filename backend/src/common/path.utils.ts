/**
 * Normalises a photo/file URL coming from any client (web or Flutter mobile)
 * so that only the relative pathname is stored in the database.
 *
 * Problem this solves:
 *   The Flutter app resolves every uploaded file path to an absolute URL
 *   (e.g. http://10.0.2.2:3000/uploads/uuid.jpg) before sending it to the
 *   backend.  The web client may also send absolute URLs from copy-paste or
 *   re-submissions.  Storing the absolute URL breaks images whenever the host,
 *   port, or tunnel address changes.
 *
 * After normalisation all paths are stored as  /uploads/<filename>
 * The frontend / Flutter app then prepends its own server origin at display time.
 */
export function toRelativePath(url: string): string {
  if (!url) return url;

  // Already an absolute HTTP(S) URL → extract just the pathname
  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  // Disk path stored by multer: "uploads/uuid.jpg"  (no leading slash)
  // Normalise to "/uploads/uuid.jpg"
  if (url.startsWith('uploads/')) {
    return '/' + url;
  }

  // Already relative with leading slash:  "/uploads/uuid.jpg"  → keep as-is
  return url;
}

/** Normalises an array of photo URLs, skipping null/undefined entries. */
export function toRelativePaths(urls: string[] | null | undefined): string[] {
  if (!Array.isArray(urls)) return [];
  return urls.map(toRelativePath).filter(Boolean);
}
