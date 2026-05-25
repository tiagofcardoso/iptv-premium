import React from 'react';
import { Tv, Clapperboard, RefreshCw, Wifi, WifiOff, Loader2, Download, Settings } from 'lucide-react';
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

const FALLBACK_POSTERS = [
  'https://image.tmdb.org/t/p/w300/1g0zz53tbmd7o40yqvnVj9xmiR8.jpg', // Spider-Man
  'https://image.tmdb.org/t/p/w300/RYMX2wc7h6uzcj86LgnFB8qMR4.jpg', // Avengers
  'https://image.tmdb.org/t/p/w300/d5Nguix71eJ6732v2xmG6yII20v.jpg', // Dune
  'https://image.tmdb.org/t/p/w300/8Gxv2wSdqwZCNy7V5suhgyvjkgL.jpg', // Oppenheimer
  'https://image.tmdb.org/t/p/w300/qJ2tW6WMUDmg91j1CWfeHjC48N5.jpg', // Batman
  'https://image.tmdb.org/t/p/w300/gEU2QvIPwcwqn1vSfVFFlpHQZSL.jpg', // Interstellar
  'https://image.tmdb.org/t/p/w300/ty85bU2oLMw5as575nZ7t5n1K5B.jpg', // Gladiator
  'https://image.tmdb.org/t/p/w300/udDclsubCe1corj1v0upg3SMF4F.jpg', // Joker
  'https://image.tmdb.org/t/p/w300/6FfCtAuVA66wbJqSYSRjoZ03X1z.jpg', // Star Wars
  'https://image.tmdb.org/t/p/w300/oU76qV8kySUV46qX77MgSG0j44A.jpg', // Jurassic Park
  'https://image.tmdb.org/t/p/w300/f89U3wLrjFutm68n7G14SVnfxQE.jpg', // Matrix
  'https://image.tmdb.org/t/p/w300/d5iLLOFmxe9hnmKBw64hx2xbNsZ.jpg', // Pulp Fiction
  'https://image.tmdb.org/t/p/w300/9gk7adHYeZCE1324miEwH2u2OV2.jpg', // Inception
  'https://image.tmdb.org/t/p/w300/9xj7v4a65EQPAwzk4e25wfs85C5.jpg', // Titanic
  'https://image.tmdb.org/t/p/w300/6oom5Qn26v65cuN6Q08h97EOFQS.jpg', // Lord of the Rings
  'https://image.tmdb.org/t/p/w300/kyeqWzo2vQUygj2ZNrMj562nU0C.jpg', // Avatar
];

