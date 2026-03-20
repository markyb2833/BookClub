/** Client-uploaded shelf ornament images: data URLs only (no remote fetch). */

const DATA_IMAGE_PREFIX = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;

const MAX_APPROX_BYTES = 160_000;

export function validateOrnamentDataImageUrl(url: string): string | null {
  if (!DATA_IMAGE_PREFIX.test(url)) {
    return "Use a PNG, JPEG, GIF, or WebP image.";
  }
  const comma = url.indexOf(",");
  if (comma < 0) return "Invalid image data.";
  const b64 = url.slice(comma + 1).replace(/\s/g, "");
  const approxBytes = (b64.length * 3) / 4;
  if (approxBytes > MAX_APPROX_BYTES) {
    return "Image is too large (try under ~120KB or a smaller file).";
  }
  return null;
}
