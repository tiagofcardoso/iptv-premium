import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronRight, Play, Heart, ArrowLeft, Tv, Folder, Star, Search, X } from 'lucide-react';
import type { Channel, Category, ContinueWatchingEntry } from '../types/index.ts';
import { useIPTVStore } from '../store/useIPTVStore.ts';
import { getTMDBMetadata, cleanTitle, getCachedTMDBMetadata } from '../utils/tmdb.ts';
import DetailModal from './DetailModal.tsx';

interface ContentBrowserProps {
  section: 'live' | 'movies' | 'series';
  onBack: () => void;
  onSelectChannel: (channel: Channel) => void;
}

const TITLE_MAP = { live: 'TV AO VIVO', movies: 'FILMES', series: 'SÉRIES' };
const FAVS_KEY = '__FAVORITOS__';

interface EPGInfo {
  programTitle: string;
  progress: number; // 0 to 100
}

export function getEPGInfo(channelName: string, channelId: string): EPGInfo {
  const seed = (channelName + channelId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Helper to generate a pseudorandom number between 0 and max-1 based on hour + seed
  const getIndex = (arrLength: number) => {
    return Math.abs((seed + currentHour * 3) % arrLength);
  };

  const nameUpper = channelName.toUpperCase();

  let programTitle = '';
  let duration = 60; // in minutes

  if (nameUpper.includes('ESPN') || nameUpper.includes('SPORT') || nameUpper.includes('PPV') || nameUpper.includes('PFC') || nameUpper.includes('PREMIERE') || nameUpper.includes('COMBATE') || nameUpper.includes('DAZN') || nameUpper.includes('VIVO')) {
    const sports = [
      'AO VIVO: NBA Play-offs',
      'Ceará x Fortaleza',
      'AO VIVO: Premier League',
      'Fórmula 1: GP de Mónaco',
      'Liga dos Campeões: Directo',
      'Grande Debate do Futebol',
      'UFC Fight Night: Pesagem Oficial',
      'Copa Libertadores: Especial',
      'AO VIVO: Torneio de Roland Garros',
      'Liga Portugal: Antevisão da Jornada'
    ];
    programTitle = sports[getIndex(sports.length)];
    duration = 120;
  } else if (nameUpper.includes('HBO') || nameUpper.includes('TELECINE') || nameUpper.includes('CINEMAX') || nameUpper.includes('FILMES') || nameUpper.includes('FX') || nameUpper.includes('AXN')) {
    const movies = [
      'Dune: Parte Dois',
      'Oppenheimer',
      'Barbie: O Filme',
      'Tudo em Todo o Lado ao Mesmo Tempo',
      'Avatar: O Caminho da Água',
      'Top Gun: Maverick',
      'John Wick: Capítulo 4',
      'Batman: O Cavaleiro das Trevas',
      'Gladiador',
      'Interestelar'
    ];
    programTitle = movies[getIndex(movies.length)];
    duration = 150;
  } else if (nameUpper.includes('DISNEY') || nameUpper.includes('NICK') || nameUpper.includes('CARTOON') || nameUpper.includes('GLOOB') || nameUpper.includes('KIDS') || nameUpper.includes('PANDA')) {
    const kids = [
      'SpongeBob SquarePants',
      'Patrulha Pata: Missões Especiais',
      'Jovens Titãs em Ação!',
      'O Incrível Mundo de Gumball',
      'Miraculous: As Aventuras de Ladybug',
      'Phineas e Ferb',
      'Tom e Jerry',
      'Masha e o Urso',
      'Gravity Falls',
      'Peppa Pig'
    ];
    programTitle = kids[getIndex(kids.length)];
    duration = 30;
  } else if (nameUpper.includes('DISCOVERY') || nameUpper.includes('HISTORY') || nameUpper.includes('GEOGRAPHIC') || nameUpper.includes('DOCS') || nameUpper.includes('SCIENCE')) {
    const docs = [
      'Planeta Terra III',
      'Alienígenas do Passado',
      'Trato Feito: Vegas',
      'Desafio em Dose Dupla',
      'O Cosmos e Além',
      'Segredos da História Antiga',
      'Maravilhas da Engenharia Moderna',
      'Veterinário de Província',
      'Como Funciona o Universo',
      'Mega Construções'
    ];
    programTitle = docs[getIndex(docs.length)];
    duration = 60;
  } else if (nameUpper.includes('CNN') || nameUpper.includes('NEWS') || nameUpper.includes('JORNAL') || nameUpper.includes('BANDNEWS') || nameUpper.includes('RTP3') || nameUpper.includes('SIC NOTICIAS') || nameUpper.includes('CNN PORTUGAL')) {
    const news = [
      'Edição da Manhã',
      'Grande Painel Político',
      'Jornal de Notícias Directo',
      'Mundo em Foco',
      'Radar de Notícias Regionais',
      'Opinião Pública',
      'CNN Directo',
      'Jornal das 20h',
      'Especial Economia',
      'Olhar Global'
    ];
    programTitle = news[getIndex(news.length)];
    duration = 60;
  } else {
    const general = [
      'Show da Tarde: Variedades',
      'Cine Espetacular',
      'Conversa Aberta com Convidados',
      'Grandes Mistérios da Ciência',
      'Música de Sempre: Hits',
      'Programa da Tarde',
      'Novela da Tarde: Paixões Ardentes',
      'Reality Show: Sobrevivência',
      'Estúdio Aberto',
      'Repórter Especial'
    ];
    programTitle = general[getIndex(general.length)];
    duration = 60;
  }

  // Calculate realistic progress based on current minutes and a seed offset
  const offset = seed % 20; // 0-19 minute shift so channels aren't aligned
  const elapsed = (currentMinute + offset) % duration;
  const progress = Math.min(Math.round((elapsed / duration) * 100), 100);

  return { programTitle, progress };
}

const isReleasesCategory = (name: string): boolean => {
  const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return norm.includes("lancamento");
};

const is4KCategory = (name: string): boolean => {
  const norm = name.toLowerCase();
  return norm.includes("4k") || norm.includes("ultra hd") || norm.includes("uhd");
};

// ─── Long-press hook ──────────────────────────────────────────────────────────
function useLongPress(callback: () => void, onClickAction?: (e: any) => void, ms = 600) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressActive = useRef(false);
  const startTime = useRef<number>(0);
  const startX = useRef<number>(0);
  const startY = useRef<number>(0);
  const hasMovedSignificant = useRef<boolean>(false);
  const lastTouchEnd = useRef<number>(0);

  const start = useCallback((e?: React.TouchEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e && 'key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    // Block ghost mouse events that fire right after a touch event on mobile
    if (e && e.type.startsWith('mouse') && Date.now() - lastTouchEnd.current < 1000) return;
    
    if (timerRef.current) return; // Prevent restart on key hold auto-repeat

    isLongPressActive.current = false;
    hasMovedSignificant.current = false;
    startTime.current = Date.now();

    if (e) {
      if ('touches' in e && e.touches.length > 0) {
        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
      } else if ('clientX' in e) {
        startX.current = (e as any).clientX;
        startY.current = (e as any).clientY;
      }
    }

    timerRef.current = setTimeout(() => {
      isLongPressActive.current = true;
      callback();
    }, ms);
  }, [callback, ms]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        hasMovedSignificant.current = true;
        cancel();
      }
    }
  }, [cancel]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (startTime.current > 0) {
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        hasMovedSignificant.current = true;
        cancel();
      }
    }
  }, [cancel]);

  const handleTouchCancel = useCallback(() => {
    cancel();
    hasMovedSignificant.current = true; // treat as moved to block any click
  }, [cancel]);

  const end = useCallback((e?: React.TouchEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e && 'key' in e && e.key !== 'Enter' && e.key !== ' ') return;
    if (e && e.type === 'touchend') lastTouchEnd.current = Date.now();
    
    cancel();

    let finalMoved = hasMovedSignificant.current;
    if (e && !finalMoved) {
      let clientX = 0;
      let clientY = 0;
      if ('changedTouches' in e && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as any).clientX;
        clientY = (e as any).clientY;
      }
      if (clientX || clientY) {
        const dx = clientX - startX.current;
        const dy = clientY - startY.current;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 10) {
          finalMoved = true;
        }
      }
    }

    if (finalMoved) {
      hasMovedSignificant.current = false;
      return;
    }

    const duration = Date.now() - startTime.current;
    
    // If it was a short click and not triggered by a long press context menu:
    if (!isLongPressActive.current && startTime.current > 0 && duration < ms) {
      startTime.current = 0; // Reset
      if (onClickAction) {
        onClickAction(e);
      }
    }
  }, [cancel, onClickAction, ms]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isLongPressActive.current = true;
    cancel();
    callback();
  }, [callback, cancel]);

  const handlePreventClick = useCallback((e: React.MouseEvent) => {
    // Intercept standard click events to prevent immediate double activation on TV remotes
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return { 
    onMouseDown: start, 
    onMouseUp: end, 
    onMouseMove: handleMouseMove,
    onMouseLeave: cancel, 
    onTouchStart: start, 
    onTouchEnd: end, 
    onTouchMove: handleTouchMove,
    onTouchCancel: handleTouchCancel,
    onKeyDown: start,
    onKeyUp: end,
    onContextMenu: handleContextMenu,
    onClick: handlePreventClick
  };
}

// ─── Fav Context Menu ─────────────────────────────────────────────────────────
const FavContextMenu: React.FC<{
  isFav: boolean;
  name: string;
  onToggle: () => void;
  onClose: () => void;
}> = ({ isFav, name, onToggle, onClose }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [onClose]);

  // Auto-focus the action button when context menu mounts so it highlights instantly
  useEffect(() => {
    setTimeout(() => {
      buttonRef.current?.focus();
    }, 150);
  }, []);

  return (
    <>
      {/* backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      {/* menu */}
      <div id="fav-context-menu" className="fixed left-1/2 bottom-8 -translate-x-1/2 z-50 w-72 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-150">
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-white text-sm font-semibold truncate">{name}</p>
        </div>
        <button
          ref={buttonRef}
          className="focusable-tv w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors text-left focus:outline-none focus:bg-white/10"
          onClick={() => { onToggle(); onClose(); }}
        >
          <span className="text-lg">{isFav ? '💔' : '❤️'}</span>
          <span className="text-white text-sm">
            {isFav ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
          </span>
        </button>
      </div>
    </>
  );
};

/** Returns the most frequently occurring logo across episodes.
 * If a single logo dominates (same poster shared by episodes), that's the series poster.
 * Otherwise falls back to the first available logo.
 */
function mostCommonLogo(channels: Channel[]): string {
  const freq = new Map<string, number>();
  for (const ch of channels) {
    if (!ch.logo) continue;
    freq.set(ch.logo, (freq.get(ch.logo) ?? 0) + 1);
  }
  if (freq.size === 0) return '';
  // Return the most common logo (even if count=1, still the best we have)
  return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

// ─────────────────────────────────────────────────────────────────────────────

const ContentBrowser: React.FC<ContentBrowserProps> = ({
  section, onBack, onSelectChannel,
}) => {
  const {
    currentChannel, toggleFavorite, continueWatching, removeFromContinueWatching, tmdbApiKey,
    liveChannels, movieChannels, seriesChannels,
    liveCategories, movieCategories, seriesCategories,
    idMap
  } = useIPTVStore();
  const [selectedDetailChannel, setSelectedDetailChannel] = useState<Channel | null>(null);
  const [cacheTrigger, setCacheTrigger] = useState(0);

  useEffect(() => {
    const handleCacheUpdate = () => {
      setCacheTrigger(prev => prev + 1);
    };
    window.addEventListener('tmdb-cache-updated', handleCacheUpdate);
    return () => {
      window.removeEventListener('tmdb-cache-updated', handleCacheUpdate);
    };
  }, []);



  const continueWatchingMovies = useMemo(() => {
    return continueWatching.filter(item => item.contentType === 'movie');
  }, [continueWatching]);

  const continueWatchingSeries = useMemo(() => {
    return continueWatching.filter(item => item.contentType === 'series');
  }, [continueWatching]);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen && searchRef.current) {
      // Remove readonly and focus when the search bar opens
      searchRef.current.removeAttribute('readonly');
      searchRef.current.focus();
    }
  }, [isSearchOpen]);

  // Navigation levels
  const [activeCategory, setActiveCategory] = useState<string | null>(null); // platform/group
  const [activeShow, setActiveShow] = useState<string | null>(null);         // series show name

  // Estados e callbacks para Carregamento Progressivo (Lazy Loading)
  const [visibleLimit, setVisibleLimit] = useState(60);
  const [visibleCategoriesLimit, setVisibleCategoriesLimit] = useState(8);

  useEffect(() => {
    setVisibleLimit(60);
    setVisibleCategoriesLimit(8);
  }, [activeCategory, activeShow, search, section]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // Dispara quando o utilizador está a menos de 300px do fundo do scroll
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 300) {
      setVisibleLimit(prev => prev + 40);
      setVisibleCategoriesLimit(prev => prev + 6);
    }
  }, []);


  // Channels for this section
  const sectionChannels = useMemo(() => {
    if (section === 'live') return liveChannels;
    if (section === 'movies') return movieChannels;
    return seriesChannels;
  }, [section, liveChannels, movieChannels, seriesChannels]);

  // Categories (platforms/groups)
  const sectionCategories = useMemo(() => {
    if (section === 'live') return liveCategories;
    if (section === 'movies') {
      const releaseCats = movieCategories.filter(cat => isReleasesCategory(cat.name));
      const fourkCats = movieCategories.filter(cat => is4KCategory(cat.name));
      const otherCats = movieCategories.filter(cat => !isReleasesCategory(cat.name) && !is4KCategory(cat.name));
      const combined = [...releaseCats, ...fourkCats, ...otherCats];
      
      let cache: Record<string, any> = {};
      try {
        const raw = localStorage.getItem('iptv-tmdb-cache-v1');
        if (raw) cache = JSON.parse(raw);
      } catch (e) {
        // ignore
      }

      const getRating = (name: string): number => {
        const cleaned = cleanTitle(name);
        const key = `movie:${cleaned.toLowerCase()}`;
        return cache[key]?.voteAverage ?? 0;
      };

      return combined.map(cat => {
        const sortedChannels = [...cat.channels].sort((a, b) => {
          const ratingA = getRating(a.name);
          const ratingB = getRating(b.name);
          if (ratingB !== ratingA) {
            return ratingB - ratingA; // higher rating first
          }
          return a.name.localeCompare(b.name); // alphabetical fallback
        });
        return { ...cat, channels: sortedChannels };
      });
    }
    return seriesCategories;
  }, [section, liveCategories, movieCategories, seriesCategories, cacheTrigger]);

  // Pre-fetch TMDB metadata for the top categories to get ratings for sorting
  useEffect(() => {
    if (section !== 'movies' || !tmdbApiKey) return;

    // Prefetch first 2 categories (typically Lançamentos and 4K)
    const releaseCats = movieCategories.filter(cat => isReleasesCategory(cat.name));
    const fourkCats = movieCategories.filter(cat => is4KCategory(cat.name));
    const otherCats = movieCategories.filter(cat => !isReleasesCategory(cat.name) && !is4KCategory(cat.name));
    const combined = [...releaseCats, ...fourkCats, ...otherCats];

    const categoriesToPrefetch = combined.slice(0, 2);
    const channelsToFetch: Channel[] = [];

    let cache: Record<string, any> = {};
    try {
      const cacheRaw = localStorage.getItem('iptv-tmdb-cache-v1');
      if (cacheRaw) cache = JSON.parse(cacheRaw);
    } catch (e) {
      // ignore
    }

    for (const cat of categoriesToPrefetch) {
      for (const ch of cat.channels.slice(0, 20)) {
        const cleaned = cleanTitle(ch.name);
        const cacheKey = `movie:${cleaned.toLowerCase()}`;
        if (!(cacheKey in cache)) {
          channelsToFetch.push(ch);
        }
      }
    }

    if (channelsToFetch.length === 0) return;

    let active = true;
    const fetchAll = async () => {
      // Fetch up to 20 in parallel
      const batch = channelsToFetch.slice(0, 20);
      await Promise.all(
        batch.map(async (ch) => {
          if (!active) return;
          try {
            await getTMDBMetadata(ch.name, 'movie', tmdbApiKey);
          } catch (e) {
            console.error('Failed to prefetch TMDB metadata:', ch.name, e);
          }
        })
      );
    };

    fetchAll();

    return () => {
      active = false;
    };
  }, [section, movieCategories, tmdbApiKey]);

  // Favorites in this section
  const favoriteChannels = useMemo(() => {
    const list: Channel[] = [];
    for (const c of sectionChannels) {
      if (c.isFavorite) {
        list.push(c);
      }
    }
    return list;
  }, [sectionChannels]);

  // Series within active category — grouped by show name
  const showsInCategory = useMemo(() => {
    if (section !== 'series' || !activeCategory) return [];
    
    let src: Channel[] = [];
    if (activeCategory === FAVS_KEY) {
      src = favoriteChannels;
    } else {
      const cat = sectionCategories.find(c => c.name === activeCategory);
      src = cat ? cat.channels : [];
    }

    const map = new Map<string, Channel[]>();
    for (const ch of src) {
      const key = ch.seriesName ?? ch.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ch);
    }

    let cache: Record<string, any> = {};
    try {
      const raw = localStorage.getItem('iptv-tmdb-cache-v1');
      if (raw) cache = JSON.parse(raw);
    } catch (e) {
      // ignore
    }

    const getSeriesRating = (name: string): number => {
      const cleaned = cleanTitle(name);
      const key = `series:${cleaned.toLowerCase()}`;
      return cache[key]?.voteAverage ?? 0;
    };

    return Array.from(map.entries())
      .map(([name, eps]) => ({
        name,
        episodes: eps.sort((a, b) => ((a.seasonNum ?? 0) - (b.seasonNum ?? 0)) || ((a.episodeNum ?? 0) - (b.episodeNum ?? 0))),
        logo: mostCommonLogo(eps),
        isFavorite: eps.some(e => e.isFavorite),
        rating: getSeriesRating(name)
      }))
      .sort((a, b) => {
        if (b.rating !== a.rating) {
          return b.rating - a.rating; // higher rating first
        }
        return a.name.localeCompare(b.name);
      });
  }, [section, activeCategory, sectionCategories, favoriteChannels, cacheTrigger]);

  // Episodes of active show
  const episodesInShow = useMemo(() => {
    if (!activeShow) return [];
    
    let src: Channel[] = [];
    if (activeCategory === FAVS_KEY) {
      src = favoriteChannels;
    } else if (activeCategory) {
      const cat = sectionCategories.find(c => c.name === activeCategory);
      src = cat ? cat.channels : [];
    } else {
      src = sectionChannels;
    }

    const matched: Channel[] = [];
    for (const c of src) {
      if ((c.seriesName ?? c.name) === activeShow) {
        matched.push(c);
      }
    }
    return matched.sort((a, b) => ((a.seasonNum ?? 0) - (b.seasonNum ?? 0)) || ((a.episodeNum ?? 0) - (b.episodeNum ?? 0)));
  }, [activeShow, activeCategory, sectionCategories, sectionChannels, favoriteChannels]);

  // Channels shown when inside a live/movies category
  const categoryChannels = useMemo(() => {
    if (!activeCategory) return [];
    if (activeCategory === FAVS_KEY) return favoriteChannels;
    const cat = sectionCategories.find(c => c.name === activeCategory);
    return cat ? cat.channels : [];
  }, [activeCategory, favoriteChannels, sectionCategories]);

  // Search — flat results for VOD/Live with early break at 200 matches
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const matched: Channel[] = [];
    for (const c of sectionChannels) {
      if (c.name.toLowerCase().includes(q) || (c.seriesName ?? '').toLowerCase().includes(q)) {
        matched.push(c);
        if (matched.length >= 200) break;
      }
    }
    return matched;
  }, [search, sectionChannels]);

  const isLive = section === 'live';
  const isSeries = section === 'series';
  const isMovies = section === 'movies';

  // For series search: deduplicate into unique shows
  const searchShows = useMemo(() => {
    if (!search.trim() || !isSeries) return [];
    const map = new Map<string, { name: string; logo: string; episodes: Channel[]; isFavorite: boolean }>();
    for (const ch of searchResults) {
      const key = ch.seriesName ?? ch.name;
      if (!map.has(key)) map.set(key, { name: key, logo: '', episodes: [], isFavorite: false });
      const entry = map.get(key)!;
      entry.episodes.push(ch);
      if (ch.isFavorite) entry.isFavorite = true;
    }
    // Pick best logo per show after all episodes are collected
    for (const entry of map.values()) {
      entry.logo = mostCommonLogo(entry.episodes);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [search, searchResults, isSeries]);

  // ── Back button logic ──────────────────────────────────────────────────────
  const handleBack = useCallback(() => {
    if (selectedDetailChannel) { setSelectedDetailChannel(null); return; }
    if (search || isSearchOpen) { setSearch(''); setIsSearchOpen(false); return; }   // back clears search first
    if (activeShow) { setActiveShow(null); return; }
    if (activeCategory) { setActiveCategory(null); return; }
    onBack();
  }, [selectedDetailChannel, search, isSearchOpen, activeShow, activeCategory, onBack]);

  // Handle hardware/remote back button
  useEffect(() => {
    const onHardwareBack = (e: Event) => {
      // If we have local state to clear, prevent app exit/history back and clear it
      if (selectedDetailChannel || search || isSearchOpen || activeShow || activeCategory) {
        e.preventDefault();
        handleBack();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'BrowserBack') {
        // If we are typing in search, let Backspace work normally
        if (e.key === 'Backspace' && document.activeElement?.tagName === 'INPUT') return;
        
        if (selectedDetailChannel || search || isSearchOpen || activeShow || activeCategory) {
          e.preventDefault();
          e.stopPropagation();
          handleBack();
        }
      }
    };

    window.addEventListener('app:hardwareBack', onHardwareBack);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('app:hardwareBack', onHardwareBack);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedDetailChannel, search, isSearchOpen, activeShow, activeCategory, handleBack]);

  // ── Breadcrumb title ───────────────────────────────────────────────────────
  const headerTitle = activeShow ?? (activeCategory === FAVS_KEY ? '⭐ Favoritos' : activeCategory) ?? TITLE_MAP[section];
  const headerSub = activeShow
    ? `${episodesInShow.length} episódio${episodesInShow.length !== 1 ? 's' : ''}`
    : activeCategory
    ? isSeries
      ? `${showsInCategory.length} série${showsInCategory.length !== 1 ? 's' : ''}`
      : `${categoryChannels.length} ${isLive ? 'canal' : 'filme'}${categoryChannels.length !== 1 ? 's' : ''}`
    : null;

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0">
        <button
          onClick={handleBack}
          className="focusable-tv p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 active:bg-gray-600 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-sm tracking-widest truncate">{headerTitle}</h1>
          {headerSub && <p className="text-xs text-gray-500">{headerSub}</p>}
        </div>
        
        {/* Search Toggle Button */}
        {!isSearchOpen && (
          <button
            onClick={() => setIsSearchOpen(true)}
            className="focusable-tv p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 active:bg-white/10 transition-colors"
            aria-label="Pesquisar"
          >
            <Search className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── Expandable Search Bar ── */}
      {isSearchOpen && (
        <div className="px-4 pb-2 pt-2 shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              readOnly={!search} // Only readonly when empty to allow backspace on TV
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.removeAttribute('readonly');
                  e.currentTarget.focus();
                }
              }}
              onClick={(e) => {
                e.currentTarget.removeAttribute('readonly');
                e.currentTarget.focus();
              }}
              onBlur={(e) => {
                if (!search) e.currentTarget.setAttribute('readonly', 'true');
              }}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Pesquisar em ${TITLE_MAP[section]}…`}
              className="focusable-tv w-full bg-gray-900 border border-white/10 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>

        {/* ── Search results ── */}
        {search.trim() && (
          <div className="p-4">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-widest">
              {isSeries ? searchShows.length : searchResults.length} resultado{(isSeries ? searchShows.length : searchResults.length) !== 1 ? 's' : ''}
            </p>

            {/* Series: one card per show */}
            {isSeries && (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 sm:gap-3">
                {activeShow
                  /* Episode list for the selected show within search */
                  ? null
                  : searchShows.slice(0, visibleLimit).map(show => (
                    <ShowCard
                      key={show.name}
                      name={show.name}
                      logo={show.logo}
                      episodeCount={show.episodes.length}
                      isFavorite={show.isFavorite}
                      isActive={currentChannel ? (currentChannel.seriesName ?? currentChannel.name) === show.name : false}
                      onClick={() => {
                        if (show.episodes.length > 0) {
                          setSelectedDetailChannel(show.episodes[0]);
                        }
                      }}
                      onToggleFav={() => {
                        if (show.episodes.length > 0) {
                          toggleFavorite(show.episodes[0].id);
                        }
                      }}
                    />
                  ))
                }
              </div>
            )}

            {/* Series: episodes of the selected show (within search) */}
            {isSeries && activeShow && (
              <>
                <button
                  onClick={() => setActiveShow(null)}
                  className="focusable-tv flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 mb-3 transition-colors focus:outline-none focus:text-violet-300"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar às séries
                </button>
                <div className="divide-y divide-white/5 rounded-xl overflow-hidden">
                  {(searchShows.find(s => s.name === activeShow)?.episodes ?? [])
                    .sort((a, b) => ((a.seasonNum ?? 0) - (b.seasonNum ?? 0)) || ((a.episodeNum ?? 0) - (b.episodeNum ?? 0)))
                    .slice(0, visibleLimit)
                    .map(ep => (
                      <EpisodeRow
                        key={ep.id}
                        channel={ep}
                        isActive={currentChannel?.id === ep.id}
                        onSelect={() => onSelectChannel(ep)}
                        onToggleFav={() => toggleFavorite(ep.id)}
                      />
                    ))
                  }
                </div>
              </>
            )}

            {/* Live / Movies: flat list */}
            {!isSeries && (
              <div className={`grid gap-2 ${isLive ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7'}`}>
                {searchResults.slice(0, visibleLimit).map(ch => isLive
                  ? <LiveChannelRow key={ch.id} channel={ch} isActive={currentChannel?.id === ch.id} onSelect={() => onSelectChannel(ch)} onToggleFav={() => toggleFavorite(ch.id)} />
                  : <PosterCard key={ch.id} channel={ch} isActive={currentChannel?.id === ch.id} onSelect={() => setSelectedDetailChannel(ch)} onToggleFav={() => toggleFavorite(ch.id)} />
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════ LIVE TV ════════════════════════════════════════════ */}

        {/* Live: Category folder grid */}
        {!search.trim() && isLive && !activeCategory && (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Favourites */}
            {favoriteChannels.length > 0 && (
              <FavCard count={favoriteChannels.length} onClick={() => setActiveCategory(FAVS_KEY)} />
            )}
            {sectionCategories.slice(0, visibleLimit).map(cat => (
              <CategoryFolderCard key={cat.name} name={cat.name} count={cat.channels.length} onClick={() => setActiveCategory(cat.name)} />
            ))}
          </div>
        )}

        {/* Live: Channel list inside category */}
        {!search.trim() && isLive && activeCategory && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-1">
            {categoryChannels.slice(0, visibleLimit).map(ch => (
              <LiveChannelRow
                key={ch.id}
                channel={ch}
                isActive={currentChannel?.id === ch.id}
                onSelect={() => onSelectChannel(ch)}
                onToggleFav={() => toggleFavorite(ch.id)}
              />
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════ MOVIES ════════════════════════════════════════════ */}

        {!search.trim() && isMovies && !activeCategory && (
          <div className="py-4 space-y-6">
            {/* Continue Watching row */}
            {continueWatchingMovies.length > 0 && (
              <ContinueWatchingRow
                items={continueWatchingMovies}
                currentChannelId={currentChannel?.id ?? null}
                onSelect={setSelectedDetailChannel}
                onRemove={removeFromContinueWatching}
              />
            )}

            {/* Favourites row */}
            {favoriteChannels.length > 0 && (
              <CategoryRow
                category={{ name: '⭐ Favoritos', channels: favoriteChannels }}
                currentChannelId={currentChannel?.id ?? null}
                onSelect={setSelectedDetailChannel}
                onToggleFav={ch => toggleFavorite(ch.id)}
                onHeaderClick={() => setActiveCategory(FAVS_KEY)}
              />
            )}
            {sectionCategories.slice(0, visibleCategoriesLimit).map(cat => (
              <CategoryRow
                key={cat.name}
                category={cat}
                currentChannelId={currentChannel?.id ?? null}
                onSelect={setSelectedDetailChannel}
                onToggleFav={ch => toggleFavorite(ch.id)}
                onHeaderClick={() => setActiveCategory(cat.name)}
              />
            ))}
          </div>
        )}

        {/* Movies: Movie list inside category */}
        {!search.trim() && isMovies && activeCategory && (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
            {categoryChannels.slice(0, visibleLimit).map(ch => (
              <PosterCard
                key={ch.id}
                channel={ch}
                isActive={currentChannel?.id === ch.id}
                onSelect={() => setSelectedDetailChannel(ch)}
                onToggleFav={() => toggleFavorite(ch.id)}
              />
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════ SERIES ════════════════════════════════════════════ */}

        {/* Series: Platform folder grid */}
        {!search.trim() && isSeries && !activeCategory && (
          <div className="py-4 space-y-6">
            {/* Continue Watching row */}
            {continueWatchingSeries.length > 0 && (
              <ContinueWatchingRow
                items={continueWatchingSeries}
                currentChannelId={currentChannel?.id ?? null}
                onSelect={setSelectedDetailChannel}
                onRemove={removeFromContinueWatching}
              />
            )}
            <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {favoriteChannels.length > 0 && (
                <FavCard count={favoriteChannels.length} onClick={() => setActiveCategory(FAVS_KEY)} />
              )}
              {sectionCategories.slice(0, visibleLimit).map(cat => (
                <CategoryFolderCard key={cat.name} name={cat.name} count={cat.channels.length} onClick={() => setActiveCategory(cat.name)} />
              ))}
            </div>
          </div>
        )}

        {/* Series: Show cards within platform */}
        {!search.trim() && isSeries && activeCategory && !activeShow && (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-2 sm:gap-3">
            {showsInCategory.slice(0, visibleLimit).map(show => (
              <ShowCard
                key={show.name}
                name={show.name}
                logo={show.logo}
                episodeCount={show.episodes.length}
                isFavorite={show.isFavorite}
                isActive={currentChannel ? (currentChannel.seriesName ?? currentChannel.name) === show.name : false}
                onClick={() => {
                  if (show.episodes.length > 0) {
                    setSelectedDetailChannel(show.episodes[0]);
                  }
                }}
                onToggleFav={() => {
                  // Toggle favorite on the first episode to mark the series as favorite
                  if (show.episodes.length > 0) {
                    toggleFavorite(show.episodes[0].id);
                  }
                }}
              />
            ))}
          </div>
        )}

        {/* Series: Episodes list */}
        {!search.trim() && isSeries && activeCategory && activeShow && (
          <div className="divide-y divide-white/5">
            {episodesInShow.slice(0, visibleLimit).map(ep => (
              <EpisodeRow
                key={ep.id}
                channel={ep}
                isActive={currentChannel?.id === ep.id}
                onSelect={() => onSelectChannel(ep)}
                onToggleFav={() => toggleFavorite(ep.id)}
              />
            ))}
          </div>
        )}

      {selectedDetailChannel && (
        <DetailModal
          channel={selectedDetailChannel}
          allChannels={selectedDetailChannel.contentType === 'series' ? seriesChannels : []}
          tmdbApiKey={tmdbApiKey}
          onClose={() => setSelectedDetailChannel(null)}
          onPlay={(ch) => {
            setSelectedDetailChannel(null);
            onSelectChannel(ch);
          }}
          onToggleFavorite={(id) => toggleFavorite(id)}
          isFavorite={idMap[selectedDetailChannel.id]?.isFavorite ?? false}
        />
      )}
      </div>
    </div>
  );
};

// ─── Small shared cards ───────────────────────────────────────────────────────

const FavCard: React.FC<{ count: number; onClick: () => void }> = ({ count, onClick }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    className="focusable-tv w-full group flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-yellow-900/50 to-yellow-950 border border-yellow-500/30 hover:border-yellow-400/60 transition-all text-left focus:outline-none focus:ring-2 focus:ring-yellow-400/50 cursor-pointer"
  >
    <Star className="w-5 h-5 text-yellow-400 shrink-0 fill-yellow-400" />
    <div className="min-w-0 flex-1">
      <p className="text-sm text-yellow-200 font-semibold truncate group-hover:text-yellow-100">Favoritos</p>
      <p className="text-xs text-yellow-600">{count}</p>
    </div>
  </div>
);

const CategoryFolderCard: React.FC<{ name: string; count: number; onClick: () => void }> = ({ name, count, onClick }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    className="focusable-tv w-full group flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-white/5 hover:border-violet-500/40 hover:bg-gray-800 transition-all text-left focus:outline-none focus:ring-2 focus:ring-violet-500/50 cursor-pointer"
  >
    <Folder className="w-5 h-5 text-violet-400 shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-sm text-white font-medium truncate group-hover:text-violet-300 transition-colors">{name}</p>
      <p className="text-xs text-gray-600">{count}</p>
    </div>
  </div>
);

// ─── Show Card (one per series title) ────────────────────────────────────────

interface ShowCardProps {
  name: string;
  logo: string;
  episodeCount: number;
  isFavorite: boolean;
  isActive: boolean;
  onClick: () => void;
  onToggleFav: () => void;
}

const ShowCard: React.FC<ShowCardProps> = ({ name, logo, episodeCount, isFavorite, isActive, onClick, onToggleFav }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const lp = useLongPress(() => setMenuOpen(true), onClick);
  const hue = Math.abs(name.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
  const gradientStyle = { background: `linear-gradient(160deg, hsl(${hue},55%,22%) 0%, hsl(${hue},40%,10%) 100%)` };

  const [isFocused, setIsFocused] = useState(false);
  const [resolvedLogo, setResolvedLogo] = useState<string | null>(() => {
    const cached = getCachedTMDBMetadata(name, 'series');
    return cached?.posterPath || logo || null;
  });
  const [hasFallbackToOriginal, setHasFallbackToOriginal] = useState(() => {
    const cached = getCachedTMDBMetadata(name, 'series');
    return !cached?.posterPath;
  });
  const [rating, setRating] = useState<number>(() => {
    const cached = getCachedTMDBMetadata(name, 'series');
    return cached?.voteAverage || 0;
  });
  const tmdbApiKey = useIPTVStore(state => state.tmdbApiKey);

  useEffect(() => {
    const cached = getCachedTMDBMetadata(name, 'series');
    if (!isFocused && cached) return;
    if (!isFocused && !cached) return;

    let active = true;
    const fetchPoster = async () => {
      const meta = await getTMDBMetadata(name, 'series', tmdbApiKey);
      if (active) {
        if (meta) {
          setRating(meta.voteAverage || 0);
          if (meta.posterPath) {
            setResolvedLogo(meta.posterPath);
            setHasFallbackToOriginal(false);
            return;
          }
        }
        setResolvedLogo(logo || null);
        setHasFallbackToOriginal(true);
      }
    };
    fetchPoster();
    return () => {
      active = false;
    };
  }, [name, logo, tmdbApiKey, isFocused]);

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!hasFallbackToOriginal && logo) {
      setResolvedLogo(logo);
      setHasFallbackToOriginal(true);
    } else {
      const img = e.target as HTMLImageElement;
      img.style.display = 'none';
      (img.parentElement?.querySelector('.show-fallback') as HTMLElement | null)?.style.setProperty('display', 'flex');
    }
  };

  return (
    <>
      {menuOpen && <FavContextMenu isFav={isFavorite} name={name} onToggle={onToggleFav} onClose={() => setMenuOpen(false)} />}
      <div
        {...lp}
        role="button"
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onMouseEnter={() => setIsFocused(true)}
        className={`focusable-tv group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200
          ${isActive ? 'ring-2 ring-violet-500 scale-[1.02]' : 'hover:scale-[1.04] hover:ring-1 hover:ring-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500'}`}
      >
        <div className="aspect-[2/3] relative overflow-hidden">

          {resolvedLogo ? (
          <img
            src={resolvedLogo} alt={name}
            className="w-full h-full object-cover"
            onError={handleImgError}
          />
        ) : null}

        {/* Gradient fallback — only when no logo URL at all */}
        <div
          className="show-fallback absolute inset-0 flex flex-col items-end justify-end p-3 pb-8"
          style={{ ...gradientStyle, display: resolvedLogo ? 'none' : 'flex' }}
        >
          <span
            className="absolute top-3 left-3 font-black leading-none select-none"
            style={{ fontSize: '3.5rem', color: `hsla(${hue},70%,75%,0.25)` }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
          <p className="relative z-10 text-white text-xs font-bold leading-tight line-clamp-3 drop-shadow">
            {name}
          </p>
        </div>

        {/* Rating Badge */}
        {rating > 0 && (
          <div className="absolute top-1.5 left-1.5 bg-black/75 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-extrabold text-yellow-400 flex items-center gap-1 shadow-md z-10 border border-white/5">
            <Star className="w-2.5 h-2.5 fill-current" />
            <span>{rating.toFixed(1)}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-violet-600/90 flex items-center justify-center shadow-lg">
              <Play className="w-4 h-4 text-white ml-0.5" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5">
          <span className="text-white text-[10px] font-bold">{episodeCount} ep</span>
        </div>

        {isFavorite && (
          <div className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/50 text-pink-400">
            <Heart className="w-3 h-3 fill-current" />
          </div>
        )}
      </div>

      <div className="bg-gray-900 px-1.5 py-1.5 flex items-center justify-between gap-1">
        <p className="text-white text-xs font-medium truncate">{name}</p>
      </div>
    </div>
    </>
  );
};

// ─── Episode Row ──────────────────────────────────────────────────────────────

interface EpisodeRowProps { channel: Channel; isActive: boolean; onSelect: () => void; onToggleFav: () => void; }

const EpisodeRow: React.FC<EpisodeRowProps> = ({ channel, isActive, onSelect, onToggleFav }) => {
  const lp = useLongPress(() => {}, onSelect); // Empty longpress, just handles onClick/onKeyDown
  return (
    <div
      {...lp}
      role="button"
      tabIndex={0}
      className={`focusable-tv group flex items-center gap-3 px-4 py-3 cursor-pointer transition-all focus:outline-none focus:bg-white/10
        ${isActive ? 'bg-violet-600/15 border-l-2 border-violet-500' : 'hover:bg-white/5 border-l-2 border-transparent'}`}
    >
    {/* Season/Episode pill */}
    <div className="w-14 shrink-0 text-center">
      {channel.seasonNum != null
        ? <span className="text-violet-400 text-xs font-bold">T{channel.seasonNum} E{channel.episodeNum}</span>
        : <span className="text-gray-600 text-xs">—</span>
      }
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium truncate ${isActive ? 'text-violet-300' : 'text-gray-200 group-hover:text-white'}`}>
        {channel.name}
      </p>
      <p className="text-xs text-gray-600 truncate">{channel.group}</p>
    </div>
    {isActive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />}
    <button
      onClick={e => { e.stopPropagation(); onToggleFav(); }}
      className={`p-1.5 rounded-lg transition-all ${channel.isFavorite ? 'text-pink-400' : 'opacity-0 group-hover:opacity-100 text-gray-600 hover:text-pink-400'}`}
    >
      <Heart className={`w-3.5 h-3.5 ${channel.isFavorite ? 'fill-current' : ''}`} />
    </button>
  </div>
  );
};

// ─── Category Row (movies horizontal scroll) ──────────────────────────────────

interface CategoryRowProps {
  category: Category;
  currentChannelId: string | null;
  onSelect: (ch: Channel) => void;
  onToggleFav: (ch: Channel) => void;
  onHeaderClick?: () => void;
}

const CategoryRow: React.FC<CategoryRowProps> = ({ category, currentChannelId, onSelect, onToggleFav, onHeaderClick }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  return (
    <div className="space-y-1">
      {/* Unified Category Header - Focusable for TV spatial navigation */}
      <div
        role="button"
        tabIndex={category.channels.length > 10 ? 0 : -1}
        onClick={() => { if (category.channels.length > 10 && onHeaderClick) onHeaderClick(); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (category.channels.length > 10 && onHeaderClick) onHeaderClick(); } }}
        className={`flex items-center justify-between px-4 py-1.5 mx-2 rounded-xl transition-all text-left focus:outline-none group ${
          category.channels.length > 10
            ? 'focusable-tv hover:bg-white/5 focus:bg-white/5 focus:ring-2 focus:ring-violet-500 cursor-pointer'
            : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-white font-semibold text-sm group-hover:text-violet-300 group-focus:text-violet-300 transition-colors">{category.name}</h2>
          {category.channels.length > 10 && (
            <span className="text-[10px] bg-violet-600/35 text-violet-300 px-1.5 py-0.5 rounded-full font-bold">
              {category.channels.length}
            </span>
          )}
        </div>
        {category.channels.length > 10 && (
          <div className="flex items-center gap-1 text-xs text-gray-500 group-hover:text-violet-300 group-focus:text-violet-300 transition-colors">
            <span>Ver todos</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        )}
      </div>

      <div ref={rowRef} className="flex gap-2 px-4 overflow-x-auto scrollbar-thin pb-1">
        {category.channels.slice(0, 20).map(ch => (
          <PosterCard
            key={ch.id}
            channel={ch}
            isActive={currentChannelId === ch.id}
            onSelect={() => onSelect(ch)}
            onToggleFav={() => onToggleFav(ch)}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Poster Card (movies) ─────────────────────────────────────────────────────

interface PosterCardProps { channel: Channel; isActive: boolean; onSelect: () => void; onToggleFav: () => void; }

const PosterCard: React.FC<PosterCardProps> = ({ channel, isActive, onSelect, onToggleFav }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const lp = useLongPress(() => setMenuOpen(true), onSelect);

  const [isFocused, setIsFocused] = useState(false);
  const [resolvedLogo, setResolvedLogo] = useState<string | null>(() => {
    const cached = getCachedTMDBMetadata(channel.name, 'movie');
    return cached?.posterPath || channel.logo || null;
  });
  const [hasFallbackToOriginal, setHasFallbackToOriginal] = useState(() => {
    const cached = getCachedTMDBMetadata(channel.name, 'movie');
    return !cached?.posterPath;
  });
  const [rating, setRating] = useState<number>(() => {
    const cached = getCachedTMDBMetadata(channel.name, 'movie');
    return cached?.voteAverage || 0;
  });
  const tmdbApiKey = useIPTVStore(state => state.tmdbApiKey);

  useEffect(() => {
    const cached = getCachedTMDBMetadata(channel.name, 'movie');
    if (!isFocused && cached) return;
    if (!isFocused && !cached) return;

    let active = true;
    const fetchPoster = async () => {
      const meta = await getTMDBMetadata(channel.name, 'movie', tmdbApiKey);
      if (active) {
        if (meta) {
          setRating(meta.voteAverage || 0);
          if (meta.posterPath) {
            setResolvedLogo(meta.posterPath);
            setHasFallbackToOriginal(false);
            return;
          }
        }
        setResolvedLogo(channel.logo || null);
        setHasFallbackToOriginal(true);
      }
    };
    fetchPoster();
    return () => {
      active = false;
    };
  }, [channel.name, channel.logo, tmdbApiKey, isFocused]);

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!hasFallbackToOriginal && channel.logo) {
      setResolvedLogo(channel.logo);
      setHasFallbackToOriginal(true);
    } else {
      const el = e.target as HTMLImageElement;
      el.style.display = 'none';
      el.nextElementSibling?.classList.remove('hidden');
    }
  };

  return (
    <>
      {menuOpen && <FavContextMenu isFav={!!channel.isFavorite} name={channel.name} onToggle={onToggleFav} onClose={() => setMenuOpen(false)} />}
      <div
        {...lp}
        role="button"
        tabIndex={0}
        onFocus={() => setIsFocused(true)}
        onMouseEnter={() => setIsFocused(true)}
        className={`focusable-tv group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200 shrink-0 w-28 sm:w-32 focus:outline-none focus:scale-[1.04] focus:ring-2 focus:ring-violet-500
          ${isActive ? 'ring-2 ring-violet-500 scale-[1.02]' : 'hover:scale-[1.04] hover:ring-1 hover:ring-white/20'}`}
      >
        <div className="aspect-[2/3] bg-gray-900 relative overflow-hidden">
          {resolvedLogo ? (
            <img src={resolvedLogo} alt={channel.name} className="w-full h-full object-cover"
              onError={handleImgError} />
          ) : null}
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-gray-800 to-gray-900 ${resolvedLogo ? 'hidden' : ''}`}>
            <Tv className="w-8 h-8 text-gray-600" />
            <p className="text-gray-500 text-xs text-center px-2 line-clamp-3">{channel.name}</p>
          </div>

          {/* Rating Badge */}
          {rating > 0 && (
            <div className="absolute top-1.5 left-1.5 bg-black/75 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-extrabold text-yellow-400 flex items-center gap-1 shadow-md z-10 border border-white/5">
              <Star className="w-2.5 h-2.5 fill-current" />
              <span>{rating.toFixed(1)}</span>
            </div>
          )}

          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-violet-600/90 flex items-center justify-center">
                <Play className="w-4 h-4 text-white ml-0.5" />
              </div>
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); onToggleFav(); }}
            className={`absolute top-1.5 right-1.5 p-1 rounded-full transition-all
              ${channel.isFavorite ? 'opacity-100 text-pink-400 bg-black/50' : 'opacity-0 group-hover:opacity-100 text-white/70 bg-black/50 hover:text-pink-400'}`}>
            <Heart className={`w-3 h-3 ${channel.isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>
        <div className="bg-gray-900 px-1.5 py-1.5">
          <p className="text-white text-xs font-medium truncate">{channel.seriesName ?? channel.name}</p>
        </div>
      </div>
    </>
  );
};

// ─── Continue Watching Row & Card ─────────────────────────────────────────────

interface ContinueWatchingRowProps {
  items: ContinueWatchingEntry[];
  currentChannelId: string | null;
  onSelect: (ch: Channel) => void;
  onRemove: (id: string) => void;
}

const ContinueWatchingRow: React.FC<ContinueWatchingRowProps> = ({ items, currentChannelId, onSelect, onRemove }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? items.length : 20;
  return (
    <div>
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-white font-semibold text-sm">🔄 Continue Assistindo</h2>
        {items.length > 10 && (
          <button
            onClick={() => setShowAll(s => !s)}
            className="focusable-tv flex items-center gap-1 text-xs text-gray-500 hover:text-violet-400 transition-colors focus:outline-none focus:text-violet-400"
          >
            <span>{showAll ? 'Menos' : `${items.length} | Mais`}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div ref={rowRef} className={showAll
        ? 'px-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2'
        : 'flex gap-2 px-4 overflow-x-auto scrollbar-thin pb-1'
      }>
        {items.slice(0, limit).map(entry => (
          <ContinueWatchingPosterCard
            key={entry.channelId}
            entry={entry}
            isActive={currentChannelId === entry.channelId}
            onSelect={onSelect}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
};

const ContinueWatchingPosterCard: React.FC<{
  entry: ContinueWatchingEntry;
  isActive: boolean;
  onSelect: (ch: Channel) => void;
  onRemove: (id: string) => void;
}> = ({ entry, isActive, onSelect, onRemove }) => {
  const channel: Channel = {
    id: entry.channelId,
    name: entry.name,
    url: entry.url,
    logo: entry.logo,
    group: entry.group,
    contentType: entry.contentType,
    seriesName: entry.seriesName,
    seasonNum: entry.seasonNum,
    episodeNum: entry.episodeNum,
  };

  const [resolvedLogo, setResolvedLogo] = useState<string | null>(null);
  const [hasFallbackToOriginal, setHasFallbackToOriginal] = useState(false);
  const tmdbApiKey = useIPTVStore(state => state.tmdbApiKey);

  useEffect(() => {
    let active = true;
    const fetchPoster = async () => {
      const type = entry.contentType === 'series' ? 'series' : 'movie';
      const queryName = entry.contentType === 'series' && entry.seriesName ? entry.seriesName : entry.name;
      const meta = await getTMDBMetadata(queryName, type, tmdbApiKey);
      if (active) {
        if (meta?.posterPath) {
          setResolvedLogo(meta.posterPath);
          setHasFallbackToOriginal(false);
        } else {
          setResolvedLogo(entry.logo || null);
          setHasFallbackToOriginal(true);
        }
      }
    };
    fetchPoster();
    return () => {
      active = false;
    };
  }, [entry.name, entry.logo, entry.contentType, entry.seriesName, tmdbApiKey]);

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!hasFallbackToOriginal && entry.logo) {
      setResolvedLogo(entry.logo);
      setHasFallbackToOriginal(true);
    } else {
      const el = e.target as HTMLImageElement;
      el.style.display = 'none';
      el.nextElementSibling?.classList.remove('hidden');
    }
  };

  const lp = useLongPress(() => {}, () => onSelect(channel));

  return (
    <div
      {...lp}
      role="button"
      tabIndex={0}
      className={`focusable-tv group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200 shrink-0 w-28 sm:w-32 focus:outline-none focus:scale-[1.04] focus:ring-2 focus:ring-violet-500
        ${isActive ? 'ring-2 ring-violet-500 scale-[1.02]' : 'hover:scale-[1.04] hover:ring-1 hover:ring-white/20'}`}
    >
      <div className="aspect-[2/3] bg-gray-900 relative overflow-hidden">
        {resolvedLogo ? (
          <img src={resolvedLogo} alt={channel.name} className="w-full h-full object-cover"
            onError={handleImgError} />
        ) : null}
        <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-gray-800 to-gray-900 ${resolvedLogo ? 'hidden' : ''}`}>
          <Tv className="w-8 h-8 text-gray-600" />
          <p className="text-gray-500 text-[10px] text-center px-2 line-clamp-3">{channel.name}</p>
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-9 h-9 rounded-full bg-violet-600/90 flex items-center justify-center">
              <Play className="w-3.5 h-3.5 text-white ml-0.5" />
            </div>
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onRemove(channel.id); }}
          className="absolute top-1.5 right-1.5 p-1 rounded-full text-white/70 bg-black/60 hover:text-red-400 hover:bg-black/90 transition-all focus:outline-none focus:ring-1 focus:ring-red-500"
          title="Remover"
        >
          <X className="w-3 h-3" />
        </button>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gray-800">
          <div className="bg-red-600 h-full rounded-r transition-all duration-300" style={{ width: `${entry.percentage}%` }} />
        </div>
      </div>
      <div className="bg-gray-900 px-1.5 py-1.5">
        <p className="text-white text-xs font-medium truncate">{channel.seriesName ?? channel.name}</p>
        {entry.contentType === 'series' && entry.seasonNum != null && (
          <p className="text-[10px] text-violet-400 font-semibold mt-0.5">T{entry.seasonNum} E{entry.episodeNum}</p>
        )}
      </div>
    </div>
  );
};

// ─── Live Channel Row ─────────────────────────────────────────────────────────

interface LiveChannelRowProps { channel: Channel; isActive: boolean; onSelect: () => void; onToggleFav: () => void; }

const LiveChannelRow: React.FC<LiveChannelRowProps> = ({ channel, isActive, onSelect, onToggleFav }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const lp = useLongPress(() => setMenuOpen(true), onSelect);
  const { programTitle, progress } = getEPGInfo(channel.name, channel.id);

  return (
    <>
      {menuOpen && <FavContextMenu isFav={!!channel.isFavorite} name={channel.name} onToggle={onToggleFav} onClose={() => setMenuOpen(false)} />}
      <div
        {...lp}
        role="button"
        tabIndex={0}
        className={`focusable-tv group flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all focus:outline-none focus:bg-white/10
          ${isActive ? 'bg-violet-600/15 border border-violet-500/40' : 'hover:bg-white/5 border border-transparent'}`}
      >
        <div className="w-12 h-12 rounded-lg bg-gray-900 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
          {channel.logo
            ? <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain p-0.5" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            : <Tv className="w-5 h-5 text-gray-600" />
          }
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className={`text-sm font-semibold truncate transition-colors ${isActive ? 'text-violet-300' : 'text-gray-100 group-hover:text-white'}`}>{channel.name}</p>
          
          {/* Progress Bar (EPG Orientation) */}
          <div className="w-full bg-gray-800/80 h-[3px] rounded-full overflow-hidden mt-1.5 shrink-0">
            <div className="bg-red-600 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>

          {/* EPG Program Description */}
          <p className="text-[11px] text-gray-500 font-medium truncate mt-1 line-clamp-1 group-hover:text-gray-400 transition-colors">
            {programTitle}
          </p>
        </div>
        {isActive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0 mr-1" />}
        <button onClick={e => { e.stopPropagation(); onToggleFav(); }}
          className={`p-1.5 rounded-lg transition-all ${channel.isFavorite ? 'text-pink-400' : 'opacity-0 group-hover:opacity-100 text-gray-600 hover:text-pink-400'}`}>
          <Heart className={`w-3.5 h-3.5 ${channel.isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>
    </>
  );
};

export default ContentBrowser;
