import React, { useRef, useState, useMemo } from 'react';
import { ChevronRight, Play, Heart, ArrowLeft, Tv, Folder, Star } from 'lucide-react';
import type { Channel, Category } from '../types/index.ts';
import { useIPTVStore } from '../store/useIPTVStore.ts';

interface ContentBrowserProps {
  section: 'live' | 'movies' | 'series';
  channels: Channel[];
  onBack: () => void;
  onSelectChannel: (channel: Channel) => void;
}

const TITLE_MAP = { live: 'TV AO VIVO', movies: 'FILMES', series: 'SÉRIES' };
const FAVS_KEY = '__FAVORITOS__';

/**
 * Returns the most frequently occurring logo URL among a list of channels,
 * BUT only if it appears in MORE THAN ONE episode.
 * If every episode has a unique logo, they are episode screenshots — return '' so
 * the ShowCard renders a styled gradient fallback with the series name.
 */
function mostCommonLogo(channels: Channel[]): string {
  const freq = new Map<string, number>();
  for (const ch of channels) {
    if (!ch.logo) continue;
    freq.set(ch.logo, (freq.get(ch.logo) ?? 0) + 1);
  }
  if (freq.size === 0) return '';
  const [bestUrl, bestCount] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
  // Only treat as a real series poster if the same image appears in at least 2 episodes
  return bestCount >= 2 ? bestUrl : '';
}

// ─────────────────────────────────────────────────────────────────────────────

