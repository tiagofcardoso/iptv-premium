import type { Channel, Category } from '../types/index.ts';
import { proxyM3uUrl } from './proxy.ts';

/**
 * Generates a stable unique ID for each channel based on its URL.
 */
function generateId(url: string, name: string): string {
  const str = `${name}-${url}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Normalises a stream URL for maximum browser compatibility.
 * ONLY converts Xtream Codes live stream .ts URLs → .m3u8 so HLS.js gets a proper manifest.
 * Does NOT touch movie/series URLs (they have /movie/ or /series/ in the path).
 */
function normalizeStreamUrl(url: string): string {
  if (!url) return url;
  const lower = url.toLowerCase();
  // Only rewrite if it's a live Xtream stream (NOT a movie or series)
  // Pattern: /user/pass/ID.ts  (exactly 2 path segments before the file)
  if (
    /\/[^/]+\/[^/]+\/\d+\.ts(\?.*)?$/.test(lower) &&
    !lower.includes('/movie/') &&
    !lower.includes('/series/')
  ) {
    return url.replace(/\.ts(\?.*)?$/i, '.m3u8');
  }
  return url;
}

/** Normalize accents: "SÉRIES" → "SERIES", "FILMES" → "FILMES" */
function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Detect content type from group-title and URL patterns */
function detectContentType(group: string, url: string): Channel['contentType'] {
  const u = url.toLowerCase().split('?')[0]; // strip query string for path matching
  const g = stripAccents(group.toLowerCase()); // normalize accents for matching

  // URL path takes priority — Xtream Codes standard paths
  if (u.includes('/movie/')) return 'movie';
  if (u.includes('/series/')) return 'series';

  // Group name fallback: if the group indicates a live channel category containing movies/series, treat as live
  if (
    g.includes('filmes e series') ||
    g.includes('filmes & series') ||
    g.includes('filme e serie') ||
    g.includes('filme & serie') ||
    g.includes('canais') ||
    g.includes('live')
  ) {
    return 'live';
  }

  // Group name fallback (accent-normalized)
  if (g.includes('film') || g.includes('movie') || g.includes('filme') || g.includes('cinema')) return 'movie';
  if (
    g.includes('serie') || g.includes('season') || g.includes('temporada') ||
    /s\d+e\d+/i.test(g) || /s\d+e\d+/i.test(u)
  ) return 'series';

  return 'live';
}

/** Extract series name, season and episode number from an episode title */
function extractSeriesInfo(name: string): {
  seriesName?: string;
  seasonNum?: number;
  episodeNum?: number;
} {
  // Pattern: "Name S01E02" or "Name 1x02" or "Name T01E02"
  const m1 = name.match(/^(.+?)\s+[ST](\d+)\s*[EXx](\d+)/i);
  if (m1) return { seriesName: m1[1].trim(), seasonNum: +m1[2], episodeNum: +m1[3] };

  // Pattern: "Name - Temporada 1 Episodio 2" (Portuguese)
  const m2 = name.match(/^(.+?)\s+-\s+[Tt]emporada\s*(\d+)\s+[Ee]pis[oó]dio\s*(\d+)/i);
  if (m2) return { seriesName: m2[1].trim(), seasonNum: +m2[2], episodeNum: +m2[3] };

  // Pattern: "Name - Episodio 2" (no season)
  const m3 = name.match(/^(.+?)\s+-\s+[Ee]pis[oó]dio\s*(\d+)/i);
  if (m3) return { seriesName: m3[1].trim(), episodeNum: +m3[2] };

  return {};
}

export function parseM3U(content: string): Channel[] {
  const channels: Channel[] = [];
  let pos = 0;
  const len = content.length;
  let currentExtinf = '';

  while (pos < len) {
    let nextNL = content.indexOf('\n', pos);
    if (nextNL === -1) nextNL = len;

    const line = content.substring(pos, nextNL).trim();
    pos = nextNL + 1;

    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      currentExtinf = line;
    } else if (!line.startsWith('#')) {
      if (currentExtinf) {
        const logoMatch = currentExtinf.match(/tvg-logo="([^"]*)"/i);
        const logo = logoMatch ? logoMatch[1] : '';

        const groupMatch = currentExtinf.match(/group-title="([^"]*)"/i);
        const group = groupMatch ? groupMatch[1].trim() : 'Uncategorized';

        const nameMatch = currentExtinf.match(/,(.+)$/);
        const name = nameMatch ? nameMatch[1].trim() : 'Unknown Channel';

        const normalizedUrl = normalizeStreamUrl(line);
        const contentType = detectContentType(group, normalizedUrl);
        const seriesInfo = contentType === 'series' ? extractSeriesInfo(name) : {};

        channels.push({
          id: generateId(normalizedUrl, name),
          name,
          url: normalizedUrl,
          logo,
          group: group || 'Uncategorized',
          isFavorite: false,
          contentType,
          ...seriesInfo,
        });

        currentExtinf = '';
      }
    }
  }

  return channels;
}

/**
 * Groups a flat array of channels by their `group` field.
 */
export function groupByCategory(channels: Channel[]): Category[] {
  const map = new Map<string, Channel[]>();

  for (const channel of channels) {
    const key = channel.group;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(channel);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, chs]) => ({ name, channels: chs }));
}

/**
 * Fetches an M3U playlist from a URL.
 *
 * CORS NOTE: Many IPTV providers do NOT set permissive CORS headers.
 * If fetching fails due to CORS, consider:
 *   1. Using a CORS proxy like https://corsproxy.io/?<YOUR_URL>
 *   2. Or https://api.allorigins.win/raw?url=<encodeURIComponent(YOUR_URL)>
 *   3. Running a local proxy server (e.g. with `nginx` or a simple Express proxy)
 * The user-facing error message should guide them accordingly.
 */
export async function fetchM3U(url: string): Promise<Channel[]> {
  // Use our own proxy to avoid HTTPS Mixed Content blocks and CORS issues
  let response: Response;
  try {
    const proxied = proxyM3uUrl(url);
    response = await fetch(proxied, { signal: AbortSignal.timeout(30_000) });
  } catch {
    // Fallback to corsproxy.io if our proxy is unreachable
    const proxied = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    response = await fetch(proxied, { signal: AbortSignal.timeout(30_000) });
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch playlist: HTTP ${response.status}`);
  }

  const text = await response.text();

  if (!text.includes('#EXTM3U')) {
    throw new Error('The URL does not appear to be a valid M3U playlist.');
  }

  return parseM3U(text);
}
