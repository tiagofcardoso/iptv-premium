import React from 'react';
import { Heart, Tv } from 'lucide-react';
import type { Channel } from '../types/index.ts';
import { useIPTVStore } from '../store/useIPTVStore.ts';

interface NowPlayingBarProps {
  channel: Channel;
}

const NowPlayingBar: React.FC<NowPlayingBarProps> = ({ channel }) => {
  const { toggleFavorite } = useIPTVStore();

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-gray-900/80 backdrop-blur-xl border-b border-white/5">
      {/* Logo */}
      <div className="w-10 h-10 rounded-lg bg-gray-800 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-full h-full object-contain p-0.5"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <Tv className="w-5 h-5 text-gray-500" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{channel.name}</p>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            LIVE
          </span>
          <span className="text-xs text-gray-500">•</span>
          <span className="text-xs text-gray-500 truncate">{channel.group}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => toggleFavorite(channel.id)}
          className={`p-2 rounded-lg transition-all active:scale-95 ${
            channel.isFavorite
              ? 'bg-pink-500/20 text-pink-400 hover:bg-pink-500/30'
              : 'bg-white/5 text-gray-400 hover:text-pink-400 hover:bg-pink-500/10'
          }`}
          title={channel.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-4 h-4 ${channel.isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>
    </div>
  );
};

export default NowPlayingBar;
