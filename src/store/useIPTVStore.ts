import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Channel, Category, HistoryEntry, ContinueWatchingEntry } from '../types/index.ts';
import { groupByCategory } from '../utils/m3uParser.ts';

interface IPTVState {
  // Data
  channels: Channel[];
  categories: Category[];
  currentChannel: Channel | null;
  activeCategory: string | null;
  searchQuery: string;
  playlistUrl: string;
  history: HistoryEntry[];
  continueWatching: ContinueWatchingEntry[];
  isAutoLoading: boolean;
  tmdbApiKey: string;

  // Actions
  setChannels: (channels: Channel[], url: string) => void;
  setCurrentChannel: (channel: Channel) => void;
  setActiveCategory: (name: string | null) => void;
  setSearchQuery: (q: string) => void;
  toggleFavorite: (channelId: string) => void;
  clearPlaylist: () => void;
  setAutoLoading: (v: boolean) => void;
  addToHistory: (channel: Channel) => void;
  removeFromHistory: (channelId: string) => void;
  clearHistory: () => void;
  saveProgress: (channel: Channel, progress: number, duration: number) => void;
  removeFromContinueWatching: (channelId: string) => void;
  setTmdbApiKey: (key: string) => void;
}

export const useIPTVStore = create<IPTVState>()(
  persist(
    (set, get) => ({
      channels: [],
      categories: [],
      currentChannel: null,
      activeCategory: null,
      searchQuery: '',
      playlistUrl: '',
      history: [],
      continueWatching: [],
      isAutoLoading: false,
      tmdbApiKey: '',

      setChannels: (rawChannels, url) => {
        const { channels: existing } = get();
        // Merge favorites from existing channels
        const favMap = new Map(existing.map(c => [c.id, c.isFavorite ?? false]));
        const merged = rawChannels.map(c => ({
          ...c,
          isFavorite: favMap.get(c.id) ?? false,
        }));
        set({
          channels: merged,
          categories: groupByCategory(merged),
          playlistUrl: url,
          activeCategory: null,
          currentChannel: null,
          isAutoLoading: false,
        });
      },

      setCurrentChannel: (channel) => {
        set({ currentChannel: channel });
        // Auto-add to history
        get().addToHistory(channel);
      },

      setActiveCategory: (name) => set({ activeCategory: name }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setAutoLoading: (v) => set({ isAutoLoading: v }),

      toggleFavorite: (channelId) => {
        const updated = get().channels.map(c =>
          c.id === channelId ? { ...c, isFavorite: !c.isFavorite } : c
        );
        set({
          channels: updated,
          categories: groupByCategory(updated),
          currentChannel:
            get().currentChannel?.id === channelId
              ? { ...get().currentChannel!, isFavorite: !get().currentChannel!.isFavorite }
              : get().currentChannel,
        });
      },

      clearPlaylist: () =>
        set({
          channels: [],
          categories: [],
          currentChannel: null,
          activeCategory: null,
          playlistUrl: '',
          searchQuery: '',
        }),

      addToHistory: (channel) => {
        const existing = get().history.filter(h => h.channelId !== channel.id);
        const entry: HistoryEntry = {
          channelId: channel.id,
          name: channel.name,
          url: channel.url,
          logo: channel.logo,
          group: channel.group,
          contentType: channel.contentType,
          watchedAt: Date.now(),
        };
        // Keep max 50 items, most recent first
        set({ history: [entry, ...existing].slice(0, 50) });
      },

      removeFromHistory: (channelId) => {
        set({ history: get().history.filter(h => h.channelId !== channelId) });
      },

      clearHistory: () => set({ history: [] }),

      saveProgress: (channel, progress, duration) => {
        const percentage = duration > 0 ? Math.round((progress / duration) * 100) : 0;
        const existing = get().continueWatching.filter(c => c.channelId !== channel.id);
        const entry: ContinueWatchingEntry = {
          channelId: channel.id,
          name: channel.name,
          url: channel.url,
          logo: channel.logo,
          group: channel.group,
          contentType: channel.contentType,
          seriesName: channel.seriesName,
          seasonNum: channel.seasonNum,
          episodeNum: channel.episodeNum,
          progress,
          duration,
          percentage,
          updatedAt: Date.now(),
        };
        // Keep max 50 items, most recent first
        set({ continueWatching: [entry, ...existing].slice(0, 50) });
      },

      removeFromContinueWatching: (channelId) => {
        set({ continueWatching: get().continueWatching.filter(c => c.channelId !== channelId) });
      },

      setTmdbApiKey: (key) => set({ tmdbApiKey: key }),
    }),
    {
      name: 'iptv-storage',
      // Only persist lightweight data — channels are too large (200k+)
      partialize: (state) => ({
        playlistUrl: state.playlistUrl,
        history: state.history,
        continueWatching: state.continueWatching,
        tmdbApiKey: state.tmdbApiKey,
        // Persist favorites map separately (small)
        favorites: state.channels
          .filter(c => c.isFavorite)
          .map(c => c.id),
      }),
      storage: {
        getItem: (key) => {
          try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
        setItem: (key, value) => {
          try {
            localStorage.setItem(key, JSON.stringify(value));
          } catch {
            try {
              // Strip favorites list if too large
              const slim = { ...value, state: { ...value.state, favorites: [] } };
              localStorage.setItem(key, JSON.stringify(slim));
            } catch {
              localStorage.removeItem(key);
            }
          }
        },
        removeItem: (key) => localStorage.removeItem(key),
      },
    }
  )
);

/** Retrieve the persisted favorites ID set — used on auto-reload to restore fav state */
export function getPersistedFavoriteIds(): Set<string> {
  try {
    const raw = localStorage.getItem('iptv-storage');
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    const favs: string[] = parsed?.state?.favorites ?? [];
    return new Set(favs);
  } catch {
    return new Set();
  }
}
