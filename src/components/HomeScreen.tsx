import React from 'react';
import { Tv, Film, Clapperboard, RefreshCw, Wifi, WifiOff, Loader2, Download, Settings } from 'lucide-react';

interface HomeScreenProps {
  channelsCount: number;
  moviesCount: number;
  seriesCount: number;
  proxyStatus: 'checking' | 'online' | 'offline';
  onSelectSection: (section: 'live' | 'movies' | 'series') => void;
  onForceRefresh: () => void;
  onOpenSettings: () => void;
  lastUpdated: string | null;
  installPrompt: any;
  onInstall: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  channelsCount, moviesCount, seriesCount, proxyStatus,
  onSelectSection, onForceRefresh, onOpenSettings, lastUpdated, installPrompt, onInstall,
}) => {
  const sections = [
    {
      key: 'live' as const,
      icon: Tv,
      label: 'TV AO VIVO',
      count: channelsCount,
      gradient: 'from-violet-800 to-violet-950',
      border: 'border-violet-500/40',
      glow: 'hover:shadow-violet-500/30',
      activeColor: 'text-violet-300',
    },
    {
      key: 'movies' as const,
      icon: Film,
      label: 'FILMES',
      count: moviesCount,
      gradient: 'from-blue-800 to-blue-950',
      border: 'border-blue-500/40',
      glow: 'hover:shadow-blue-500/30',
      activeColor: 'text-blue-300',
    },
    {
      key: 'series' as const,
      icon: Clapperboard,
      label: 'SÉRIES',
      count: seriesCount,
      gradient: 'from-amber-800 to-amber-950',
      border: 'border-amber-500/40',
      glow: 'hover:shadow-amber-500/30',
      activeColor: 'text-amber-300',
    },
  ];

  const proxyClass = proxyStatus === 'checking'
    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
    : proxyStatus === 'online'
    ? 'bg-green-500/10 border-green-500/30 text-green-400'
    : 'bg-red-500/10 border-red-500/30 text-red-400';

  return (
    <div className="flex flex-col h-full bg-gray-950 select-none overflow-hidden">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Tv className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-sm">IPTV</span>
            <span className="text-violet-400 font-bold text-sm ml-1">Premium</span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* TV App Download */}
          <a
            href="/iptv-premium.apk"
            download
            className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/30 rounded-lg text-xs font-semibold transition-colors"
          >
            <Download className="w-3 h-3" />
            <span className="hidden xs:inline">App TV</span>
          </a>

          {/* Web App Install */}
          {installPrompt && (
            <button
              onClick={onInstall}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>Instalar</span>
            </button>
          )}

          {/* Proxy status */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${proxyClass}`}>
            {proxyStatus === 'checking'
              ? <><Loader2 className="w-3 h-3 animate-spin" /><span className="hidden xs:inline ml-1">A ligar</span></>
              : proxyStatus === 'online'
              ? <><Wifi className="w-3 h-3" /><span className="hidden xs:inline ml-1">Online</span></>
              : <><WifiOff className="w-3 h-3" /><span className="hidden xs:inline ml-1">Offline</span></>
            }
          </div>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* ── 3 tiles — fill remaining space ── */}
      <div className="flex-1 flex flex-col justify-center gap-3 px-4 py-4 overflow-hidden">

        {/* Grid: 1 col on mobile (horizontal cards), 3 cols on tablet+ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl mx-auto">
          {sections.map(({ key, icon: Icon, label, count, gradient, border, glow }) => (
            <button
              key={key}
              id={`section-${key}`}
              onClick={() => onSelectSection(key)}
              className={`
                group flex sm:flex-col items-center sm:justify-center gap-4 sm:gap-3
                bg-gradient-to-br ${gradient}
                rounded-2xl border ${border}
                px-5 py-4 sm:py-8 sm:px-6 cursor-pointer
                transition-all duration-200
                hover:brightness-110 hover:shadow-xl ${glow}
                active:scale-[0.97]
                min-h-[72px] sm:min-h-[140px]
              `}
            >
              {/* Icon */}
              <div className="w-10 h-10 sm:w-14 sm:h-14 shrink-0 flex items-center justify-center">
                <Icon className="w-full h-full text-white/90 stroke-[1.2]" />
              </div>

              {/* Text */}
              <div className="flex flex-col sm:items-center text-left sm:text-center min-w-0">
                <span className="text-white font-bold text-base sm:text-lg tracking-wider leading-tight">{label}</span>
                {count > 0 && (
                  <span className="text-white/40 text-xs mt-0.5">{count.toLocaleString('pt-PT')} itens</span>
                )}
              </div>

              {/* Arrow (mobile only) */}
              <div className="ml-auto sm:hidden text-white/30">›</div>
            </button>
          ))}
        </div>

        {/* ── Status row ── */}
        <div className="flex items-center justify-between w-full max-w-3xl mx-auto gap-2 mt-1">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 border border-white/5 flex-1 min-w-0">
            <Tv className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <p className="text-xs text-gray-400 truncate">
              {channelsCount > 0 ? `${channelsCount.toLocaleString('pt-PT')} canais` : 'Sem lista M3U'}
            </p>
          </div>

          <button
            onClick={onForceRefresh}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 border border-white/5 hover:border-violet-500/30 hover:bg-gray-800 transition-all group shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-500 group-hover:text-violet-400 transition-colors" />
            <span className="text-xs text-gray-400 group-hover:text-violet-400 hidden sm:block transition-colors">
              {lastUpdated ?? 'Actualizar'}
            </span>
            <span className="text-xs text-gray-400 sm:hidden">
              Actualizar
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default HomeScreen;
