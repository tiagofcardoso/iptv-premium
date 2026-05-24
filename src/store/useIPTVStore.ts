import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Channel, Category, HistoryEntry, ContinueWatchingEntry } from '../types/index.ts';
import { groupByCategory } from '../utils/m3uParser.ts';

interface IPTVState {
  // Data
  channels: Channel[];
  liveChannels: Channel[];
  movieChannels: Channel[];
  seriesChannels: Channel[];
  favoriteList: Channel[];
  categories: Category[];
  liveCategories: Category[];
  movieCategories: Category[];
  seriesCategories: Category[];
  idMap: Record<string, Channel>;
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
  setCurrentChannel: (channel: Channel | null) => void;
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
      liveChannels: [],
      movieChannels: [],
      seriesChannels: [],
      favoriteList: [],
      categories: [],
      liveCategories: [],
      movieCategories: [],
      seriesCategories: [],
      idMap: {},
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
        const favMap = new Map(existing.map(c => [c.id, c.isFavorite ?? false]));
        
        const liveChannels: Channel[] = [];
        const movieChannels: Channel[] = [];
        const seriesChannels: Channel[] = [];
        const favoriteList: Channel[] = [];
        const idMap: Record<string, Channel> = {};

        for (const c of rawChannels) {
          c.isFavorite = favMap.get(c.id) ?? false;
          idMap[c.id] = c;
          
          if (c.isFavorite) {
            favoriteList.push(c);
          }

          if (c.contentType === 'movie') {
            movieChannels.push(c);
          } else if (c.contentType === 'series') {
            seriesChannels.push(c);
          } else {
            liveChannels.push(c);
          }
        }

        const liveCategories = groupByCategory(liveChannels);
        const movieCategories = groupByCategory(movieChannels);
        const seriesCategories = groupByCategory(seriesChannels);

        const categories = [
          ...liveCategories,
          ...movieCategories,
          ...seriesCategories
        ].sort((a, b) => a.name.localeCompare(b.name));

        set({
          channels: rawChannels,
          liveChannels,
          movieChannels,
          seriesChannels,
          favoriteList,
          categories,
          liveCategories,
          movieCategories,
          seriesCategories,
          idMap,
          playlistUrl: url,
          activeCategory: null,
          currentChannel: null,
          isAutoLoading: false,
        });
      },

      setCurrentChannel: (channel) => {
        set({ currentChannel: channel });
        if (channel) {
          get().addToHistory(channel);
        }
      },

      setActiveCategory: (name) => set({ activeCategory: name }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setAutoLoading: (v) => set({ isAutoLoading: v }),

      toggleFavorite: (channelId) => {
        const { channels, liveChannels, movieChannels, seriesChannels, favoriteList, idMap } = get();
        const item = idMap[channelId];
        if (!item) return;

        item.isFavorite = !item.isFavorite;

        let updatedFavs = [...favoriteList];
        if (item.isFavorite) {
          if (!updatedFavs.some(c => c.id === channelId)) {
            updatedFavs.push(item);
          }
        } else {
          updatedFavs = updatedFavs.filter(c => c.id !== channelId);
        }

        set({
          channels: [...channels],
          liveChannels: [...liveChannels],
          movieChannels: [...movieChannels],
          seriesChannels: [...seriesChannels],
          favoriteList: updatedFavs,
          liveCategories: [...get().liveCategories],
          movieCategories: [...get().movieCategories],
          seriesCategories: [...get().seriesCategories],
          currentChannel:
            get().currentChannel?.id === channelId
              ? { ...get().currentChannel!, isFavorite: item.isFavorite }
              : get().currentChannel,
        });
      },

      clearPlaylist: () =>
        set({
          channels: [],
          liveChannels: [],
          movieChannels: [],
          seriesChannels: [],
          favoriteList: [],
          categories: [],
          liveCategories: [],
          movieCategories: [],
          seriesCategories: [],
          idMap: {},
          currentChannel: null,
          activeCategory: null,
          playlistUrl: '',
          searchQuery: '',
        }),

      addToHistory: (channel) => {
        if (!channel) return;
        const existing = get().history.filter(h => h && h.channelId !== channel.id);
        const entry: HistoryEntry = {
          channelId: channel.id,
          name: channel.name,
          url: channel.url,
          logo: channel.logo,
          group: channel.group,
          contentType: channel.contentType,
          watchedAt: Date.now(),
        };
        set({ history: [entry, ...existing].slice(0, 50) });
      },

      removeFromHistory: (channelId) => {
        set({ history: get().history.filter(h => h.channelId !== channelId) });
      },

      clearHistory: () => set({ history: [] }),

      saveProgress: (channel, progress, duration) => {
        if (!channel) return;
        const percentage = duration > 0 ? Math.round((progress / duration) * 100) : 0;
        const existing = get().continueWatching.filter(c => c && c.channelId !== channel.id);
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
        set({ continueWatching: [entry, ...existing].slice(0, 50) });
      },

      removeFromContinueWatching: (channelId) => {
        set({ continueWatching: get().continueWatching.filter(c => c.channelId !== channelId) });
      },

      setTmdbApiKey: (key) => set({ tmdbApiKey: key }),
    }),
    {
      name: 'iptv-storage',
      partialize: (state) => ({
        playlistUrl: state.playlistUrl,
        history: state.history,
        continueWatching: state.continueWatching,
        tmdbApiKey: state.tmdbApiKey,
        favorites: state.favoriteList.map(c => c.id),
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
