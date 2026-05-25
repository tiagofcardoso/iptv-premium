import React from 'react';
import { Tv, Film, Clapperboard, RefreshCw, Wifi, WifiOff, Loader2, Download, Settings } from 'lucide-react';
import { useIPTVStore } from '../store/useIPTVStore.ts';

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

// ─── Netflix-style 3D Scrolling Poster Background ───────────────────────────────
const NetflixPosterBackground: React.FC = () => {
  const { liveChannels, movieChannels, seriesChannels } = useIPTVStore();

  const posters = React.useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    // 1. Collect movie posters
    for (const ch of movieChannels) {
      if (ch.logo && ch.logo.startsWith('http') && !seen.has(ch.logo)) {
        seen.add(ch.logo);
        list.push(ch.logo);
      }
      if (list.length >= 18) break;
    }

    // 2. Collect series posters
    for (const ch of seriesChannels) {
      if (ch.logo && ch.logo.startsWith('http') && !seen.has(ch.logo)) {
        seen.add(ch.logo);
        list.push(ch.logo);
      }
      if (list.length >= 30) break;
    }

    // 3. Collect sports channel/event logos
    for (const ch of liveChannels) {
      const name = ch.name.toUpperCase();
      const isSports = name.includes('SPORT') || name.includes('ESPN') || name.includes('DAZN') || name.includes('PREMIERE') || name.includes('BENFICA') || name.includes('VIVO');
      if (isSports && ch.logo && ch.logo.startsWith('http') && !seen.has(ch.logo)) {
        seen.add(ch.logo);
        list.push(ch.logo);
      }
      if (list.length >= 36) break;
    }

    // Fallback placeholders if the playlist is empty (first launch)
    if (list.length === 0) {
      return Array.from({ length: 24 }).map((_, i) => `fallback-${i}`);
    }

    return list;
  }, [liveChannels, movieChannels, seriesChannels]);

  // Split posters into three rows for vertical perspective collage
  const rowLength = Math.ceil(posters.length / 3);
  const row1 = posters.slice(0, rowLength);
  const row2 = posters.slice(rowLength, rowLength * 2);
  const row3 = posters.slice(rowLength * 2);

  // Helper to ensure lists are long enough for seamless scroll
  const duplicateList = (arr: string[]) => {
    if (arr.length === 0) return [];
    let result = [...arr];
    while (result.length < 15) {
      result = [...result, ...arr];
    }
    return [...result, ...result]; // Duplicate for seamless infinite marquee transition
  };

  const r1Double = duplicateList(row1);
  const r2Double = duplicateList(row2);
  const r3Double = duplicateList(row3);

  const renderPoster = (logo: string, idx: number) => {
    if (logo.startsWith('fallback-')) {
      const hue = (idx * 45) % 360;
      return (
        <div
          key={`${logo}-${idx}`}
          className="w-[100px] h-[150px] sm:w-[130px] sm:h-[195px] rounded-xl shrink-0 border border-white/5 flex flex-col items-center justify-center p-3 text-center"
          style={{ background: `linear-gradient(135deg, hsl(${hue}, 50%, 12%) 0%, hsl(${hue}, 40%, 4%) 100%)` }}
        >
          <Film className="w-7 h-7 text-white/10 mb-2 stroke-[1]" />
          <span className="text-[9px] text-white/20 font-bold tracking-widest uppercase">CINE</span>
        </div>
      );
    }

    return (
      <img
        key={`${logo}-${idx}`}
        src={logo}
        alt=""
        loading="lazy"
        className="w-[100px] h-[150px] sm:w-[130px] sm:h-[195px] rounded-xl object-cover shrink-0 border border-white/5 shadow-md brightness-[0.8] saturate-[0.8] hover:brightness-100 transition-all duration-300"
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
      {/* 3D Perspective Grid Container */}
      <div
        className="absolute w-[200%] h-[200%] -left-[50%] -top-[50%] flex flex-col gap-4 transition-all duration-1000"
        style={{
          transform: 'rotate(-12deg) skewX(-12deg) scale(1.15) translateY(-5%)',
          willChange: 'transform'
        }}
      >
        {/* Row 1: Left scrolling */}
        {r1Double.length > 0 && (
          <div className="flex gap-4 overflow-hidden">
            <div className="animate-marquee-left flex gap-4">
              {r1Double.map((logo, idx) => renderPoster(logo, idx))}
            </div>
          </div>
        )}

        {/* Row 2: Right scrolling (reverse) */}
        {r2Double.length > 0 && (
          <div className="flex gap-4 overflow-hidden">
            <div className="animate-marquee-right flex gap-4">
              {r2Double.map((logo, idx) => renderPoster(logo, idx))}
            </div>
          </div>
        )}

        {/* Row 3: Left scrolling */}
        {r3Double.length > 0 && (
          <div className="flex gap-4 overflow-hidden">
            <div className="animate-marquee-left flex gap-4">
              {r3Double.map((logo, idx) => renderPoster(logo, idx))}
            </div>
          </div>
        )}
      </div>

      {/* Dark Vignettes & Blurs to enhance legibility of foreground */}
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/70 to-gray-950/90 z-1" />
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] z-1" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,#030712_95%)] z-1" />
    </div>
  );
};

