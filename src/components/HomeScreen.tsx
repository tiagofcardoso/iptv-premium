import React, { useMemo } from 'react';
import { Tv, Clapperboard, RefreshCw, Wifi, WifiOff, Loader2, Download, Settings, Star } from 'lucide-react';
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

// ─── Rich mock poster definitions ─────────────────────────────────────────────
// Each mock banner looks like a real movie/show poster card
const MOCK_BANNERS: {
  title: string;
  genre: string;
  rating: number;
  badge: string;
  bg: string;        // main card background gradient
  accent: string;    // accent colour for the overlay elements
  scene: 'action' | 'space' | 'nature' | 'sport' | 'drama' | 'dark' | 'ocean' | 'fire';
}[] = [
  { title: 'IRON STORM', genre: 'AÇÃO', rating: 4.5, badge: '4K HDR', bg: 'linear-gradient(160deg,#0a0a1a 0%,#1a0533 50%,#2d0a66 100%)', accent: '#a855f7', scene: 'action' },
  { title: 'DEEP SPACE', genre: 'SCI-FI', rating: 4.8, badge: 'ULTRA HD', bg: 'linear-gradient(160deg,#000814 0%,#001d3d 50%,#003566 100%)', accent: '#3b82f6', scene: 'space' },
  { title: 'WILD EARTH', genre: 'DOC', rating: 4.2, badge: 'HD', bg: 'linear-gradient(160deg,#052e16 0%,#14532d 50%,#166534 100%)', accent: '#22c55e', scene: 'nature' },
  { title: 'MATCH DAY', genre: 'DESPORTO', rating: 4.6, badge: 'AO VIVO', bg: 'linear-gradient(160deg,#0c1a0c 0%,#1a3a1a 50%,#2d5a1b 100%)', accent: '#84cc16', scene: 'sport' },
  { title: 'LAST HOPE', genre: 'DRAMA', rating: 4.3, badge: 'HD', bg: 'linear-gradient(160deg,#1a0a00 0%,#431407 50%,#7c2d12 100%)', accent: '#f97316', scene: 'drama' },
  { title: 'SHADOW CODE', genre: 'THRILLER', rating: 4.7, badge: '4K', bg: 'linear-gradient(160deg,#0a0a0a 0%,#1a1a2e 50%,#16213e 100%)', accent: '#64748b', scene: 'dark' },
  { title: 'BLUE ABYSS', genre: 'AVENTURA', rating: 4.4, badge: 'HDR', bg: 'linear-gradient(160deg,#0c0a3e 0%,#06114e 50%,#0e1b74 100%)', accent: '#38bdf8', scene: 'ocean' },
  { title: 'EMBER WARS', genre: 'ÉPICO', rating: 4.9, badge: '4K HDR', bg: 'linear-gradient(160deg,#1c0000 0%,#4a0404 50%,#7f1d1d 100%)', accent: '#ef4444', scene: 'fire' },
  { title: 'ZERO GRAVITY', genre: 'SCI-FI', rating: 4.6, badge: 'ULTRA HD', bg: 'linear-gradient(160deg,#050014 0%,#12002e 50%,#1e0047 100%)', accent: '#8b5cf6', scene: 'space' },
  { title: 'FINAL CUP', genre: 'DESPORTO', rating: 4.1, badge: 'AO VIVO', bg: 'linear-gradient(160deg,#001a00 0%,#003300 50%,#004d00 100%)', accent: '#4ade80', scene: 'sport' },
  { title: 'CRIMSON TIDE', genre: 'AÇÃO', rating: 4.5, badge: '4K', bg: 'linear-gradient(160deg,#1a0005 0%,#3b000f 50%,#6b0020 100%)', accent: '#fb7185', scene: 'action' },
  { title: 'AURORA', genre: 'DOC', rating: 4.8, badge: 'HD', bg: 'linear-gradient(160deg,#00080f 0%,#001a33 50%,#003355 100%)', accent: '#06b6d4', scene: 'nature' },
  { title: 'BROKEN VOWS', genre: 'DRAMA', rating: 4.0, badge: 'HD', bg: 'linear-gradient(160deg,#0f0a00 0%,#2e1a00 50%,#5c3a00 100%)', accent: '#fbbf24', scene: 'drama' },
  { title: 'TITAN RISING', genre: 'ÉPICO', rating: 4.7, badge: '4K HDR', bg: 'linear-gradient(160deg,#0a1a2a 0%,#0f2d4a 50%,#15426b 100%)', accent: '#0ea5e9', scene: 'action' },
  { title: 'NIGHT OWL', genre: 'THRILLER', rating: 4.4, badge: 'HD', bg: 'linear-gradient(160deg,#0f0000 0%,#1f0000 50%,#3b0000 100%)', accent: '#f43f5e', scene: 'dark' },
  { title: 'HORIZON', genre: 'SCI-FI', rating: 4.9, badge: 'ULTRA HD', bg: 'linear-gradient(160deg,#020014 0%,#0a0033 50%,#14005c 100%)', accent: '#a78bfa', scene: 'space' },
];

