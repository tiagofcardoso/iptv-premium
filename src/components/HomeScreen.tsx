import React from 'react';
import { Tv, Film, Clapperboard, RefreshCw, List, Wifi, WifiOff, Loader2, Download } from 'lucide-react';

interface HomeScreenProps {
  channelsCount: number;
  moviesCount: number;
  seriesCount: number;
  proxyStatus: 'checking' | 'online' | 'offline';
  onSelectSection: (section: 'live' | 'movies' | 'series') => void;
  onForceRefresh: () => void;
  lastUpdated: string | null;
  installPrompt: any;
  onInstall: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  channelsCount, moviesCount, seriesCount, proxyStatus,
  onSelectSection, onForceRefresh, lastUpdated, installPrompt, onInstall,
}) => {
  const sections = [
    {
      key: 'live' as const,
      icon: Tv,
      label: 'TV AO VIVO',
      count: channelsCount,
      gradient: 'from-violet-900/80 to-violet-950',
      border: 'border-violet-500/30 hover:border-violet-400/60',
      glow: 'hover:shadow-violet-500/20',
    },
    {
      key: 'movies' as const,
      icon: Film,
      label: 'FILMES',
      count: moviesCount,
      gradient: 'from-blue-900/80 to-blue-950',
      border: 'border-blue-500/30 hover:border-blue-400/60',
      glow: 'hover:shadow-blue-500/20',
    },
    {
      key: 'series' as const,
      icon: Clapperboard,
      label: 'SÉRIES',
      count: seriesCount,
      gradient: 'from-amber-900/80 to-amber-950',
      border: 'border-amber-500/30 hover:border-amber-400/60',
      glow: 'hover:shadow-amber-500/20',
    },
  ];

  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <div className="flex flex-col h-full bg-gray-950 select-none">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Tv className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-base">IPTV</span>
            <span className="text-violet-400 font-bold text-base ml-1.5">Premium</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="hidden sm:block font-mono text-xs">{timeStr} | {dateStr}</span>

          {/* PWA Install button — shown only when not yet installed */}
          {installPrompt && (
            <button
              onClick={onInstall}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-violet-500/20 animate-pulse"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Instalar App</span>
            </button>
          )}

          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            proxyStatus === 'checking'
              ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
              : proxyStatus === 'online'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {proxyStatus === 'checking'
              ? <><Loader2 className="w-3 h-3 animate-spin" /> A ligar…</>
              : proxyStatus === 'online'
              ? <><Wifi className="w-3 h-3" /> Online</>
              : <><WifiOff className="w-3 h-3" /> Offline</>
            }
          </div>
        </div>
      </div>

      {/* ── Main 3 tiles ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full max-w-3xl">
          {sections.map(({ key, icon: Icon, label, count, gradient, border, glow }) => (
            <button
              key={key}
              onClick={() => onSelectSection(key)}
              className={`
                group relative flex flex-col items-center justify-center gap-4
                bg-gradient-to-b ${gradient}
                rounded-2xl border ${border}
                p-8 sm:p-10 cursor-pointer
                transition-all duration-300
                hover:scale-[1.03] hover:shadow-2xl ${glow}
                active:scale-[0.98]
              `}
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                <Icon className="w-full h-full text-white/90 stroke-[1.2]" />
              </div>
              <span className="text-white font-bold text-lg sm:text-xl tracking-widest">{label}</span>
              {count > 0 && (
                <span className="text-white/40 text-xs">{count.toLocaleString()} itens</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Bottom status bar ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900 border border-white/5">
            <List className="w-4 h-4 text-gray-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Lista de Reprodução</p>
              <p className="text-sm text-white font-medium truncate">
                {channelsCount > 0 ? `${channelsCount.toLocaleString()} canais carregados` : 'Sem lista carregada'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900 border border-white/5">
            <Tv className="w-4 h-4 text-gray-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Reprodução de TV</p>
              <p className="text-sm text-white font-medium">HLS via Render Proxy</p>
            </div>
          </div>

          <button
            onClick={onForceRefresh}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-900 border border-white/5 hover:border-violet-500/30 hover:bg-gray-800 transition-all text-left group"
          >
            <RefreshCw className="w-4 h-4 text-gray-500 group-hover:text-violet-400 transition-colors shrink-0" />
            <div>
              <p className="text-xs text-gray-500 group-hover:text-violet-400 transition-colors">Forçar Actualização</p>
              <p className="text-sm text-white font-medium">
                {lastUpdated ? `${lastUpdated}` : 'Nunca actualizado'}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
