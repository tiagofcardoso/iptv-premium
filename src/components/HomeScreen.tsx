import React from 'react';
import { Tv, Clapperboard, RefreshCw, Wifi, WifiOff, Loader2, Download, Settings } from 'lucide-react';

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

// ─── CSS-only movie poster cards — no external URLs needed ─────────────────────
// Each card has a unique gradient palette + text label to simulate a real poster
const POSTER_CARDS: { gradient: string; label: string; sub: string }[] = [
  { gradient: 'linear-gradient(145deg,#1a0533 0%,#4c1d95 40%,#7c3aed 100%)', label: 'ACTION', sub: 'BLOCKBUSTER' },
  { gradient: 'linear-gradient(145deg,#0c1a2e 0%,#1e3a5f 40%,#2563eb 100%)', label: 'SCI-FI', sub: 'SPACE EPIC' },
  { gradient: 'linear-gradient(145deg,#1a0a00 0%,#7c2d12 40%,#ea580c 100%)', label: 'DRAMA', sub: 'AWARD WINNER' },
  { gradient: 'linear-gradient(145deg,#0f1a0f 0%,#14532d 40%,#16a34a 100%)', label: 'THRILLER', sub: 'SUSPENSE' },
  { gradient: 'linear-gradient(145deg,#1a0022 0%,#6b21a8 40%,#a855f7 100%)', label: 'FANTASY', sub: 'EPIC SAGA' },
  { gradient: 'linear-gradient(145deg,#1a1100 0%,#713f12 40%,#ca8a04 100%)', label: 'ADVENTURE', sub: 'ACTION' },
  { gradient: 'linear-gradient(145deg,#0d1117 0%,#1c1c2e 40%,#4a4a8a 100%)', label: 'MYSTERY', sub: 'CRIME' },
  { gradient: 'linear-gradient(145deg,#1a0010 0%,#831843 40%,#db2777 100%)', label: 'ROMANCE', sub: 'DRAMA' },
  { gradient: 'linear-gradient(145deg,#001a1a 0%,#134e4a 40%,#0d9488 100%)', label: 'SPORT', sub: 'LIVE EVENT' },
  { gradient: 'linear-gradient(145deg,#1a1a00 0%,#365314 40%,#65a30d 100%)', label: 'NATURE', sub: 'DOCUMENTARY' },
  { gradient: 'linear-gradient(145deg,#1c0a1c 0%,#581c87 40%,#9333ea 100%)', label: 'HORROR', sub: 'THRILLER' },
  { gradient: 'linear-gradient(145deg,#001422 0%,#0c4a6e 40%,#0284c7 100%)', label: 'OCEAN', sub: 'ADVENTURE' },
  { gradient: 'linear-gradient(145deg,#220000 0%,#7f1d1d 40%,#dc2626 100%)', label: 'WAR', sub: 'EPIC' },
  { gradient: 'linear-gradient(145deg,#0a0a1a 0%,#1e1b4b 40%,#4338ca 100%)', label: 'SPACE', sub: 'ODYSSEY' },
  { gradient: 'linear-gradient(145deg,#1a0808 0%,#7c2020 40%,#b91c1c 100%)', label: 'SERIES', sub: 'SEASON 1' },
  { gradient: 'linear-gradient(145deg,#0a1a0a 0%,#1a4731 40%,#059669 100%)', label: 'LIVE TV', sub: 'SPORTS HD' },
  { gradient: 'linear-gradient(145deg,#1a1200 0%,#78350f 40%,#d97706 100%)', label: 'COMEDY', sub: 'BEST OF' },
  { gradient: 'linear-gradient(145deg,#0e0015 0%,#4c0280 40%,#7c2ef0 100%)', label: 'ANIME', sub: 'SERIES' },
  { gradient: 'linear-gradient(145deg,#001a14 0%,#064e3b 40%,#10b981 100%)', label: 'NATURE', sub: 'WILD' },
  { gradient: 'linear-gradient(145deg,#1a000e 0%,#7c0032 40%,#db1e6e 100%)', label: 'MUSIC', sub: 'CONCERT' },
  { gradient: 'linear-gradient(145deg,#001622 0%,#0a3d5e 40%,#1d7fba 100%)', label: 'NEWS', sub: 'LIVE' },
  { gradient: 'linear-gradient(145deg,#150030 0%,#2e006a 40%,#6d28d9 100%)', label: 'KIDS', sub: 'ANIMATION' },
  { gradient: 'linear-gradient(145deg,#001010 0%,#134545 40%,#0e7f80 100%)', label: 'TRAVEL', sub: 'EXPLORE' },
  { gradient: 'linear-gradient(145deg,#220a00 0%,#7c2800 40%,#c2440e 100%)', label: 'HISTORY', sub: 'DOCUMENTARY' },
];