// ─── Scene SVG art for each mock banner ───────────────────────────────────────
const SceneArt: React.FC<{ scene: string; accent: string }> = ({ scene, accent }) => {
  const baseStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    opacity: 0.35,
  };

  switch (scene) {
    case 'space':
      return (
        <svg style={baseStyle} viewBox="0 0 110 160" xmlns="http://www.w3.org/2000/svg">
          <circle cx="55" cy="70" r="28" fill="none" stroke={accent} strokeWidth="1"/>
          <circle cx="55" cy="70" r="18" fill={accent} fillOpacity="0.15"/>
          <circle cx="55" cy="70" r="5" fill={accent} fillOpacity="0.6"/>
          <ellipse cx="55" cy="70" rx="42" ry="10" fill="none" stroke={accent} strokeWidth="0.5" strokeDasharray="3 2"/>
          {[...Array(20)].map((_, i) => (
            <circle key={i} cx={Math.sin(i * 18.8) * 52 + 55} cy={Math.cos(i * 13.4) * 72 + 72} r="0.8" fill="white" fillOpacity={0.3 + (i % 3) * 0.2}/>
          ))}
        </svg>
      );
    case 'action':
      return (
        <svg style={baseStyle} viewBox="0 0 110 160" xmlns="http://www.w3.org/2000/svg">
          <polygon points="55,20 80,80 30,80" fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="0.8"/>
          <polygon points="55,45 75,95 35,95" fill={accent} fillOpacity="0.15"/>
          <line x1="10" y1="130" x2="100" y2="90" stroke={accent} strokeWidth="0.5" strokeOpacity="0.5"/>
          <line x1="0" y1="100" x2="110" y2="60" stroke={accent} strokeWidth="0.3" strokeOpacity="0.3"/>
          <circle cx="55" cy="65" r="20" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.4"/>
          <line x1="40" y1="120" x2="70" y2="40" stroke={accent} strokeWidth="0.4" strokeOpacity="0.4"/>
        </svg>
      );
    case 'sport':
      return (
        <svg style={baseStyle} viewBox="0 0 110 160" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="55" cy="130" rx="50" ry="8" fill={accent} fillOpacity="0.2"/>
          <rect x="20" y="105" width="70" height="3" rx="1" fill={accent} fillOpacity="0.3"/>
          <rect x="5" y="70" width="100" height="1" fill={accent} fillOpacity="0.2"/>
          <circle cx="55" cy="75" r="15" fill="none" stroke={accent} strokeWidth="1.2"/>
          <path d="M 42 70 Q 55 60 68 70 Q 55 80 42 70" fill={accent} fillOpacity="0.25"/>
          <rect x="40" y="60" width="2" height="55" fill={accent} fillOpacity="0.3"/>
          <rect x="68" y="60" width="2" height="55" fill={accent} fillOpacity="0.3"/>
        </svg>
      );
    case 'nature':
      return (
        <svg style={baseStyle} viewBox="0 0 110 160" xmlns="http://www.w3.org/2000/svg">
          <path d="M 0 120 Q 20 80 40 90 Q 55 60 70 85 Q 85 70 110 100 L 110 160 L 0 160 Z" fill={accent} fillOpacity="0.25"/>
          <circle cx="80" cy="30" r="20" fill={accent} fillOpacity="0.15"/>
          <path d="M 65 30 Q 80 10 95 30" fill={accent} fillOpacity="0.2" stroke={accent} strokeWidth="0.5"/>
          <line x1="0" y1="110" x2="110" y2="110" stroke={accent} strokeWidth="0.4" strokeOpacity="0.3"/>
        </svg>
      );
    case 'drama':
      return (
        <svg style={baseStyle} viewBox="0 0 110 160" xmlns="http://www.w3.org/2000/svg">
          <circle cx="55" cy="55" r="25" fill={accent} fillOpacity="0.12" stroke={accent} strokeWidth="0.5"/>
          <ellipse cx="55" cy="55" rx="12" ry="18" fill={accent} fillOpacity="0.2"/>
          <path d="M 30 100 Q 55 80 80 100 Q 90 120 55 130 Q 20 120 30 100" fill={accent} fillOpacity="0.15"/>
          <line x1="55" y1="30" x2="55" y2="155" stroke={accent} strokeWidth="0.3" strokeOpacity="0.3"/>
        </svg>
      );
    case 'dark':
      return (
        <svg style={baseStyle} viewBox="0 0 110 160" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="0" width="110" height="160" fill="black" fillOpacity="0.4"/>
          <path d="M 0 80 L 55 30 L 110 80 L 110 160 L 0 160 Z" fill={accent} fillOpacity="0.08"/>
          <line x1="0" y1="0" x2="110" y2="160" stroke={accent} strokeWidth="0.4" strokeOpacity="0.3"/>
          <line x1="110" y1="0" x2="0" y2="160" stroke={accent} strokeWidth="0.4" strokeOpacity="0.3"/>
          <circle cx="55" cy="80" r="12" fill={accent} fillOpacity="0.15" stroke={accent} strokeWidth="0.5"/>
        </svg>
      );
    case 'ocean':
      return (
        <svg style={baseStyle} viewBox="0 0 110 160" xmlns="http://www.w3.org/2000/svg">
          <path d="M 0 80 Q 18 65 36 80 Q 54 95 72 80 Q 90 65 110 80 L 110 160 L 0 160 Z" fill={accent} fillOpacity="0.2"/>
          <path d="M 0 95 Q 20 82 40 95 Q 60 108 80 95 Q 95 82 110 95 L 110 160 L 0 160 Z" fill={accent} fillOpacity="0.15"/>
          <circle cx="55" cy="50" r="22" fill={accent} fillOpacity="0.1" stroke={accent} strokeWidth="0.5"/>
          <circle cx="55" cy="50" r="8" fill={accent} fillOpacity="0.25"/>
        </svg>
      );
    case 'fire':
      return (
        <svg style={baseStyle} viewBox="0 0 110 160" xmlns="http://www.w3.org/2000/svg">
          <path d="M 55 150 Q 30 120 40 90 Q 25 100 30 70 Q 45 90 50 60 Q 55 30 55 10 Q 65 40 60 60 Q 70 40 75 60 Q 85 35 80 70 Q 85 100 70 90 Q 80 120 55 150 Z" fill={accent} fillOpacity="0.35"/>
          <path d="M 55 140 Q 38 115 45 95 Q 55 105 55 80 Q 60 95 65 85 Q 72 115 55 140 Z" fill={accent} fillOpacity="0.5"/>
        </svg>
      );
    default:
      return null;
  }
};

