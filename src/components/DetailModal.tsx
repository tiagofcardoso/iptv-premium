import React, { useEffect, useState, useMemo } from 'react';
import { X, Play, Star, Calendar, Heart, Tv } from 'lucide-react';
import type { Channel } from '../types/index.ts';
import { getTMDBMetadata, type TMDBMetadata } from '../utils/tmdb.ts';

interface DetailModalProps {
  channel: Channel;
  allChannels: Channel[];
  tmdbApiKey?: string;
  onClose: () => void;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (channelId: string) => void;
  isFavorite: boolean;
}

const DetailModal: React.FC<DetailModalProps> = ({
  channel,
  allChannels,
  tmdbApiKey,
  onClose,
  onPlay,
  onToggleFavorite,
  isFavorite,
}) => {
  const [metadata, setMetadata] = useState<TMDBMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const isSeries = channel.contentType === 'series';
  const showName = channel.seriesName ?? channel.name;

  // Resolve metadata from TMDB on mount/change
  useEffect(() => {
    let active = true;
    setLoading(true);
    const fetchMeta = async () => {
      const type = isSeries ? 'series' : 'movie';
      const data = await getTMDBMetadata(showName, type, tmdbApiKey);
      if (active) {
        setMetadata(data);
        setLoading(false);
      }
    };
    fetchMeta();
    return () => {
      active = false;
    };
  }, [showName, isSeries, tmdbApiKey]);

  // Find all episodes of this series
  const episodes = useMemo(() => {
    if (!isSeries) return [];
    return allChannels
      .filter((c) => (c.seriesName ?? c.name) === showName)
      .sort((a, b) => {
        const sA = a.seasonNum ?? 1;
        const sB = b.seasonNum ?? 1;
        const eA = a.episodeNum ?? 0;
        const eB = b.episodeNum ?? 0;
        return sA * 1000 + eA - (sB * 1000 + eB);
      });
  }, [allChannels, showName, isSeries]);

  // Group episodes by season
  const episodesBySeason = useMemo(() => {
    const grouped: Record<number, Channel[]> = {};
    for (const ep of episodes) {
      const s = ep.seasonNum ?? 1;
      if (!grouped[s]) grouped[s] = [];
      grouped[s].push(ep);
    }
    return grouped;
  }, [episodes]);

  const seasons = useMemo(() => {
    return Object.keys(episodesBySeason)
      .map(Number)
      .sort((a, b) => a - b);
  }, [episodesBySeason]);

  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  // Set default season on episodes loaded
  useEffect(() => {
    if (seasons.length > 0) {
      // If our current channel has a season number, focus that one
      if (channel.seasonNum && seasons.includes(channel.seasonNum)) {
        setSelectedSeason(channel.seasonNum);
      } else {
        setSelectedSeason(seasons[0]);
      }
    }
  }, [seasons, channel.seasonNum]);

  // Auto-focus play button or close button when modal opens
  useEffect(() => {
    const timer = setTimeout(() => {
      const modalFocus = document.querySelector('#detail-modal .focusable-tv') as HTMLElement | null;
      if (modalFocus) {
        modalFocus.focus();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [loading]);

  // Handle hardware / keyboard Back actions locally
  useEffect(() => {
    const onHardwareBack = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'BrowserBack') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('app:hardwareBack', onHardwareBack);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('app:hardwareBack', onHardwareBack);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const currentEpisodes = episodesBySeason[selectedSeason] || [];

  return (
    <div
      id="detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 bg-black/85 backdrop-blur-md"
    >
      <div className="relative w-full max-w-5xl h-[85vh] sm:h-[80vh] md:h-[75vh] bg-gray-950 border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        
        {/* Backdrop Cover */}
        <div className="absolute inset-0 z-0 opacity-25">
          {metadata?.backdropPath ? (
            <img
              src={metadata.backdropPath}
              alt=""
              className="w-full h-full object-cover filter blur-[2px]"
            />
          ) : channel.logo ? (
            <img
              src={channel.logo}
              alt=""
              className="w-full h-full object-cover filter blur-md scale-[1.1]"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent" />
        </div>

        {/* Header Close button */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={onClose}
            className="focusable-tv p-2.5 rounded-full bg-black/60 border border-white/10 hover:border-violet-500/40 text-gray-400 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable details area */}
        <div className="relative z-10 flex-1 flex flex-col md:flex-row overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent p-6 md:p-8 gap-8">
          
          {/* Poster Section (Left Column) */}
          <div className="w-40 sm:w-48 md:w-56 shrink-0 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-xl overflow-hidden bg-gray-900 border border-white/10 shadow-lg relative">
              {metadata?.posterPath ? (
                <img
                  src={metadata.posterPath}
                  alt={showName}
                  className="w-full h-full object-cover"
                />
              ) : channel.logo ? (
                <img
                  src={channel.logo}
                  alt={showName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-gray-600">
                  <Tv className="w-12 h-12 mb-2" />
                  <span className="text-xs text-center px-4 font-bold">{showName}</span>
                </div>
              )}
            </div>

            {/* Favorite button */}
            <button
              onClick={() => onToggleFavorite(channel.id)}
              className={`focusable-tv w-full mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-xl border font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-violet-500/50 ${
                isFavorite
                  ? 'bg-pink-600/20 border-pink-500/40 text-pink-400'
                  : 'bg-black/40 border-white/10 text-gray-300 hover:text-white hover:border-white/20'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              <span>{isFavorite ? 'Favorito' : 'Favoritar'}</span>
            </button>
          </div>

          {/* Details Content (Right Column) */}
          <div className="flex-1 flex flex-col min-w-0 text-left">
            {loading ? (
              <div className="flex-1 flex items-center justify-center min-h-[200px]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-violet-500" />
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                    {metadata?.title || showName}
                  </h1>
                  
                  {/* Badges / Meta Info */}
                  <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-gray-400">
                    {metadata?.voteAverage ? (
                      <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 font-bold px-2 py-0.5 rounded">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{metadata.voteAverage.toFixed(1)}</span>
                      </div>
                    ) : null}

                    {metadata?.releaseDate ? (
                      <div className="flex items-center gap-1 bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {new Date(metadata.releaseDate).getFullYear()}
                        </span>
                      </div>
                    ) : null}

                    <div className="bg-white/5 border border-white/10 px-2 py-0.5 rounded capitalize font-medium">
                      {isSeries ? 'Série' : 'Filme'}
                    </div>

                    <div className="text-gray-500 font-medium truncate max-w-[200px]">
                      {channel.group}
                    </div>
                  </div>
                </div>

                {/* Play button for movies */}
                {!isSeries && (
                  <div>
                    <button
                      onClick={() => onPlay(channel)}
                      className="focusable-tv flex items-center justify-center gap-2 py-3 px-8 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg shadow-violet-600/20 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      <span>Assistir Filme</span>
                    </button>
                  </div>
                )}

                {/* Synopsis */}
                <div className="space-y-2">
                  <h2 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">
                    Sinopse
                  </h2>
                  <p className="text-sm text-gray-300 leading-relaxed max-w-3xl">
                    {metadata?.overview || 'Nenhuma sinopse disponível para este título.'}
                  </p>
                </div>

                {/* Cast */}
                {metadata?.cast && metadata.cast.length > 0 && (
                  <div className="space-y-2.5">
                    <h2 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">
                      Atores / Elenco
                    </h2>
                    <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-1">
                      {metadata.cast.map((actor, idx) => (
                        <div
                          key={idx}
                          className="w-20 shrink-0 text-center space-y-1.5"
                        >
                          <div className="w-20 h-20 rounded-full bg-gray-900 border border-white/5 overflow-hidden mx-auto shadow">
                            {actor.profilePath ? (
                              <img
                                src={actor.profilePath}
                                alt={actor.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500 font-semibold text-xl">
                                {actor.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-white font-medium truncate w-full px-1">
                            {actor.name}
                          </p>
                          <p className="text-[9px] text-gray-500 truncate w-full px-1">
                            {actor.character}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Episodes / Season list (For Series) */}
                {isSeries && episodes.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-2">
                      <h2 className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">
                        Episódios ({episodes.length})
                      </h2>
                      
                      {/* Season Selector */}
                      {seasons.length > 1 && (
                        <div className="flex gap-1.5 overflow-x-auto">
                          {seasons.map((sNum) => (
                            <button
                              key={sNum}
                              onClick={() => setSelectedSeason(sNum)}
                              className={`focusable-tv px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                selectedSeason === sNum
                                  ? 'bg-violet-600 border-violet-500 text-white shadow'
                                  : 'bg-black/30 border-white/5 text-gray-400 hover:text-white'
                              }`}
                            >
                              Temporada {sNum}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Episodes List Scrollable */}
                    <div className="max-h-[30vh] overflow-y-auto divide-y divide-white/5 pr-1 border border-white/5 rounded-xl bg-black/20">
                      {currentEpisodes.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-6">
                          Nenhum episódio nesta temporada.
                        </p>
                      ) : (
                        currentEpisodes.map((ep) => {
                          const isActive = channel.id === ep.id;
                          return (
                            <div
                              key={ep.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => onPlay(ep)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onPlay(ep);
                                }
                              }}
                              className={`focusable-tv flex items-center justify-between p-3 cursor-pointer text-left focus:outline-none transition-all group ${
                                isActive
                                  ? 'bg-violet-600/10 hover:bg-violet-600/15'
                                  : 'hover:bg-white/5'
                              }`}
                            >
                              <div className="flex-1 min-w-0 flex items-center gap-3">
                                <div className="text-center w-12 shrink-0">
                                  <span className="text-[10px] font-bold bg-violet-600/20 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded">
                                    EP {ep.episodeNum ?? 0}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-white truncate group-hover:text-violet-300">
                                    {ep.name.replace(ep.seriesName ?? '', '').replace(/^[-–•]\s*/, '').trim() || `Episódio ${ep.episodeNum}`}
                                  </p>
                                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                                    {ep.group}
                                  </p>
                                </div>
                              </div>
                              <Play className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetailModal;