// ─── HomeScreen Component ───────────────────────────────────────────────────────
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
      border: 'border-white/10 hover:border-violet-500/50 focus:border-violet-500/80',
      glow: 'hover:shadow-violet-600/20 focus:shadow-violet-600/40',
      focusRing: 'focus:ring-violet-500/40',
      iconColor: 'text-violet-400 group-hover:text-violet-300 group-focus:text-violet-300',
    },
    {
      key: 'movies' as const,
      icon: Film,
      label: 'FILMES',
      count: moviesCount,
      border: 'border-white/10 hover:border-blue-500/50 focus:border-blue-500/80',
      glow: 'hover:shadow-blue-600/20 focus:shadow-blue-600/40',
      focusRing: 'focus:ring-blue-500/40',
      iconColor: 'text-blue-400 group-hover:text-blue-300 group-focus:text-blue-300',
    },
    {
      key: 'series' as const,
      icon: Clapperboard,
      label: 'SÉRIES',
      count: seriesCount,
      border: 'border-white/10 hover:border-amber-500/50 focus:border-amber-500/80',
      glow: 'hover:shadow-amber-600/20 focus:shadow-amber-600/40',
      focusRing: 'focus:ring-amber-500/40',
      iconColor: 'text-amber-400 group-hover:text-amber-300 group-focus:text-amber-300',
    },
  ];

  const proxyClass = proxyStatus === 'checking'
    ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
    : proxyStatus === 'online'
    ? 'bg-green-500/10 border-green-500/20 text-green-400'
    : 'bg-red-500/10 border-red-500/20 text-red-400';

  return (
    <div className="relative flex flex-col h-full bg-gray-950 select-none overflow-hidden">
      {/* Dynamic Background */}
      <NetflixPosterBackground />

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-md bg-black/20 shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-lg shadow-violet-600/30 border border-violet-500/30">
              <Tv className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-white font-extrabold text-sm tracking-wider uppercase">IPTV</span>
              <span className="text-violet-400 font-extrabold text-sm tracking-wider uppercase ml-1">Premium</span>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            {/* TV App Download */}
            <a
              href="https://drive.google.com/uc?export=download&id=1uaEDiEtXDLAuOZ8herlYwzicCY2A13OM"
              target="_blank"
              rel="noopener noreferrer"
              className="focusable-tv flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/30 text-gray-200 rounded-xl text-xs font-bold transition-all active:scale-[0.97]"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">App TV</span>
            </a>

            {/* Web App Install */}
            {installPrompt && (
              <button
                onClick={onInstall}
                className="focusable-tv flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.97] shadow-lg shadow-violet-600/20"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Instalar</span>
              </button>
            )}

            {/* Proxy status */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${proxyClass}`}>
              {proxyStatus === 'checking'
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="hidden xs:inline">A ligar…</span></>
                : proxyStatus === 'online'
                ? <><Wifi className="w-3.5 h-3.5" /><span className="hidden xs:inline">Online</span></>
                : <><WifiOff className="w-3.5 h-3.5" /><span className="hidden xs:inline">Offline</span></>
              }
            </div>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="focusable-tv p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all text-gray-400 hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── 3 tiles — fill remaining space ── */}
        <div className="flex-1 flex flex-col justify-center gap-4 px-6 py-6 overflow-hidden">
          
          <div className="text-center mb-2 max-w-xl mx-auto space-y-1">
            <h2 className="text-white text-lg sm:text-2xl font-black tracking-wide uppercase drop-shadow">Selecione uma Categoria</h2>
            <p className="text-gray-400 text-xs sm:text-sm font-medium drop-shadow-md">Navegue pelas transmissões ao vivo ou assista aos seus títulos favoritos.</p>
          </div>

          {/* Grid: 1 col on mobile, 3 cols on tablet+ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl mx-auto">
            {sections.map(({ key, icon: Icon, label, count, border, glow, focusRing, iconColor }) => (
              <div
                key={key}
                id={`section-${key}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSection(key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSection(key); } }}
                className={`
                  focusable-tv group flex sm:flex-col items-center sm:justify-center gap-4 sm:gap-4
                  bg-glass backdrop-blur-md
                  rounded-2xl border ${border}
                  px-5 py-4 sm:py-9 sm:px-6 cursor-pointer
                  transition-all duration-300
                  hover:scale-[1.04] hover:shadow-2xl ${glow}
                  focus:outline-none focus:ring-4 ${focusRing} focus:scale-[1.04]
                  active:scale-[0.98]
                  min-h-[76px] sm:min-h-[170px]
                `}
              >
                {/* Icon */}
                <div className="w-10 h-10 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-focus:scale-110">
                  <Icon className={`w-full h-full stroke-[1.2] transition-colors duration-300 ${iconColor}`} />
                </div>

                {/* Text */}
                <div className="flex flex-col sm:items-center text-left sm:text-center min-w-0">
                  <span className="text-white font-extrabold text-sm sm:text-base tracking-wider leading-tight group-hover:text-white transition-colors">{label}</span>
                  {count > 0 && (
                    <span className="text-white/40 text-[10px] sm:text-xs mt-1 font-semibold group-hover:text-white/60 transition-colors">
                      {count.toLocaleString('pt-PT')} itens
                    </span>
                  )}
                </div>

                {/* Arrow (mobile only) */}
                <div className="ml-auto sm:hidden text-white/30">›</div>
              </div>
            ))}
          </div>

          {/* ── Status row ── */}
          <div className="flex items-center justify-between w-full max-w-4xl mx-auto gap-3 mt-2">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-black/40 border border-white/5 backdrop-blur-sm flex-1 min-w-0">
              <Tv className="w-4 h-4 text-gray-500 shrink-0" />
              <p className="text-xs text-gray-400 font-semibold truncate">
                {channelsCount > 0 ? `${channelsCount.toLocaleString('pt-PT')} canais listados` : 'Nenhuma lista M3U adicionada'}
              </p>
            </div>

            <button
              onClick={onForceRefresh}
              className="focusable-tv flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black/40 border border-white/5 hover:border-violet-500/30 hover:bg-white/5 backdrop-blur-sm transition-all group shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-500 group-hover:text-violet-400 group-focus:text-violet-400 transition-colors" />
              <span className="text-xs text-gray-400 group-hover:text-violet-400 group-focus:text-violet-400 hidden sm:block transition-colors font-semibold">
                {lastUpdated ?? 'Atualizar Lista'}
              </span>
              <span className="text-xs text-gray-400 group-hover:text-violet-400 group-focus:text-violet-400 sm:hidden font-semibold">
                Atualizar
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default HomeScreen;
