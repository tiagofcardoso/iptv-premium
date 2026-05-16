import React, { useRef, useState, useMemo } from 'react';
import { ChevronRight, Play, Heart, Search, ArrowLeft, Tv, Folder, X } from 'lucide-react';
import type { Channel, Category } from '../types/index.ts';
import { useIPTVStore } from '../store/useIPTVStore.ts';

interface ContentBrowserProps {
  section: 'live' | 'movies' | 'series';
  channels: Channel[];
  onBack: () => void;
  onSelectChannel: (channel: Channel) => void;
}

const TITLE_MAP = { live: 'TV AO VIVO', movies: 'FILMES', series: 'SÉRIES' };

const ContentBrowser: React.FC<ContentBrowserProps> = ({
  section, channels, onBack, onSelectChannel,
}) => {
  const { currentChannel, toggleFavorite } = useIPTVStore();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  // Filter channels for this section
  const sectionChannels = useMemo(() => {
    return channels.filter(c => {
      if (section === 'live') return c.contentType === 'live' || !c.contentType;
      if (section === 'movies') return c.contentType === 'movie';
      if (section === 'series') return c.contentType === 'series';
      return false;
    });
  }, [channels, section]);

  // Group by category
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

  const handleSelect = (channel: Channel) => {
    onSelectChannel(channel);
  };

  // Search mode
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return sectionChannels
      .filter(c => c.name.toLowerCase().includes(q) || (c.seriesName ?? '').toLowerCase().includes(q))
      .slice(0, 60);
  }, [search, sectionChannels]);

  // Category drill-down (for live TV)
  const categoryChannels = activeCategory
    ? sectionChannels.filter(c => c.group === activeCategory)
    : [];

  const isLive = section === 'live';

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 shrink-0">
        <button
          onClick={() => {
            if (activeCategory) {
              setActiveCategory(null);
            } else {
              onBack();
            }
          }}
          className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 active:bg-gray-600 transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h1 className="text-white font-bold text-base tracking-widest flex-1">
          {activeCategory ?? TITLE_MAP[section]}
        </h1>
        {activeCategory && (
          <span className="text-xs text-gray-500">{categoryChannels.length} canais</span>
        )}

        {/* Search toggle */}
        <button
          onClick={() => { setShowSearch(s => !s); setSearch(''); }}
          className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 transition-colors"
        >
          {showSearch ? <X className="w-4 h-4 text-white" /> : <Search className="w-4 h-4 text-white" />}
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-4 py-2 border-b border-white/5 shrink-0">
          <input
            autoFocus
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Pesquisar em ${TITLE_MAP[section]}…`}
            className="w-full bg-gray-800 border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Search results */}
        {showSearch && search.trim() && (
          <div className="p-4">
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-widest">
              {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
            </p>
            <div className={`grid gap-2 ${isLive ? 'grid-cols-1' : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7'}`}>
              {searchResults.map(ch => isLive
                ? <LiveChannelRow key={ch.id} channel={ch} isActive={currentChannel?.id === ch.id} onSelect={() => handleSelect(ch)} onToggleFav={() => toggleFavorite(ch.id)} />
                : <PosterCard key={ch.id} channel={ch} isActive={currentChannel?.id === ch.id} onSelect={() => handleSelect(ch)} onToggleFav={() => toggleFavorite(ch.id)} />
              )}
            </div>
          </div>
        )}

        {/* Live TV: category folders or channel list */}
        {!showSearch && isLive && !activeCategory && (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {sectionCategories.map(cat => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className="group flex items-center gap-3 p-3 rounded-xl bg-gray-900 border border-white/5 hover:border-violet-500/40 hover:bg-gray-800 transition-all text-left"
              >
                <Folder className="w-5 h-5 text-violet-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium truncate group-hover:text-violet-300 transition-colors">
                    {cat.name}
                  </p>
                  <p className="text-xs text-gray-600">{cat.channels.length}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Live TV: channel list inside category */}
        {!showSearch && isLive && activeCategory && (
          <div className="divide-y divide-white/5">
            {categoryChannels.map(ch => (
              <LiveChannelRow
                key={ch.id}
                channel={ch}
                isActive={currentChannel?.id === ch.id}
                onSelect={() => handleSelect(ch)}
                onToggleFav={() => toggleFavorite(ch.id)}
              />
            ))}
          </div>
        )}

        {/* Movies / Series: horizontal rows per subcategory */}
        {!showSearch && !isLive && (
          <div className="py-4 space-y-6">
            {sectionCategories.map(cat => (
              <CategoryRow
                key={cat.name}
                category={cat}
                currentChannelId={currentChannel?.id ?? null}
                onSelect={handleSelect}
                onToggleFav={ch => toggleFavorite(ch.id)}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

// ─── Category Row (horizontal scroll) ─────────────────────────────────────────
interface CategoryRowProps {
  category: Category;
  currentChannelId: string | null;
  onSelect: (ch: Channel) => void;
  onToggleFav: (ch: Channel) => void;
}

const CategoryRow: React.FC<CategoryRowProps> = ({ category, currentChannelId, onSelect, onToggleFav }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? category.channels.length : 20;

  return (
    <div>
      {/* Row header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-white font-semibold text-sm">{category.name}</h2>
        {category.channels.length > 10 && (
          <button
            onClick={() => setShowAll(s => !s)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-violet-400 transition-colors"
          >
            <span>{showAll ? 'Menos' : `${category.channels.length} | Mais`}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Horizontal scroll row */}
      <div
        ref={rowRef}
        className={showAll
          ? 'px-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2'
          : 'flex gap-2 px-4 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pb-1'
        }
      >
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

// ─── Poster Card (portrait, for movies/series) ────────────────────────────────
interface PosterCardProps {
  channel: Channel;
  isActive: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
}

const PosterCard: React.FC<PosterCardProps> = ({ channel, isActive, onSelect, onToggleFav }) => (
  <div
    className={`group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-200 shrink-0 w-28 sm:w-32
      ${isActive
        ? 'ring-2 ring-violet-500 scale-[1.02]'
        : 'hover:scale-[1.04] hover:ring-1 hover:ring-white/20'
      }`}
    onClick={onSelect}
  >
    {/* Poster area — portrait 2:3 */}
    <div className="aspect-[2/3] bg-gray-900 relative overflow-hidden">
      {channel.logo ? (
        <img
          src={channel.logo}
          alt={channel.name}
          className="w-full h-full object-cover"
          onError={e => {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            el.nextElementSibling?.classList.remove('hidden');
          }}
        />
      ) : null}
      {/* Fallback */}
      <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-gray-800 to-gray-900 ${channel.logo ? 'hidden' : ''}`}>
        <Tv className="w-8 h-8 text-gray-600" />
        <p className="text-gray-500 text-xs text-center px-2 line-clamp-3">{channel.seriesName ?? channel.name}</p>
      </div>

      {/* Play overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-10 h-10 rounded-full bg-violet-600/90 flex items-center justify-center">
            <Play className="w-4 h-4 text-white ml-0.5" />
          </div>
        </div>
      </div>

      {/* Active badge */}
      {isActive && (
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-violet-600/90 rounded-full px-1.5 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white text-[10px] font-bold">LIVE</span>
        </div>
      )}

      {/* Fav button */}
      <button
        onClick={e => { e.stopPropagation(); onToggleFav(); }}
        className={`absolute top-1.5 right-1.5 p-1 rounded-full transition-all
          ${channel.isFavorite
            ? 'opacity-100 text-pink-400 bg-black/50'
            : 'opacity-0 group-hover:opacity-100 text-white/70 bg-black/50 hover:text-pink-400'
          }`}
      >
        <Heart className={`w-3 h-3 ${channel.isFavorite ? 'fill-current' : ''}`} />
      </button>
    </div>

    {/* Title */}
    <div className="bg-gray-900 px-1.5 py-1.5">
      <p className="text-white text-xs font-medium truncate">{channel.seriesName ?? channel.name}</p>
      {channel.seasonNum != null && (
        <p className="text-violet-400 text-[10px]">T{channel.seasonNum} E{channel.episodeNum}</p>
      )}
    </div>
  </div>
);

// ─── Live Channel Row ─────────────────────────────────────────────────────────
interface LiveChannelRowProps {
  channel: Channel;
  isActive: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
}

const LiveChannelRow: React.FC<LiveChannelRowProps> = ({ channel, isActive, onSelect, onToggleFav }) => (
  <div
    className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-all
      ${isActive
        ? 'bg-violet-600/15 border-l-2 border-violet-500'
        : 'hover:bg-white/5 border-l-2 border-transparent'
      }`}
    onClick={onSelect}
  >
    <div className="w-10 h-10 rounded-lg bg-gray-800 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
      {channel.logo
        ? <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain p-0.5" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        : <Tv className="w-4 h-4 text-gray-600" />
      }
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-sm font-medium truncate transition-colors ${isActive ? 'text-violet-300' : 'text-gray-200 group-hover:text-white'}`}>
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

export default ContentBrowser;
