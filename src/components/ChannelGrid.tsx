import React from 'react';
import { Heart, Tv, Play } from 'lucide-react';
import type { Channel } from '../types/index.ts';
import { useIPTVStore } from '../store/useIPTVStore.ts';
import type { VideoPlayerHandle } from './VideoPlayer.tsx';

interface ChannelGridProps {
  channels: Channel[];
  title: string;
  playerRef?: React.RefObject<VideoPlayerHandle | null>;
  /** Max items to show (default 20) */
  limit?: number;
}

const ChannelGrid: React.FC<ChannelGridProps> = ({ channels, title, playerRef, limit = 20 }) => {
  const { currentChannel, setCurrentChannel, toggleFavorite } = useIPTVStore();

  if (channels.length === 0) return null;

  const handleSelect = (channel: Channel) => {
    // Request fullscreen synchronously inside the click handler (user gesture)
    playerRef?.current?.requestFullscreen();
    setCurrentChannel(channel);
  };

  return (
    <div className="mt-2">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3">
        {channels.slice(0, limit).map(channel => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            isActive={currentChannel?.id === channel.id}
            onSelect={() => handleSelect(channel)}
            onToggleFav={() => toggleFavorite(channel.id)}
          />
        ))}
      </div>
    </div>
  );
};

interface ChannelCardProps {
  channel: Channel;
  isActive: boolean;
  onSelect: () => void;
  onToggleFav: () => void;
}

const ChannelCard: React.FC<ChannelCardProps> = ({ channel, isActive, onSelect, onToggleFav }) => (
  <div
    className={`group relative rounded-xl border cursor-pointer transition-all duration-200 overflow-hidden
      ${isActive
        ? 'border-violet-500/60 bg-violet-600/10 shadow-lg shadow-violet-500/15 scale-[1.02]'
        : 'border-white/5 bg-gray-800/50 hover:border-violet-500/30 hover:bg-gray-800 hover:scale-[1.01]'
      }`}
    onClick={onSelect}
  >
    {/* Banner / Logo area — taller */}
    <div className="aspect-[16/10] flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-950 p-4 relative overflow-hidden">
      {/* Blurred background logo */}
      {channel.logo && (
        <img
          src={channel.logo}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-10 blur-xl scale-110"
          aria-hidden
        />
      )}
      {channel.logo ? (
        <img
          src={channel.logo}
          alt={channel.name}
          className="relative max-h-20 max-w-[85%] object-contain transition-transform duration-300 group-hover:scale-110 drop-shadow-lg"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Tv className="w-10 h-10 text-gray-700" />
        </div>
      )}

      {/* Play overlay on hover */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-75 group-hover:scale-100">
          <div className="w-12 h-12 rounded-full bg-violet-600/90 backdrop-blur flex items-center justify-center shadow-xl">
            <Play className="w-5 h-5 text-white ml-0.5" />
          </div>
        </div>
      </div>

      {/* Active LIVE badge */}
      {isActive && (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-violet-600/90 backdrop-blur-sm rounded-full px-2 py-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-white text-xs font-bold">LIVE</span>
        </div>
      )}

      {/* Content type badge */}
      {channel.contentType && channel.contentType !== 'live' && (
        <div className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-bold backdrop-blur-sm ${
          channel.contentType === 'movie' ? 'bg-blue-600/80 text-blue-100' : 'bg-amber-600/80 text-amber-100'
        }`}>
          {channel.contentType === 'movie' ? 'FILME' : 'SÉRIE'}
        </div>
      )}
    </div>

    {/* Info row */}
    <div className="px-2.5 py-2 flex items-start justify-between gap-1">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-200 font-medium truncate group-hover:text-white transition-colors">
          {channel.seriesName ?? channel.name}
        </p>
        {channel.seasonNum != null && (
          <p className="text-xs text-violet-400 truncate">
            T{channel.seasonNum} • E{channel.episodeNum}
          </p>
        )}
        {!channel.seasonNum && (
          <p className="text-xs text-gray-600 truncate">{channel.group}</p>
        )}
      </div>

      {/* Favorite button */}
      <button
        onClick={e => { e.stopPropagation(); onToggleFav(); }}
        className={`shrink-0 p-1 rounded-lg transition-all mt-0.5 ${
          channel.isFavorite
            ? 'text-pink-400'
            : 'text-gray-700 hover:text-pink-400 opacity-0 group-hover:opacity-100'
        }`}
      >
        <Heart className={`w-3.5 h-3.5 ${channel.isFavorite ? 'fill-current' : ''}`} />
      </button>
    </div>
  </div>
);

export default ChannelGrid;
