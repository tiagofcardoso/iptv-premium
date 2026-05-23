export interface TMDBMetadata {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  releaseDate: string;
  cast: { name: string; character: string; profilePath: string | null }[];
}

// Memory and LocalStorage caching
const CACHE_KEY = 'iptv-tmdb-cache-v1';
let tmdbCache: Record<string, TMDBMetadata> = {};

try {
  const raw = localStorage.getItem(CACHE_KEY);
  if (raw) {
    tmdbCache = JSON.parse(raw);
  }
} catch (e) {
  console.warn('Failed to load TMDB cache from localStorage:', e);
}

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(tmdbCache));
  } catch (e) {
    console.warn('TMDB Cache write failed (likely quota limit exceeded):', e);
  }
}

/**
 * Cleans IPTV filenames/titles to improve match accuracy on TMDB search.
 * Removes quality tags (4K, 1080p, FHD), years, languages, extensions, etc.
 */
export function cleanTitle(title: string): string {
  if (!title) return '';
  let cleaned = title;

  // 1. Remove text inside brackets [FHD] or parentheses (2024)
  cleaned = cleaned.replace(/\[[^\]]+\]/g, ' ');
  cleaned = cleaned.replace(/\([^)]+\)/g, ' ');

  // 2. Remove video quality markers
  const qualityMarkers = [
    /\b4k\b/i, /\b2k\b/i, /\buhd\b/i, /\bfhd\b/i, /\bhd\b/i, /\bsd\b/i,
    /\b1080p\b/i, /\b720p\b/i, /\b480p\b/i, /\b2160p\b/i,
  ];
  for (const marker of qualityMarkers) {
    cleaned = cleaned.replace(marker, ' ');
  }

  // 3. Remove audio & release type tags (common in Portuguese/Latin playlists)
  const tagMarkers = [
    /\bdublado\b/i, /\blegendado\b/i, /\bdual\b/i, /\bmulti\b/i, /\baudio\b/i,
    /\bnacional\b/i, /\bpt[-_]br\b/i, /\bpt[-_]pt\b/i, /\bleg\b/i,
    /\bh264\b/i, /\bx264\b/i, /\bh265\b/i, /\bx265\b/i, /\bhevc\b/i,
    /\bbluray\b/i, /\bweb[-_]dl\b/i, /\bwebrip\b/i, /\bhdrip\b/i, /\bdvdrip\b/i,
    /\byts\b/i, /\bimax\b/i, /\b3d\b/i,
  ];
  for (const marker of tagMarkers) {
    cleaned = cleaned.replace(marker, ' ');
  }

  // 4. Remove common IPTV prefixes/suffixes
  cleaned = cleaned.replace(/\b(filme|filmes|series?|série|assistir|completo)\b/i, ' ');

  // 5. Remove year if it is at the end (e.g. "Movie Name 2023")
  cleaned = cleaned.replace(/\b(19|20)\d{2}\b/g, ' ');

  // 6. Clean up multiple spaces, dots, dashes
  cleaned = cleaned.replace(/[\.\-_]/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/\s*-\s*$/, ''); // trailing dash
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Searches TMDB for a movie or TV series metadata.
 * Uses a local cache to prevent redundant API queries.
 */
export async function getTMDBMetadata(
  name: string,
  type: 'movie' | 'series',
  apiKey?: string
): Promise<TMDBMetadata | null> {
  if (!name) return null;

  const cleaned = cleanTitle(name);
  if (!cleaned) return null;

  const cacheKeyStr = `${type}:${cleaned.toLowerCase()}`;
  if (tmdbCache[cacheKeyStr]) {
    return tmdbCache[cacheKeyStr];
  }

  // Use provided key, or fallback to the default key
  const activeKey = apiKey?.trim() || '7de069975588ac8f935af558ce60c134';

  try {
    // 1. Search TMDB
    const searchUrl = type === 'movie'
      ? `https://api.themoviedb.org/3/search/movie?api_key=${activeKey}&query=${encodeURIComponent(cleaned)}&language=pt-BR`
      : `https://api.themoviedb.org/3/search/tv?api_key=${activeKey}&query=${encodeURIComponent(cleaned)}&language=pt-BR`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      // If unauthorized (invalid API key), we don't cache this error permanently
      if (searchRes.status === 401) {
        console.warn('TMDB API unauthorized: check API key');
        return null;
      }
      return null;
    }

    const searchData = await searchRes.json();
    const result = searchData.results?.[0];

    if (!result) {
      // Cache failure as null to avoid searching again for non-existent titles
      (tmdbCache as any)[cacheKeyStr] = null;
      saveCache();
      return null;
    }

    const id = result.id;

    // 2. Fetch full details including credits/cast
    const detailUrl = type === 'movie'
      ? `https://api.themoviedb.org/3/movie/${id}?api_key=${activeKey}&language=pt-BR&append_to_response=credits`
      : `https://api.themoviedb.org/3/tv/${id}?api_key=${activeKey}&language=pt-BR&append_to_response=credits`;

    const detailRes = await fetch(detailUrl);
    if (!detailRes.ok) return null;
    const detailData = await detailRes.json();

    const cast = (detailData.credits?.cast || [])
      .slice(0, 10)
      .map((c: any) => ({
        name: c.name,
        character: c.character,
        profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
      }));

    const metadata: TMDBMetadata = {
      id,
      title: type === 'movie' ? detailData.title : detailData.name,
      overview: detailData.overview || 'Nenhuma sinopse disponível em português.',
      posterPath: detailData.poster_path ? `https://image.tmdb.org/t/p/w500${detailData.poster_path}` : null,
      backdropPath: detailData.backdrop_path ? `https://image.tmdb.org/t/p/original${detailData.backdrop_path}` : null,
      voteAverage: detailData.vote_average || 0,
      releaseDate: type === 'movie' ? detailData.release_date : detailData.first_air_date,
      cast,
    };

    tmdbCache[cacheKeyStr] = metadata;
    saveCache();
    return metadata;
  } catch (e) {
    console.error('TMDB API error fetching metadata for:', name, e);
    return null;
  }
}