const ContentBrowser: React.FC<ContentBrowserProps> = ({
  section, channels, onBack, onSelectChannel,
}) => {
  const { currentChannel, toggleFavorite } = useIPTVStore();
  const [search, setSearch] = useState('');
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Navigation levels
  const [activeCategory, setActiveCategory] = useState<string | null>(null); // platform/group
  const [activeShow, setActiveShow] = useState<string | null>(null);         // series show name

  // Channels for this section
  const sectionChannels = useMemo(() => channels.filter(c => {
    if (section === 'live') return c.contentType === 'live' || !c.contentType;
    if (section === 'movies') return c.contentType === 'movie';
    return c.contentType === 'series';
  }), [channels, section]);

  // Categories (platforms/groups)
  const sectionCategories = useMemo(() => {
    const map = new Map<string, Channel[]>();
    for (const ch of sectionChannels) {
      if (!map.has(ch.group)) map.set(ch.group, []);
      map.get(ch.group)!.push(ch);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, chs]) => ({ name, channels: chs }));
  }, [sectionChannels]);

  // Favorites in this section
  const favoriteChannels = useMemo(() => sectionChannels.filter(c => c.isFavorite), [sectionChannels]);

  // Series within active category — grouped by show name
  const showsInCategory = useMemo(() => {
    if (section !== 'series' || !activeCategory) return [];
    const src = activeCategory === FAVS_KEY ? favoriteChannels : sectionChannels.filter(c => c.group === activeCategory);
    const map = new Map<string, Channel[]>();
    for (const ch of src) {
      const key = ch.seriesName ?? ch.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ch);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, eps]) => ({
        name,
        episodes: eps.sort((a, b) => ((a.seasonNum ?? 0) - (b.seasonNum ?? 0)) || ((a.episodeNum ?? 0) - (b.episodeNum ?? 0))),
        logo: mostCommonLogo(eps),
        isFavorite: eps.some(e => e.isFavorite),
      }));
  }, [section, activeCategory, sectionChannels, favoriteChannels]);

  // Episodes of active show
  const episodesInShow = useMemo(() => {
    if (!activeShow) return [];
    return sectionChannels
      .filter(c => (c.seriesName ?? c.name) === activeShow && (!activeCategory || activeCategory === FAVS_KEY || c.group === activeCategory))
      .sort((a, b) => ((a.seasonNum ?? 0) - (b.seasonNum ?? 0)) || ((a.episodeNum ?? 0) - (b.episodeNum ?? 0)));
  }, [activeShow, activeCategory, sectionChannels]);

  // Channels shown when inside a live/movies category
  const categoryChannels = useMemo(() => {
    if (!activeCategory) return [];
    if (activeCategory === FAVS_KEY) return favoriteChannels;
    return sectionChannels.filter(c => c.group === activeCategory);
  }, [activeCategory, favoriteChannels, sectionChannels]);

  // Search — flat results for live/movies; grouped by show for series
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return sectionChannels.filter(c =>
      c.name.toLowerCase().includes(q) || (c.seriesName ?? '').toLowerCase().includes(q)
    ).slice(0, 200);
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
  const handleBack = () => {
    if (search) { setSearch(''); return; }   // back clears search first
    if (activeShow) { setActiveShow(null); return; }
    if (activeCategory) { setActiveCategory(null); return; }
    onBack();
  };

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
          className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 active:bg-gray-600 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-sm tracking-widest truncate">{headerTitle}</h1>
          {headerSub && <p className="text-xs text-gray-500">{headerSub}</p>}
        </div>
      </div>

      {/* ── Always-visible search bar ── */}
      <div className="px-4 pb-2 shrink-0">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Pesquisar em ${TITLE_MAP[section]}…`}
            className="w-full bg-gray-900 border border-white/10 text-white text-sm rounded-xl pl-9 pr-4 py-2.5 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-colors"
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

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">

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
                  : searchShows.map(show => (
                    <ShowCard
                      key={show.name}
                      name={show.name}
                      logo={show.logo}
                      episodeCount={show.episodes.length}
                      isFavorite={show.isFavorite}
                      isActive={currentChannel ? (currentChannel.seriesName ?? currentChannel.name) === show.name : false}
                      onClick={() => setActiveShow(show.name)}
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
                  className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 mb-3 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Voltar às séries
                </button>
                <div className="divide-y divide-white/5 rounded-xl overflow-hidden">
                  {(searchShows.find(s => s.name === activeShow)?.episodes ?? [])
                    .sort((a, b) => ((a.seasonNum ?? 0) - (b.seasonNum ?? 0)) || ((a.episodeNum ?? 0) - (b.episodeNum ?? 0)))
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
              <div className={`grid gap-2 ${isLive ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-7'}`}>
                {searchResults.map(ch => isLive
                  ? <LiveChannelRow key={ch.id} channel={ch} isActive={currentChannel?.id === ch.id} onSelect={() => onSelectChannel(ch)} onToggleFav={() => toggleFavorite(ch.id)} />
                  : <PosterCard key={ch.id} channel={ch} isActive={currentChannel?.id === ch.id} onSelect={() => onSelectChannel(ch)} onToggleFav={() => toggleFavorite(ch.id)} />
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
            {sectionCategories.map(cat => (
              <CategoryFolderCard key={cat.name} name={cat.name} count={cat.channels.length} onClick={() => setActiveCategory(cat.name)} />
            ))}
          </div>
        )}

        {/* Live: Channel list inside category */}
        {!search.trim() && isLive && activeCategory && (
          <div className="divide-y divide-white/5">
            {categoryChannels.map(ch => (
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

        {!search.trim() && isMovies && (
          <div className="py-4 space-y-6">
            {/* Favourites row */}
            {favoriteChannels.length > 0 && (
              <CategoryRow
                category={{ name: '⭐ Favoritos', channels: favoriteChannels }}
                currentChannelId={currentChannel?.id ?? null}
                onSelect={onSelectChannel}
                onToggleFav={ch => toggleFavorite(ch.id)}
              />
            )}
            {sectionCategories.map(cat => (
              <CategoryRow
                key={cat.name}
                category={cat}
                currentChannelId={currentChannel?.id ?? null}
                onSelect={onSelectChannel}
                onToggleFav={ch => toggleFavorite(ch.id)}
              />
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════ SERIES ════════════════════════════════════════════ */}

        {/* Series: Platform folder grid */}
        {!search.trim() && isSeries && !activeCategory && (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {favoriteChannels.length > 0 && (
              <FavCard count={favoriteChannels.length} onClick={() => setActiveCategory(FAVS_KEY)} />
            )}
            {sectionCategories.map(cat => (
              <CategoryFolderCard key={cat.name} name={cat.name} count={cat.channels.length} onClick={() => setActiveCategory(cat.name)} />
            ))}
          </div>
        )}

        {/* Series: Show cards within platform */}
        {!search.trim() && isSeries && activeCategory && !activeShow && (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-2 sm:gap-3">
            {showsInCategory.map(show => (
              <ShowCard
                key={show.name}
                name={show.name}
                logo={show.logo}
                episodeCount={show.episodes.length}
                isFavorite={show.isFavorite}
                isActive={currentChannel ? (currentChannel.seriesName ?? currentChannel.name) === show.name : false}
                onClick={() => setActiveShow(show.name)}
              />
            ))}
          </div>
        )}

        {/* Series: Episodes list */}
        {!search.trim() && isSeries && activeCategory && activeShow && (
          <div className="divide-y divide-white/5">
            {episodesInShow.map(ep => (
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

      </div>
    </div>
  );
};

// ─── Small shared cards ───────────────────────────────────────────────────────

const FavCard: React.FC<{ count: number; onClick: () => void }> = ({ count, onClick }) => (
  <button
    onClick={onClick}
    className="group flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-yellow-900/50 to-yellow-950 border border-yellow-500/30 hover:border-yellow-400/60 transition-all text-left"
  >
    <Star className="w-5 h-5 text-yellow-400 shrink-0 fill-yellow-400" />
    <div className="min-w-0 flex-1">
      <p className="text-sm text-yellow-200 font-semibold truncate group-hover:text-yellow-100">Favoritos</p>
      <p className="text-xs text-yellow-600">{count}</p>
    </div>
  </button>
);

const CategoryFolderCard: React.FC<{ name: string; count: number; onClick: () => void }> = ({ name, count, onClick }) => (
  <button
    onClick={onClick}
    className="group flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-white/5 hover:border-violet-500/40 hover:bg-gray-800 transition-all text-left"
  >
    <Folder className="w-5 h-5 text-violet-400 shrink-0" />
    <div className="min-w-0 flex-1">
      <p className="text-sm text-white font-medium truncate group-hover:text-violet-300 transition-colors">{name}</p>
      <p className="text-xs text-gray-600">{count}</p>
    </div>
  </button>
);

// ─── Show Card (one per series title) ────────────────────────────────────────

interface ShowCardProps {
  name: string;
  logo: string;
  episodeCount: number;
  isFavorite: boolean;
  isActive: boolean;
  onClick: () => void;
}

const ShowCard: React.FC<ShowCardProps> = ({ name, logo, episodeCount, isActive, onClick }) => {
  // Generate a consistent color from the series name for the gradient fallback
  const hue = Math.abs(name.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
  const gradientStyle = { background: `linear-gradient(160deg, hsl(${hue},55%,22%) 0%, hsl(${hue},40%,10%) 100%)` };

  return (
    <div
      className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200
        ${isActive ? 'ring-2 ring-violet-500 scale-[1.02]' : 'hover:scale-[1.04] hover:ring-1 hover:ring-white/20'}`}
      onClick={onClick}
    >
      <div className="aspect-[2/3] relative overflow-hidden">

        {/* Poster image — only shown if it's a genuine series poster (logo not empty) */}
        {logo ? (
          <img
            src={logo} alt={name}
            className="w-full h-full object-cover"
            onError={e => {
              // On load error, hide image and show gradient fallback
              const img = e.target as HTMLImageElement;
              img.style.display = 'none';
              (img.parentElement?.querySelector('.show-fallback') as HTMLElement | null)?.style.setProperty('display', 'flex');
            }}
          />
        ) : null}

        {/* Gradient fallback — shown when no valid poster */}
        <div
          className="show-fallback absolute inset-0 flex flex-col items-end justify-end p-3 pb-8"
          style={{ ...gradientStyle, display: logo ? 'none' : 'flex' }}
        >
          {/* Big initial letter */}
          <span
            className="absolute top-3 left-3 font-black leading-none select-none"
            style={{ fontSize: '3.5rem', color: `hsla(${hue},70%,75%,0.25)` }}
          >
            {name.charAt(0).toUpperCase()}
          </span>
          {/* Series name */}
          <p className="relative z-10 text-white text-xs font-bold leading-tight line-clamp-3 drop-shadow">
            {name}
          </p>
        </div>

        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-10 h-10 rounded-full bg-violet-600/90 flex items-center justify-center shadow-lg">
              <Play className="w-4 h-4 text-white ml-0.5" />
            </div>
          </div>
        </div>

        {/* Episode count badge */}
        <div className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5">
          <span className="text-white text-[10px] font-bold">{episodeCount} ep</span>
        </div>
      </div>

      {/* Title bar */}
      <div className="px-1.5 py-1.5" style={logo ? { background: '#111827' } : { ...gradientStyle }}>
        <p className="text-white text-xs font-medium truncate">{name}</p>
      </div>
    </div>
  );
};

// ─── Episode Row ──────────────────────────────────────────────────────────────

interface EpisodeRowProps { channel: Channel; isActive: boolean; onSelect: () => void; onToggleFav: () => void; }

const EpisodeRow: React.FC<EpisodeRowProps> = ({ channel, isActive, onSelect, onToggleFav }) => (
  <div
    className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-all
      ${isActive ? 'bg-violet-600/15 border-l-2 border-violet-500' : 'hover:bg-white/5 border-l-2 border-transparent'}`}
    onClick={onSelect}
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

// ─── Category Row (movies horizontal scroll) ──────────────────────────────────

interface CategoryRowProps { category: Category; currentChannelId: string | null; onSelect: (ch: Channel) => void; onToggleFav: (ch: Channel) => void; }

const CategoryRow: React.FC<CategoryRowProps> = ({ category, currentChannelId, onSelect, onToggleFav }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? category.channels.length : 20;
  return (
    <div>
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-white font-semibold text-sm">{category.name}</h2>
        {category.channels.length > 10 && (
          <button onClick={() => setShowAll(s => !s)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-violet-400 transition-colors">
            <span>{showAll ? 'Menos' : `${category.channels.length} | Mais`}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      <div ref={rowRef} className={showAll
        ? 'px-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2'
        : 'flex gap-2 px-4 overflow-x-auto scrollbar-thin pb-1'
      }>
        {category.channels.slice(0, limit).map(ch => (
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

const PosterCard: React.FC<PosterCardProps> = ({ channel, isActive, onSelect, onToggleFav }) => (
  <div
    className={`group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200 shrink-0 w-28 sm:w-32
      ${isActive ? 'ring-2 ring-violet-500 scale-[1.02]' : 'hover:scale-[1.04] hover:ring-1 hover:ring-white/20'}`}
    onClick={onSelect}
  >
    <div className="aspect-[2/3] bg-gray-900 relative overflow-hidden">
      {channel.logo ? (
        <img src={channel.logo} alt={channel.name} className="w-full h-full object-cover"
          onError={e => { const el = e.target as HTMLImageElement; el.style.display = 'none'; el.nextElementSibling?.classList.remove('hidden'); }} />
      ) : null}
      <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-gray-800 to-gray-900 ${channel.logo ? 'hidden' : ''}`}>
        <Tv className="w-8 h-8 text-gray-600" />
        <p className="text-gray-500 text-xs text-center px-2 line-clamp-3">{channel.name}</p>
      </div>
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
);

// ─── Live Channel Row ─────────────────────────────────────────────────────────

interface LiveChannelRowProps { channel: Channel; isActive: boolean; onSelect: () => void; onToggleFav: () => void; }

const LiveChannelRow: React.FC<LiveChannelRowProps> = ({ channel, isActive, onSelect, onToggleFav }) => (
  <div
    className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-all
      ${isActive ? 'bg-violet-600/15 border-l-2 border-violet-500' : 'hover:bg-white/5 border-l-2 border-transparent'}`}
    onClick={onSelect}
  >
    <div className="w-10 h-10 rounded-lg bg-gray-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
      {channel.logo
        ? <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain p-0.5" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        : <Tv className="w-4 h-4 text-gray-600" />
      }
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium truncate transition-colors ${isActive ? 'text-violet-300' : 'text-gray-200 group-hover:text-white'}`}>{channel.name}</p>
      <p className="text-xs text-gray-600 truncate">{channel.group}</p>
    </div>
    {isActive && <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />}
    <button onClick={e => { e.stopPropagation(); onToggleFav(); }}
      className={`p-1.5 rounded-lg transition-all ${channel.isFavorite ? 'text-pink-400' : 'opacity-0 group-hover:opacity-100 text-gray-600 hover:text-pink-400'}`}>
      <Heart className={`w-3.5 h-3.5 ${channel.isFavorite ? 'fill-current' : ''}`} />
    </button>
  </div>
);

export default ContentBrowser;
