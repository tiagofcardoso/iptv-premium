/**
 * The local CORS proxy address.
 * In development, runs on port 3001.
 * In production, points to a public URL (e.g. Render) via VITE_PROXY_URL.
 */
export const PROXY_BASE = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';

/**
 * Wraps a stream URL through the local proxy to bypass CORS restrictions.
 * Only wraps http/https URLs — leaves blob: and local file: URLs untouched.
 */
export function proxyUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('blob:') || url.startsWith('file:')) return url;
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) return url;
  return `${PROXY_BASE}/proxy/stream?url=${encodeURIComponent(url)}`;
}

/**
 * Wraps an M3U playlist URL through the local proxy.
 * The proxy fetches the playlist server-side and rewrites all stream URLs
 * inside it to also go through the proxy.
 */
export function proxyM3uUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith('blob:') || url.startsWith('file:')) return url;
  return `${PROXY_BASE}/proxy/m3u?url=${encodeURIComponent(url)}`;
}
