export interface Channel {
  id: string;
  name: string;
  url: string;
  logo: string;
  group: string;
  isFavorite?: boolean;
  /** Detected series base name (e.g. "Breaking Bad" from "Breaking Bad S01E01") */
  seriesName?: string;
  /** Season number if episode */
  seasonNum?: number;
  /** Episode number */
  episodeNum?: number;
  /** Content type hint derived from group/url */
  contentType?: 'live' | 'movie' | 'series';
}

export interface Category {
  name: string;
  channels: Channel[];
}

/** A single entry in the watch history */
export interface HistoryEntry {
  channelId: string;
  name: string;
  url: string;
  logo: string;
  group: string;
  contentType?: Channel['contentType'];
  watchedAt: number; // Date.now()
}

export interface ContinueWatchingEntry {
  channelId: string;
  name: string;
  url: string;
  logo: string;
  group: string;
  contentType?: Channel['contentType'];
  seriesName?: string;
  seasonNum?: number;
  episodeNum?: number;
  progress: number;
  duration: number;
  percentage: number;
  updatedAt: number;
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'error' | 'recovering';

