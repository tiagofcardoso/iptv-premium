import { useState, useEffect, useRef } from 'react';
import { Download, Menu, Tv, Settings, X } from 'lucide-react';
import HomeScreen from './components/HomeScreen.tsx';
import ContentBrowser from './components/ContentBrowser.tsx';
import VideoPlayer, { type VideoPlayerHandle } from './components/VideoPlayer.tsx';
import Sidebar from './components/Sidebar.tsx';
import { useIPTVStore, getPersistedFavoriteIds } from './store/useIPTVStore.ts';
import { fetchM3U } from './utils/m3uParser.ts';
import { PROXY_BASE } from './utils/proxy.ts';

type Section = 'home' | 'live' | 'movies' | 'series';

function App() {
  const [section, setSection] = useState<Section>('home');
  const [proxyStatus, setProxyStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const playerRef = useRef<VideoPlayerHandle>(null);

  const {
    currentChannel, channels,
    playlistUrl, setChannels, setAutoLoading,
  } = useIPTVStore();

  // ── PWA Install ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  // ── Wake up proxy & auto-reload ───────────────────────────────────────────────
  useEffect(() => {
    const pingProxy = async () => {
      try {
        const res = await fetch(`${PROXY_BASE}/status`, { signal: AbortSignal.timeout(15000) });
        setProxyStatus(res.ok ? 'online' : 'offline');
      } catch {
        setProxyStatus('offline');
      }
    };

    pingProxy().then(() => {
      if (playlistUrl && channels.length === 0) {
        setAutoLoading(true);
        const favIds = getPersistedFavoriteIds();
        fetchM3U(playlistUrl)
          .then(parsed => {
            const withFavs = parsed.map(c => ({ ...c, isFavorite: favIds.has(c.id) }));
            setChannels(withFavs, playlistUrl);
            setLastUpdated(new Date().toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }));
          })
          .catch(err => {
            console.error('[IPTV] Auto-reload failed:', err);
            setAutoLoading(false);
          });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Force refresh ─────────────────────────────────────────────────────────────
  const handleForceRefresh = () => {
    if (!playlistUrl) { setShowSidebar(true); return; }
    setAutoLoading(true);
    const favIds = getPersistedFavoriteIds();
    fetchM3U(playlistUrl)
      .then(parsed => {
        const withFavs = parsed.map(c => ({ ...c, isFavorite: favIds.has(c.id) }));
        setChannels(withFavs, playlistUrl);
        setLastUpdated(new Date().toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }));
      })
      .catch(console.error);
  };

  // ── Content counts ────────────────────────────────────────────────────────────
  const moviesCount = channels.filter(c => c.contentType === 'movie').length;
  const seriesCount = channels.filter(c => c.contentType === 'series').length;

  // ── Video player overlay (shown when a channel is active) ─────────────────────
  const showPlayer = !!currentChannel;

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden font-sans">

      {/* ── Settings Sidebar (for playlist management) ── */}
      {showSidebar && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setShowSidebar(false)} />
          <div className="fixed left-0 top-0 h-full w-72 z-50 shadow-2xl">
            <Sidebar
              isOpen={showSidebar}
              onToggle={() => setShowSidebar(false)}
              playerRef={playerRef}
            />
          </div>
        </>
      )}

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* Floating top actions */}
        <div className="absolute top-3 right-4 z-10 flex items-center gap-2">
          {installPrompt && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-medium transition-colors shadow-lg"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:block">Instalar</span>
            </button>
          )}
          <button
            onClick={() => setShowSidebar(true)}
            className="p-2 rounded-xl bg-gray-800/80 backdrop-blur hover:bg-gray-700 transition-colors"
            title="Configurações / Lista M3U"
          >
            <Settings className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* ── Home ── */}
        {section === 'home' && (
          <HomeScreen
            channelsCount={channels.length}
            moviesCount={moviesCount}
            seriesCount={seriesCount}
            proxyStatus={proxyStatus}
            onSelectSection={s => {
              if (channels.length === 0) { setShowSidebar(true); return; }
              setSection(s);
            }}
            onForceRefresh={handleForceRefresh}
            lastUpdated={lastUpdated}
          />
        )}

        {/* ── Content Browser (Live / Movies / Series) ── */}
        {(section === 'live' || section === 'movies' || section === 'series') && (
          <ContentBrowser
            section={section}
            channels={channels}
            onBack={() => setSection('home')}
            playerRef={playerRef}
          />
        )}

        {/* ── Video Player Overlay ── */}
        {showPlayer && (
          <div className="fixed inset-0 z-30 bg-black/95 flex flex-col">
            {/* Player header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-950/80 backdrop-blur shrink-0">
              <button
                onClick={() => setSection(section === 'home' ? 'live' : section)}
                className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                {currentChannel.logo && (
                  <img src={currentChannel.logo} alt="" className="w-7 h-7 rounded object-contain bg-gray-800" />
                )}
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{currentChannel.name}</p>
                  <p className="text-gray-500 text-xs truncate">{currentChannel.group}</p>
                </div>
              </div>
              <div className="flex-1" />
              <button
                onClick={() => setShowSidebar(true)}
                className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                <Menu className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Player */}
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="w-full max-w-6xl">
                <VideoPlayer ref={playerRef} url={currentChannel.url} />
              </div>
            </div>
          </div>
        )}

        {/* Empty state — no playlist yet */}
        {channels.length === 0 && section === 'home' && (
          <div className="absolute bottom-24 left-0 right-0 flex justify-center pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/80 backdrop-blur rounded-full border border-white/10 text-xs text-gray-400">
              <Tv className="w-3.5 h-3.5" />
              <span>Toca em ⚙️ para adicionar a tua lista M3U</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
