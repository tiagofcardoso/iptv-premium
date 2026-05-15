import React from 'react';
import { Clock, Trash2, Play, X, Film, Tv, Clapperboard } from 'lucide-react';
import type { HistoryEntry } from '../types/index.ts';
import { useIPTVStore } from '../store/useIPTVStore.ts';
import type { VideoPlayerHandle } from './VideoPlayer.tsx';

interface HistorySectionProps {
  playerRef?: React.RefObject<VideoPlayerHandle | null>;
}

const HistorySection: React.FC<HistorySectionProps> = ({ playerRef }) => {
  const { history, channels, setCurrentChannel, removeFromHistory, clearHistory } = useIPTVStore();

  if (history.length === 0) return null;

  const handleResume = (entry: HistoryEntry) => {
    // Find the full Channel object by ID
    const channel = channels.find(c => c.id === entry.channelId);
    if (channel) {
      playerRef?.current?.requestFullscreen();
      setCurrentChannel(channel);
    } else {
      // Channel may not be in current playlist — create a minimal one from history
      playerRef?.current?.requestFullscreen();
      setCurrentChannel({
        id: entry.channelId,
        name: entry.name,
        url: entry.url,
        logo: entry.logo,
        group: entry.group,
        contentType: entry.contentType,
      });
    }
  };

  const typeIcon = (entry: HistoryEntry) => {
    if (entry.contentType === 'movie') return <Film className="w-4 h-4 text-blue-400" />;
    if (entry.contentType === 'series') return <Clapperboard className="w-4 h-4 text-amber-400" />;
    return <Tv className="w-4 h-4 text-violet-400" />;
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}m atrás`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h atrás`;
    return `${Math.floor(hrs / 24)}d atrás`;
  };

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
            Continuar a Ver
          </h2>
        </div>
        <button
          onClick={clearHistory}
          className="text-xs text-gray-700 hover:text-red-400 transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Limpar
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10">
        {history.map(entry => (
          <div
            key={entry.channelId}
            className="group relative shrink-0 w-44 rounded-xl border border-white/5 bg-gray-800/60 hover:border-violet-500/30 hover:bg-gray-800 transition-all duration-200 cursor-pointer overflow-hidden"
            onClick={() => handleResume(entry)}
          >
            {/* Thumbnail */}
            <div className="aspect-video bg-gray-900 flex items-center justify-center relative overflow-hidden">
              {entry.logo ? (
                <>
                  <img
                    src={entry.logo}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-15 blur-md scale-110"
                    aria-hidden
                  />
                  <img
                    src={entry.logo}
                    alt={entry.name}
                    className="relative max-h-10 max-w-[80%] object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </>
              ) : (
                <div className="flex items-center justify-center">{typeIcon(entry)}</div>
              )}

              {/* Play overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-10 h-10 rounded-full bg-violet-600/90 flex items-center justify-center">
                    <Play className="w-4 h-4 text-white ml-0.5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="px-2 py-2">
              <div className="flex items-center gap-1 mb-0.5">
                {typeIcon(entry)}
                <p className="text-xs text-gray-300 font-medium truncate flex-1">{entry.name}</p>
              </div>
              <p className="text-xs text-gray-600">{timeAgo(entry.watchedAt)}</p>
            </div>

            {/* Remove button */}
            <button
              onClick={e => { e.stopPropagation(); removeFromHistory(entry.channelId); }}
              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-black/60 rounded-full text-gray-400 hover:text-red-400"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistorySection;
