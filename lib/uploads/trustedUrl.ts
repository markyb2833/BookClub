const LOCAL_UPLOAD_RE = /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpe?g|png|gif|webp)$/i;

/** True if URL was produced by our upload pipeline (local path or configured public object base). */
export function isTrustedUploadUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (LOCAL_UPLOAD_RE.test(u)) return true;
  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (base && u.startsWith(`${base}/`)) return true;
  return false;
}

export function assertTrustedUploadUrls(urls: string[]): string[] {
  return urls.filter(isTrustedUploadUrl);
}