// ─── Single mock poster card ───────────────────────────────────────────────────
const MockPosterCard: React.FC<{ banner: typeof MOCK_BANNERS[0] }> = ({ banner }) => (
  <div
    className="w-[110px] h-[160px] sm:w-[140px] sm:h-[200px] rounded-xl shrink-0 relative overflow-hidden border shadow-2xl"
    style={{
      background: banner.bg,
      borderColor: `${banner.accent}22`,
      boxShadow: `0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 ${banner.accent}18`,
    }}
  >
    {/* Scene illustration */}
    <SceneArt scene={banner.scene} accent={banner.accent} />

    {/* Gradient overlay — darkens bottom for text */}
    <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.85) 100%)' }} />

    {/* Badge top-right */}
    <div
      className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[7px] font-black tracking-wider"
      style={{ background: `${banner.accent}33`, color: banner.accent, border: `1px solid ${banner.accent}44` }}
    >
      {banner.badge}
    </div>

    {/* Bottom info */}
    <div className="absolute bottom-0 left-0 right-0 p-2">
      <div className="text-white/90 font-black text-[9px] tracking-[0.12em] uppercase leading-tight">{banner.title}</div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[7px] font-semibold tracking-wider" style={{ color: `${banner.accent}cc` }}>{banner.genre}</span>
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i < Math.floor(banner.rating) ? banner.accent : `${banner.accent}30` }} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ─── Real image poster card (from playlist) ────────────────────────────────────
const RealPosterCard: React.FC<{ src: string; name: string; fallback: typeof MOCK_BANNERS[0] }> = ({
  src, name, fallback
}) => {
  const [failed, setFailed] = React.useState(false);

  if (failed) {
    return <MockPosterCard banner={fallback} />;
  }

  return (
    <div
      className="w-[110px] h-[160px] sm:w-[140px] sm:h-[200px] rounded-xl shrink-0 relative overflow-hidden border border-white/8 shadow-2xl"
    >
      <img
        src={src}
        alt={name}
        loading="lazy"
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
      {/* Bottom label overlay */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.8) 100%)' }} />
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <div className="text-white/85 font-bold text-[8px] tracking-wide uppercase leading-tight truncate">{name}</div>
      </div>
    </div>
  );
};

