import React, { useState, useMemo } from 'react';
import {
  Search, Tv, ChevronRight, ChevronLeft, X, ChevronDown,
  List, Heart, Loader2, Link, UploadCloud, Trash2,
  Film, Clapperboard, Radio, Star,
} from 'lucide-react';
import { useIPTVStore } from '../store/useIPTVStore.ts';
import { fetchM3U, parseM3U } from '../utils/m3uParser.ts';
import type { Channel } from '../types/index.ts';
import type { VideoPlayerHandle } from './VideoPlayer.tsx';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  playerRef?: React.RefObject<VideoPlayerHandle | null>;
}

type SidebarView = 'categories' | 'channels' | 'favorites';

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, playerRef }) => {
  const {
    channels, categories, currentChannel, activeCategory,
    searchQuery, playlistUrl,
    setChannels, setCurrentChannel, setActiveCategory,
    setSearchQuery, toggleFavorite, clearPlaylist,
  } = useIPTVStore();

  const [urlInput, setUrlInput] = useState(playlistUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<SidebarView>('categories');

  const handleLoadPlaylist = async () => {
    if (!urlInput.trim()) return;
    setLoading(true);
    setError('');
    try {
      const parsed = await fetchM3U(urlInput.trim());
      if (parsed.length === 0) throw new Error('Nenhum canal encontrado na playlist.');
      setChannels(parsed, urlInput.trim());
      setView('categories');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar a playlist.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseM3U(text);
      if (parsed.length === 0) { setError('Nenhum canal encontrado no ficheiro.'); return; }
      setChannels(parsed, `file://${file.name}`);
      setView('categories');
    };
    reader.readAsText(file);
  };

  const handleSelectChannel = (channel: Channel) => {
    playerRef?.current?.requestFullscreen();
    setCurrentChannel(channel);
    if (window.innerWidth < 768) onToggle();
  };

  /** Channels for the current view / search */
  const visibleChannels = useMemo((): Channel[] => {
    let pool = channels;
    if (view === 'favorites') pool = channels.filter(c => c.isFavorite);
    else if (activeCategory) pool = channels.filter(c => c.group === activeCategory);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      pool = pool.filter(c => c.name.toLowerCase().includes(q) || (c.seriesName ?? '').toLowerCase().includes(q));
    }
    return pool;
  }, [channels, view, activeCategory, searchQuery]);

  /** Group series episodes under their series name */
  const groupedSeries = useMemo(() => {
    if (!activeCategory) return null;
    const cat = categories.find(c => c.name === activeCategory);
    if (!cat) return null;
    // Only group if majority of channels are series type
    const seriesCount = cat.channels.filter(c => c.contentType === 'series' || c.seriesName).length;
    if (seriesCount < cat.channels.length * 0.3) return null;

    const map = new Map<string, Channel[]>();
    for (const ch of visibleChannels) {
      const key = ch.seriesName ?? ch.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ch);
    }
    return map;
  }, [activeCategory, visibleChannels, categories]);

  const favorites = channels.filter(c => c.isFavorite);
  const favLive   = favorites.filter(c => c.contentType === 'live' || !c.contentType);
  const favMovies = favorites.filter(c => c.contentType === 'movie');
  const favSeries = favorites.filter(c => c.contentType === 'series');

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden" onClick={onToggle} />
      )}

      <aside
        className={`
          fixed md:relative inset-y-0 left-0 z-30 flex flex-col
          w-72 bg-gray-900/95 backdrop-blur-xl border-r border-white/5
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:overflow-hidden md:border-0'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <Tv className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm tracking-wide">IPTV Premium</span>
          </div>
          <button onClick={onToggle} className="md:hidden p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Import Section */}
        <div className="px-3 py-3 border-b border-white/5 space-y-2 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLoadPlaylist()}
              placeholder="URL da playlist M3U…"
              className="flex-1 min-w-0 bg-gray-800 border border-white/10 text-white text-xs rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
            />
            <button
              onClick={handleLoadPlaylist}
              disabled={loading}
              className="px-3 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg transition-all active:scale-95"
              title="Carregar URL"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
            </button>
          </div>

          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed border-white/10 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all group">
            <UploadCloud className="w-4 h-4 text-gray-500 group-hover:text-violet-400 transition-colors" />
            <span className="text-xs text-gray-500 group-hover:text-violet-300 transition-colors">Upload ficheiro .m3u</span>
            <input type="file" accept=".m3u,.m3u8" className="hidden" onChange={handleFileUpload} />
          </label>

          {error && <p className="text-red-400 text-xs px-1">{error}</p>}

          {channels.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{channels.length.toLocaleString()} canais carregados</span>
              <button
                onClick={clearPlaylist}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />Limpar
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        {channels.length > 0 && (
          <div className="px-3 py-2 border-b border-white/5 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Pesquisar canais…"
                className="w-full bg-gray-800 border border-white/10 text-white text-xs rounded-lg pl-8 pr-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all"
              />
            </div>
          </div>
        )}

        {/* Navigation tabs */}
        {channels.length > 0 && (
          <div className="flex px-3 py-2 gap-1 border-b border-white/5 shrink-0">
            {[
              { key: 'categories' as const, icon: List, label: 'Categorias' },
              { key: 'favorites' as const, icon: Star, label: `Favoritos${favorites.length ? ` (${favorites.length})` : ''}` },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => { setView(key); setActiveCategory(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg font-medium transition-all ${
                  view === key
                    ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">

          {/* Empty state */}
          {channels.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3">
              <div className="w-12 h-12 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Tv className="w-6 h-6 text-violet-400/60" />
              </div>
              <p className="text-gray-500 text-xs leading-relaxed">Carrega uma playlist M3U para começar</p>
            </div>
          )}

          {/* ── FAVORITES view ── */}
          {channels.length > 0 && view === 'favorites' && (
            <div className="py-2">
              {favorites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                  <Heart className="w-8 h-8 text-gray-700" />
                  <p className="text-gray-600 text-xs">Nenhum favorito ainda.<br />Clica no ❤ em qualquer canal.</p>
                </div>
              ) : (
                <>
                  {favLive.length > 0 && (
                    <FavGroup icon={<Radio className="w-3.5 h-3.5 text-violet-400" />} label="Canais" channels={favLive} currentChannel={currentChannel} onSelect={handleSelectChannel} onToggleFav={toggleFavorite} />
                  )}
                  {favMovies.length > 0 && (
                    <FavGroup icon={<Film className="w-3.5 h-3.5 text-blue-400" />} label="Filmes" channels={favMovies} currentChannel={currentChannel} onSelect={handleSelectChannel} onToggleFav={toggleFavorite} />
                  )}
                  {favSeries.length > 0 && (
                    <FavGroup icon={<Clapperboard className="w-3.5 h-3.5 text-amber-400" />} label="Séries" channels={favSeries} currentChannel={currentChannel} onSelect={handleSelectChannel} onToggleFav={toggleFavorite} />
                  )}
                </>
              )}
            </div>
          )}

          {/* ── CATEGORIES view ── */}
          {channels.length > 0 && (view === 'categories') && !searchQuery && (
            <div className="py-2">
              {categories.map(cat => {
                const icon = cat.channels[0]?.contentType === 'movie'
                  ? <Film className="w-3 h-3 text-blue-400" />
                  : cat.channels[0]?.contentType === 'series'
                  ? <Clapperboard className="w-3 h-3 text-amber-400" />
                  : <Radio className="w-3 h-3 text-violet-400" />;
                return (
                  <button
                    key={cat.name}
                    onClick={() => { setActiveCategory(cat.name); setView('channels'); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/5 transition-colors group ${
                      activeCategory === cat.name ? 'text-violet-400' : 'text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {icon}
                      <span className="text-xs font-medium truncate">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-600">{cat.channels.length}</span>
                      <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-violet-400 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── CHANNELS view (category drill-down or search) ── */}
          {channels.length > 0 && (view === 'channels' || (view === 'categories' && !!searchQuery)) && (
            <div className="py-2">
              {/* Back button */}
              {view === 'channels' && activeCategory && !searchQuery && (
                <button
                  onClick={() => { setView('categories'); setActiveCategory(null); }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 px-4 py-2 transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {activeCategory}
                </button>
              )}

              {/* Series grouped view */}
              {groupedSeries && !searchQuery ? (
                <SeriesGroupedList
                  groups={groupedSeries}
                  currentChannel={currentChannel}
                  onSelect={handleSelectChannel}
                  onToggleFav={toggleFavorite}
                />
              ) : visibleChannels.length === 0 ? (
                <p className="text-center text-gray-600 text-xs py-8">Nenhum canal encontrado</p>
              ) : (
                visibleChannels.map(channel => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    isActive={currentChannel?.id === channel.id}
                    onSelect={() => handleSelectChannel(channel)}
                    onToggleFav={() => toggleFavorite(channel.id)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FavGroupProps {
  icon: React.ReactNode;
  label: string;
  channels: Channel[];
  currentChannel: Channel | null;
  onSelect: (c: Channel) => void;
  onToggleFav: (id: string) => void;
}

const FavGroup: React.FC<FavGroupProps> = ({ icon, label, channels, currentChannel, onSelect, onToggleFav }) => (
  <div>
    <div className="flex items-center gap-2 px-4 py-1.5">
      {icon}
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
      <span className="text-xs text-gray-700">({channels.length})</span>
    </div>
    {channels.map(ch => (
      <ChannelItem
        key={ch.id}
        channel={ch}
        isActive={currentChannel?.id === ch.id}
        onSelect={() => onSelect(ch)}
        onToggleFav={() => onToggleFav(ch.id)}
      />
    ))}
  </div>
);

interface SeriesGroupedListProps {
  groups: Map<string, Channel[]>;
  currentChannel: Channel | null;
  onSelect: (c: Channel) => void;
  onToggleFav: (id: string) => void;
}

const SeriesGroupedList: React.FC<SeriesGroupedListProps> = ({ groups, currentChannel, onSelect, onToggleFav }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (name: string) =>
    setExpanded(prev => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });

  return (
    <>
      {Array.from(groups.entries()).map(([seriesName, episodes]) => {
        const isExpanded = expanded.has(seriesName);
        const hasActive = episodes.some(e => e.id === currentChannel?.id);
        const logo = episodes[0]?.logo;
        return (
          <div key={seriesName}>
            <button
              onClick={() => toggle(seriesName)}
              className={`w-full flex items-center gap-3 px-3 py-2 mx-1 rounded-lg hover:bg-white/5 transition-colors ${hasActive ? 'text-violet-400' : 'text-gray-300'}`}
            >
              {/* Logo */}
              <div className="w-9 h-9 rounded-lg bg-gray-800 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                {logo ? (
                  <img src={logo} alt={seriesName} className="w-full h-full object-contain p-0.5"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <Clapperboard className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-medium truncate">{seriesName}</p>
                <p className="text-xs text-gray-600">{episodes.length} episódios</p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>

            {isExpanded && (
              <div className="ml-4 border-l border-white/5 pl-2">
                {episodes
                  .sort((a, b) => ((a.seasonNum ?? 0) * 1000 + (a.episodeNum ?? 0)) - ((b.seasonNum ?? 0) * 1000 + (b.episodeNum ?? 0)))
                  .map(ep => (
                    <ChannelItem
                      key={ep.id}
                      channel={ep}
                      isActive={currentChannel?.id === ep.id}
                      onSelect={() => onSelect(ep)}
                      onToggleFav={() => onToggleFav(ep.id)}
                    />
                  ))
                }
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

interface ChannelItemProps {
  channel: Channel;
  isActive: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
}

const ChannelItem: React.FC<ChannelItemProps> = ({ channel, isActive, onSelect, onToggleFav }) => (
  <div
    className={`group flex items-center gap-3 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-all ${
      isActive
        ? 'bg-violet-600/20 border border-violet-500/30'
        : 'hover:bg-white/5 border border-transparent'
    }`}
    onClick={onSelect}
  >
    <div className="w-9 h-9 rounded-lg bg-gray-800 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
      {channel.logo ? (
        <img src={channel.logo} alt={channel.name} className="w-full h-full object-contain p-0.5"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <Tv className="w-4 h-4 text-gray-600" />
      )}
    </div>

    <div className="flex-1 min-w-0">
      <span className={`text-xs font-medium truncate block ${isActive ? 'text-white' : 'text-gray-300'}`}>
        {channel.seasonNum != null
          ? `T${channel.seasonNum}E${channel.episodeNum?.toString().padStart(2, '0')} • ${channel.name.replace(channel.seriesName ?? '', '').trim().replace(/^[-–•]\s*/, '')}`
          : channel.name
        }
      </span>
      {channel.contentType && channel.contentType !== 'live' && (
        <span className={`text-xs ${channel.contentType === 'movie' ? 'text-blue-500' : 'text-amber-500'}`}>
          {channel.contentType === 'movie' ? 'Filme' : 'Série'}
        </span>
      )}
    </div>

    <button
      onClick={e => { e.stopPropagation(); onToggleFav(); }}
      className={`p-1 rounded transition-all opacity-0 group-hover:opacity-100 ${
        channel.isFavorite ? '!opacity-100 text-pink-400' : 'text-gray-600 hover:text-pink-400'
      }`}
    >
      <Heart className={`w-3.5 h-3.5 ${channel.isFavorite ? 'fill-current' : ''}`} />
    </button>
  </div>
);

export default Sidebar;