// ─── Custom Movie Reel SVG (Exactly like mockup) ────────────────────────────────
const MovieReelIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
    <circle cx="12" cy="7" r="1.5" fill="currentColor" />
    <circle cx="12" cy="17" r="1.5" fill="currentColor" />
    <circle cx="7" cy="12" r="1.5" fill="currentColor" />
    <circle cx="17" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

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
      if (list.length >= 24) break;
    }

    // 2. Collect series posters
    for (const ch of seriesChannels) {
      if (ch.logo && ch.logo.startsWith('http') && !seen.has(ch.logo)) {
        seen.add(ch.logo);
        list.push(ch.logo);
      }
      if (list.length >= 36) break;
    }

    // Mix in fallback posters so we always have a rich grid, even on first load
    if (list.length < 18) {
      for (const url of FALLBACK_POSTERS) {
        if (!seen.has(url)) {
          seen.add(url);
          list.push(url);
        }
      }
    }

    return list;
  }, [liveChannels, movieChannels, seriesChannels]);

  // Split posters into six rows to cover the entire screen from top to bottom
  const rowLength = Math.ceil(posters.length / 6);
  const row1 = posters.slice(0, rowLength);
  const row2 = posters.slice(rowLength, rowLength * 2);
  const row3 = posters.slice(rowLength * 2, rowLength * 3);
  const row4 = posters.slice(rowLength * 3, rowLength * 4);
  const row5 = posters.slice(rowLength * 4, rowLength * 5);
  const row6 = posters.slice(rowLength * 5);

  // Helper to ensure lists are long enough for seamless scroll
  const duplicateList = (arr: string[]) => {
    if (arr.length === 0) return [];
    let result = [...arr];
    while (result.length < 12) {
      result = [...result, ...arr];
    }
    return [...result, ...result]; // Duplicate for seamless infinite marquee transition
  };

  const r1Double = duplicateList(row1);
  const r2Double = duplicateList(row2);
  const r3Double = duplicateList(row3);
  const r4Double = duplicateList(row4);
  const r5Double = duplicateList(row5);
  const r6Double = duplicateList(row6);

  const renderPoster = (logo: string, idx: number) => {
    return (
      <img
        key={`${logo}-${idx}`}
        src={logo}
        alt=""
        loading="lazy"
        className="w-[100px] h-[150px] sm:w-[130px] sm:h-[195px] rounded-2xl object-cover shrink-0 border border-white/5 shadow-lg opacity-[0.28] brightness-[0.7] contrast-[1.05] saturate-[0.9] hover:opacity-[0.8] transition-all duration-500"
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0 bg-[#030712]">
      {/* 3D Perspective Grid Container */}
      <div
        className="absolute w-[220%] h-[220%] -left-[60%] -top-[60%] flex flex-col gap-5 transition-all duration-1000"
        style={{
          transform: 'rotate(-12deg) skewX(-12deg) scale(1.22) translateY(-2%)',
          willChange: 'transform'
        }}
      >
        {/* Row 1: Left scrolling */}
        {r1Double.length > 0 && (
          <div className="flex gap-5 overflow-hidden">
            <div className="animate-marquee-left flex gap-5">
              {r1Double.map((logo, idx) => renderPoster(logo, idx))}
            </div>
          </div>
        )}

        {/* Row 2: Right scrolling */}
        {r2Double.length > 0 && (
          <div className="flex gap-5 overflow-hidden">
            <div className="animate-marquee-right flex gap-5">
              {r2Double.map((logo, idx) => renderPoster(logo, idx))}
            </div>
          </div>
        )}

        {/* Row 3: Left scrolling */}
        {r3Double.length > 0 && (
          <div className="flex gap-5 overflow-hidden">
            <div className="animate-marquee-left flex gap-5">
              {r3Double.map((logo, idx) => renderPoster(logo, idx))}
            </div>
          </div>
        )}

        {/* Row 4: Right scrolling */}
        {r4Double.length > 0 && (
          <div className="flex gap-5 overflow-hidden">
            <div className="animate-marquee-right flex gap-5">
              {r4Double.map((logo, idx) => renderPoster(logo, idx))}
            </div>
          </div>
        )}

        {/* Row 5: Left scrolling */}
        {r5Double.length > 0 && (
          <div className="flex gap-5 overflow-hidden">
            <div className="animate-marquee-left flex gap-5">
              {r5Double.map((logo, idx) => renderPoster(logo, idx))}
            </div>
          </div>
        )}

        {/* Row 6: Right scrolling */}
        {r6Double.length > 0 && (
          <div className="flex gap-5 overflow-hidden">
            <div className="animate-marquee-right flex gap-5">
              {r6Double.map((logo, idx) => renderPoster(logo, idx))}
            </div>
          </div>
        )}
      </div>

      {/* Dark Vignettes & Blurs to match mockup design exactly */}
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-gray-950/70 z-1" />
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[0.5px] z-1" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,#030712_98%)] z-1" />
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
    },
    {
      key: 'movies' as const,
      icon: MovieReelIcon,
      label: 'FILMES',
    },
    {
      key: 'series' as const,
      icon: Clapperboard,
      label: 'SÉRIES',
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
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 backdrop-blur-md bg-black/10 shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-violet-850 flex items-center justify-center shadow-lg shadow-violet-600/30 border border-violet-500/20">
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

        {/* ── Center Content: Redesigned Cards to match Mockup exactly ── */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-hidden">
          {/* Grid of the three key cards centered side-by-side */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-4xl mx-auto">
            {sections.map(({ key, icon: Icon, label }) => (
              <div
                key={key}
                id={`section-${key}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSection(key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSection(key); } }}
                className="focusable-tv group flex flex-col items-center justify-center 
                  bg-[#0e0c1b]/60 backdrop-blur-md
                  rounded-[24px] border-2 border-violet-500/20
                  w-48 h-56 sm:w-52 sm:h-60 cursor-pointer
                  transition-all duration-300
                  hover:scale-[1.05] hover:border-violet-400/80
                  focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/25 focus:scale-[1.05]
                  shadow-[0_0_30px_rgba(139,92,246,0.06)] focus:shadow-[0_0_45px_rgba(139,92,246,0.3)]
                  active:scale-[0.98]"
              >
                {/* Icon */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-focus:scale-110">
                  <Icon className="w-full h-full text-violet-300/90 group-hover:text-violet-200 group-focus:text-violet-200 transition-colors duration-300 stroke-[1.25]" />
                </div>

                {/* Label */}
                <span className="text-white font-extrabold text-sm sm:text-base tracking-widest leading-tight uppercase mt-5 transition-colors group-hover:text-violet-100">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* ── Status bar (subtle at the bottom) ── */}
          <div className="flex items-center justify-between w-full max-w-4xl gap-3 mt-8">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-black/30 border border-white/5 backdrop-blur-sm flex-1 min-w-0">
              <Tv className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              <p className="text-[11px] text-gray-500 font-semibold truncate">
                {channelsCount > 0
                  ? `${channelsCount.toLocaleString('pt-PT')} canais, ${moviesCount.toLocaleString('pt-PT')} filmes, ${seriesCount.toLocaleString('pt-PT')} séries listados`
                  : 'Nenhuma lista M3U adicionada'}
              </p>
            </div>

            <button
              onClick={onForceRefresh}
              className="focusable-tv flex items-center gap-2 px-4 py-2 rounded-xl bg-black/30 border border-white/5 hover:border-violet-500/30 hover:bg-white/5 backdrop-blur-sm transition-all group shrink-0"
            >
              <RefreshCw className="w-3 h-3 text-gray-600 group-hover:text-violet-400 group-focus:text-violet-400 transition-colors" />
              <span className="text-[11px] text-gray-500 group-hover:text-violet-400 group-focus:text-violet-400 hidden sm:block transition-colors font-semibold">
                {lastUpdated ?? 'Atualizar Lista'}
              </span>
              <span className="text-[11px] text-gray-500 group-hover:text-violet-400 group-focus:text-violet-400 sm:hidden font-semibold">
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