// ─── SVG icons per poster card ────────────────────────────────────────────────
const PosterIcon: React.FC<{ index: number }> = ({ index }) => {
  const icons = [
    // Film strip
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-8 h-8 text-white/40">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16M17 4v16M2 9h20M2 15h20"/>
    </svg>,
    // Star
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-8 h-8 text-white/40">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
    </svg>,
    // TV
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-8 h-8 text-white/40">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21l4-4 4 4M12 17v4"/>
    </svg>,
    // Globe
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="w-8 h-8 text-white/40">
      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>,
  ];
  return icons[index % icons.length];
};

// ─── Static CSS-only Netflix poster background ────────────────────────────────
const NetflixPosterBackground: React.FC = () => {
  // Duplicate cards to fill rows fully for seamless marquee
  const makeRow = (offset: number, count: number) => {
    const row: typeof POSTER_CARDS = [];
    for (let i = 0; i < count; i++) {
      row.push(POSTER_CARDS[(i + offset) % POSTER_CARDS.length]);
    }
    // Double for seamless infinite scroll
    return [...row, ...row];
  };

  const rows = [
    { cards: makeRow(0, 8), dir: 'left', speed: '80s' },
    { cards: makeRow(6, 8), dir: 'right', speed: '95s' },
    { cards: makeRow(12, 8), dir: 'left', speed: '70s' },
    { cards: makeRow(3, 8), dir: 'right', speed: '85s' },
    { cards: makeRow(9, 8), dir: 'left', speed: '90s' },
    { cards: makeRow(15, 8), dir: 'right', speed: '75s' },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0 bg-[#07091a]">
      {/* 3D Perspective Grid Container — skewed to match mockup perspective */}
      <div
        className="absolute flex flex-col gap-4"
        style={{
          width: '230%',
          height: '220%',
          left: '-65%',
          top: '-55%',
          transform: 'rotate(-14deg) skewX(-10deg) scale(1.1)',
          willChange: 'transform',
        }}
      >
        {rows.map((row, rowIdx) => (
          <div key={rowIdx} className="flex gap-4 overflow-hidden shrink-0">
            <div
              className="flex gap-4 shrink-0"
              style={{
                animation: `marquee-scroll-${row.dir} ${row.speed} linear infinite`,
                willChange: 'transform',
              }}
            >
              {row.cards.map((card, cardIdx) => (
                <div
                  key={cardIdx}
                  className="w-[110px] h-[160px] sm:w-[140px] sm:h-[200px] rounded-xl shrink-0 flex flex-col items-center justify-end p-3 border border-white/8 shadow-2xl relative overflow-hidden"
                  style={{ background: card.gradient }}
                >
                  {/* Shine overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
                  {/* Icon in center */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PosterIcon index={cardIdx + rowIdx * 3} />
                  </div>
                  {/* Label at bottom */}
                  <div className="relative z-10 text-center">
                    <div className="text-white/90 font-black text-[9px] tracking-[0.15em] uppercase">{card.label}</div>
                    <div className="text-white/40 font-semibold text-[7px] tracking-[0.1em] uppercase">{card.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Vignette overlays — lighter at top (shows posters), heavier at bottom (cards area) */}
      {/* Bottom gradient — strong dark band for card area readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#07091a] via-[#07091a]/20 to-transparent" style={{ background: 'linear-gradient(to top, #07091a 32%, rgba(7,9,26,0.5) 55%, transparent 80%)' }} />
      {/* Left/right fade */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #07091a 0%, transparent 12%, transparent 88%, #07091a 100%)' }} />
      {/* Subtle overall darkening to not wash out cards */}
      <div className="absolute inset-0 bg-black/20" />
    </div>
  );
};

// ─── Custom Movie Reel SVG ─────────────────────────────────────────────────────
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

// ─── HomeScreen Component ───────────────────────────────────────────────────────
const HomeScreen: React.FC<HomeScreenProps> = ({
  channelsCount, moviesCount, seriesCount, proxyStatus,
  onSelectSection, onForceRefresh, onOpenSettings, lastUpdated, installPrompt, onInstall,
}) => {
  const sections = [
    { key: 'live' as const, icon: Tv, label: 'TV AO VIVO' },
    { key: 'movies' as const, icon: MovieReelIcon, label: 'FILMES' },
    { key: 'series' as const, icon: Clapperboard, label: 'SÉRIES' },
  ];

  const proxyClass = proxyStatus === 'checking'
    ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
    : proxyStatus === 'online'
    ? 'bg-green-500/10 border-green-500/20 text-green-400'
    : 'bg-red-500/10 border-red-500/20 text-red-400';

  return (
    <div className="relative flex flex-col h-full select-none overflow-hidden" style={{ background: '#07091a' }}>
      {/* ── Poster Background — fills top 70% of screen ── */}
      <NetflixPosterBackground />

      {/* ── Foreground content layer ── */}
      <div className="relative z-10 flex flex-col h-full">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-violet-900 flex items-center justify-center shadow-lg shadow-violet-600/30 border border-violet-500/20">
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

        {/* Spacer — pushes cards to the bottom */}
        <div className="flex-1" />

        {/* ── Bottom section — cards + status bar ── */}
        <div className="px-6 pb-8 shrink-0">
          {/* Three category cards — side by side */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full max-w-3xl mx-auto mb-6">
            {sections.map(({ key, icon: Icon, label }) => (
              <div
                key={key}
                id={`section-${key}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSection(key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSection(key); } }}
                className="focusable-tv group flex flex-col items-center justify-center cursor-pointer
                  w-52 h-44 sm:w-56 sm:h-48
                  rounded-[20px] border border-violet-500/30
                  transition-all duration-300
                  hover:scale-[1.04] hover:border-violet-400/70
                  focus:outline-none focus:border-violet-400 focus:scale-[1.04]
                  active:scale-[0.97]"
                style={{
                  background: 'rgba(12, 8, 28, 0.65)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  boxShadow: '0 0 0 1px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
                }}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-300"
                  style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />

                {/* Icon */}
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 group-focus:scale-110">
                  <Icon className="w-full h-full text-violet-300/85 group-hover:text-violet-200 group-focus:text-violet-200 transition-colors duration-300 stroke-[1.2]" />
                </div>

                {/* Label */}
                <span className="relative text-white font-extrabold text-sm sm:text-[15px] tracking-[0.2em] leading-tight uppercase transition-colors group-hover:text-violet-100">
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between w-full max-w-3xl mx-auto gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/5 backdrop-blur-sm flex-1 min-w-0"
              style={{ background: 'rgba(0,0,0,0.35)' }}>
              <Tv className="w-3.5 h-3.5 text-gray-600 shrink-0" />
              <p className="text-[11px] text-gray-500 font-semibold truncate">
                {channelsCount > 0
                  ? `${channelsCount.toLocaleString('pt-PT')} canais, ${moviesCount.toLocaleString('pt-PT')} filmes, ${seriesCount.toLocaleString('pt-PT')} séries listados`
                  : 'Nenhuma lista M3U adicionada'}
              </p>
            </div>

            <button
              onClick={onForceRefresh}
              className="focusable-tv flex items-center gap-2 px-4 py-2 rounded-xl border border-white/5 hover:border-violet-500/30 hover:bg-white/5 backdrop-blur-sm transition-all group shrink-0"
              style={{ background: 'rgba(0,0,0,0.35)' }}
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