// Shared discriminated union type for poster list items
type PosterItem =
  | { type: 'mock'; mock: typeof MOCK_BANNERS[0]; idx: number; key: string }
  | { type: 'real'; src: string; name: string; fallbackIdx: number; key: string };

// ─── Netflix poster background ─────────────────────────────────────────────────
const NetflixPosterBackground: React.FC = () => {
  const { movieChannels, seriesChannels, liveChannels } = useIPTVStore();
  const hasPlaylist = movieChannels.length > 0 || seriesChannels.length > 0;

  // Build the poster list — real images from playlist when available, mocks otherwise
  const posterList = useMemo((): PosterItem[] => {
    if (!hasPlaylist) {
      return MOCK_BANNERS.map((b, i): PosterItem => ({ type: 'mock', mock: b, idx: i, key: `mock-${i}` }));
    }

    const seen = new Set<string>();
    const items: PosterItem[] = [];

    const tryAdd = (ch: { logo?: string; name: string }, fallbackIdx: number, prefix: string) => {
      if (items.length >= 30) return;
      const src = ch.logo?.trim();
      if (src && src.startsWith('http') && !seen.has(src)) {
        seen.add(src);
        items.push({ type: 'real', src, name: ch.name, fallbackIdx, key: `${prefix}-${items.length}` });
      }
    };

    const step = Math.max(1, Math.floor(movieChannels.length / 12));
    for (let i = 0; i < movieChannels.length && items.length < 12; i += step) {
      tryAdd(movieChannels[i], i % MOCK_BANNERS.length, 'movie');
    }
    const step2 = Math.max(1, Math.floor(seriesChannels.length / 10));
    for (let i = 0; i < seriesChannels.length && items.length < 22; i += step2) {
      tryAdd(seriesChannels[i], i % MOCK_BANNERS.length, 'series');
    }
    const step3 = Math.max(1, Math.floor(liveChannels.length / 8));
    for (let i = 0; i < liveChannels.length && items.length < 30; i += step3) {
      tryAdd(liveChannels[i], i % MOCK_BANNERS.length, 'live');
    }

    if (items.length < 10) {
      for (let i = 0; i < MOCK_BANNERS.length && items.length < 16; i++) {
        items.push({ type: 'real', src: '', name: '', fallbackIdx: i, key: `pad-${i}` });
      }
    }

    return items;
  }, [hasPlaylist, movieChannels, seriesChannels, liveChannels]);

  // Distribute into 6 rows
  const rows = useMemo(() => {
    const N = posterList.length;
    const perRow = Math.max(4, Math.ceil(N / 6));
    const speeds = ['80s', '95s', '70s', '88s', '92s', '75s'];
    const dirs = ['left', 'right', 'left', 'right', 'left', 'right'] as const;

    return Array.from({ length: 6 }, (_, r) => {
      const start = (r * 3) % N; // stagger offsets per row
      const raw: typeof posterList = [];
      for (let i = 0; i < perRow; i++) {
        raw.push(posterList[(start + i) % N]);
      }
      const doubled = [...raw, ...raw];
      return { items: doubled, dir: dirs[r], speed: speeds[r] };
    });
  }, [posterList]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0" style={{ background: '#07091a' }}>
      {/* 3D grid */}
      <div
        className="absolute flex flex-col gap-4"
        style={{
          width: '230%',
          height: '230%',
          left: '-65%',
          top: '-55%',
          transform: 'rotate(-14deg) skewX(-10deg)',
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
              {row.items.map((item) =>
                item.type === 'mock' ? (
                  <MockPosterCard key={item.key} banner={item.mock} />
                ) : item.src ? (
                  <RealPosterCard
                    key={item.key}
                    src={item.src}
                    name={item.name}
                    fallback={MOCK_BANNERS[item.fallbackIdx]}
                  />
                ) : (
                  <MockPosterCard key={item.key} banner={MOCK_BANNERS[item.fallbackIdx]} />
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Vignettes */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #07091a 28%, rgba(7,9,26,0.45) 52%, transparent 78%)' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #07091a 0%, transparent 10%, transparent 90%, #07091a 100%)' }} />
      <div className="absolute inset-0 bg-black/15" />
    </div>
  );
};

// ─── Custom Movie Reel SVG ─────────────────────────────────────────────────────
const MovieReelIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
      {/* Background poster grid */}
      <NetflixPosterBackground />

      {/* Foreground */}
      <div className="relative z-10 flex flex-col h-full">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-violet-900 flex items-center justify-center shadow-lg shadow-violet-600/30 border border-violet-500/20">
              <Tv className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-white font-extrabold text-sm tracking-wider uppercase">IPTV</span>
              <span className="text-violet-400 font-extrabold text-sm tracking-wider uppercase ml-1">Premium</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
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

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${proxyClass}`}>
              {proxyStatus === 'checking'
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="hidden xs:inline">A ligar…</span></>
                : proxyStatus === 'online'
                ? <><Wifi className="w-3.5 h-3.5" /><span className="hidden xs:inline">Online</span></>
                : <><WifiOff className="w-3.5 h-3.5" /><span className="hidden xs:inline">Offline</span></>
              }
            </div>

            <button
              onClick={onOpenSettings}
              className="focusable-tv p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/15 transition-all text-gray-400 hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom section */}
        <div className="px-6 pb-8 shrink-0">
          {/* Cards */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5 w-full max-w-3xl mx-auto mb-6">
            {sections.map(({ key, icon: Icon, label }) => (
              <div
                key={key}
                id={`section-${key}`}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSection(key)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSection(key); } }}
                className="focusable-tv group relative flex flex-col items-center justify-center cursor-pointer
                  w-52 h-44 sm:w-56 sm:h-48
                  rounded-[20px] border border-violet-500/30
                  transition-all duration-300
                  hover:scale-[1.04] hover:border-violet-400/70
                  focus:outline-none focus:border-violet-400 focus:scale-[1.04]
                  active:scale-[0.97]"
                style={{
                  background: 'rgba(10, 6, 24, 0.72)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  boxShadow: '0 0 0 1px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.4)',
                }}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse at 50% 60%, rgba(139,92,246,0.14) 0%, transparent 70%)' }} />

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
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/5 backdrop-blur-sm flex-1 min-w-0"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              <Star className="w-3 h-3 text-violet-500 shrink-0" />
              <p className="text-[11px] text-gray-500 font-semibold truncate">
                {channelsCount > 0
                  ? `${channelsCount.toLocaleString('pt-PT')} canais · ${moviesCount.toLocaleString('pt-PT')} filmes · ${seriesCount.toLocaleString('pt-PT')} séries`
                  : 'Adicione uma lista M3U nas Definições para começar'}
              </p>
            </div>

            <button
              onClick={onForceRefresh}
              className="focusable-tv flex items-center gap-2 px-4 py-2 rounded-xl border border-white/5 hover:border-violet-500/30 hover:bg-white/5 backdrop-blur-sm transition-all group shrink-0"
              style={{ background: 'rgba(0,0,0,0.4)' }}
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
