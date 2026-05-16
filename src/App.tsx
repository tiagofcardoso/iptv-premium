import { useState, useEffect, useRef } from 'react';
import { Menu, Tv, Code2, Globe, Loader2, Wifi, WifiOff, Download, X } from 'lucide-react';
import Sidebar from './components/Sidebar.tsx';
import VideoPlayer, { type VideoPlayerHandle } from './components/VideoPlayer.tsx';
import ChannelGrid from './components/ChannelGrid.tsx';
import NowPlayingBar from './components/NowPlayingBar.tsx';
import HistorySection from './components/HistorySection.tsx';
import { useIPTVStore, getPersistedFavoriteIds } from './store/useIPTVStore.ts';
import { fetchM3U } from './utils/m3uParser.ts';
import { PROXY_BASE } from './utils/proxy.ts';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false); // default closed on mobile
  const [proxyStatus, setProxyStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const playerRef = useRef<VideoPlayerHandle>(null);

  // ── Open sidebar by default on large screens ─────────────────────────────────
  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true);
  }, []);

  // ── PWA Installation ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  const {
    currentChannel, channels, categories,
    playlistUrl, setChannels, setAutoLoading, isAutoLoading, history,
  } = useIPTVStore();

  // ── Wake up proxy & auto-reload saved playlist ───────────────────────────────
  useEffect(() => {
    const wakeProxy = async () => {
      try {
        const res = await fetch(`${PROXY_BASE}/status`, { signal: AbortSignal.timeout(10000) });
        setProxyStatus(res.ok ? 'online' : 'offline');
      } catch {
        setProxyStatus('offline');
      }
    };

    wakeProxy().then(() => {
      if (playlistUrl && channels.length === 0) {
        setAutoLoading(true);
        const favIds = getPersistedFavoriteIds();
        fetchM3U(playlistUrl)
          .then(parsed => {
            const withFavs = parsed.map(c => ({ ...c, isFavorite: favIds.has(c.id) }));
            setChannels(withFavs, playlistUrl);
          })
          .catch(err => {
            console.error('[IPTV] Auto-reload failed:', err);
            setAutoLoading(false);
          });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Related channels for grid ────────────────────────────────────────────────
  const getRelatedChannels = () => {
    if (!currentChannel) return channels.slice(0, 24);
    const same = channels.filter(c => c.group === currentChannel.group && c.id !== currentChannel.id);
    return same.length > 0 ? same.slice(0, 24) : channels.filter(c => c.id !== currentChannel.id).slice(0, 24);
  };

  const gridTitle = currentChannel
    ? `Mais de "${currentChannel.group}"`
    : channels.length > 0 ? 'Todos os Canais' : '';

  const favorites = channels.filter(c => c.isFavorite);
  const favLive = favorites.filter(c => c.contentType === 'live' || !c.contentType);
  const favMovies = favorites.filter(c => c.contentType === 'movie');
  const favSeries = favorites.filter(c => c.contentType === 'series');

  const showEmptyState = channels.length === 0 && !isAutoLoading;
  const showFavorites = channels.length > 0 && favorites.length > 0 && !currentChannel;

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden font-sans">

      {/* ── Mobile Backdrop Overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <div className={`
        fixed md:relative z-30 h-full
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${sidebarOpen ? 'w-72 md:w-64 lg:w-72' : 'md:w-0'}
      `}>
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(prev => !prev)}
          playerRef={playerRef}
        />
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Header */}
        <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-950/80 backdrop-blur-xl border-b border-white/5 shrink-0 z-10">
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors shrink-0"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen
              ? <X className="w-5 h-5 text-gray-400 md:hidden" />
              : <Menu className="w-5 h-5 text-gray-400" />
            }
            <Menu className="w-5 h-5 text-gray-400 hidden md:block" />
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Tv className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-sm hidden xs:block">IPTV</span>
            <span className="text-violet-400 font-bold text-sm hidden xs:block">Premium</span>
          </div>

          <div className="flex-1" />

          {/* Install App Button */}
          {installPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-violet-500/20"
            >
              <Download className="w-4 h-4" />
              <span className="text-xs hidden sm:block">Instalar</span>
            </button>
          )}

          {/* Proxy status indicator */}
          <div className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
            proxyStatus === 'checking'
              ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
              : proxyStatus === 'online'
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {proxyStatus === 'checking'
              ? <><Loader2 className="w-3 h-3 animate-spin" /> <span className="hidden sm:block">A ligar…</span></>
              : proxyStatus === 'online'
              ? <><Wifi className="w-3 h-3" /> <span className="hidden sm:block">Proxy OK</span></>
              : <><WifiOff className="w-3 h-3" /> <span className="hidden sm:block">Offline</span></>
            }
          </div>

          {/* Auto-loading indicator */}
          {isAutoLoading && (
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-violet-600/10 rounded-lg border border-violet-500/20">
              <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
              <span className="text-xs text-violet-300 hidden sm:block">A carregar…</span>
            </div>
          )}

          {/* Channel count */}
          {channels.length > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10">
              <span className="text-xs text-gray-400">{channels.length.toLocaleString()} canais</span>
              <span className="text-gray-600">•</span>
              <span className="text-xs text-gray-400">{categories.length} cat.</span>
            </div>
          )}
        </header>

        {/* Now Playing Bar */}
        {currentChannel && <NowPlayingBar channel={currentChannel} />}

        {/* Main scrollable area */}
        <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 max-w-screen-2xl mx-auto">

            {/* Video Player — full width, responsive height */}
            <div className="w-full">
              <VideoPlayer ref={playerRef} url={currentChannel?.url ?? null} />
            </div>

            {/* History */}
            {history.length > 0 && (
              <HistorySection playerRef={playerRef} />
            )}

            {/* Favorites by type */}
            {showFavorites && (
              <>
                {favLive.length > 0 && (
                  <ChannelGrid channels={favLive} title="⭐ Canais Favoritos" playerRef={playerRef} />
                )}
                {favMovies.length > 0 && (
                  <ChannelGrid channels={favMovies} title="⭐ Filmes Favoritos" playerRef={playerRef} />
                )}
                {favSeries.length > 0 && (
                  <ChannelGrid channels={favSeries} title="⭐ Séries Favoritas" playerRef={playerRef} />
                )}
              </>
            )}

            {/* Related / Browse grid */}
            {channels.length > 0 && (
              <ChannelGrid
                channels={getRelatedChannels()}
                title={gridTitle}
                playerRef={playerRef}
                limit={24}
              />
            )}

            {/* Empty state */}
            {showEmptyState && (
              <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center space-y-5">
                <div className="relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-violet-600/20 to-violet-800/10 border border-violet-500/20 flex items-center justify-center">
                    <Tv className="w-10 h-10 sm:w-12 sm:h-12 text-violet-400/60" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-violet-600 border-2 border-gray-950 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">+</span>
                  </div>
                </div>
                <div className="space-y-1.5 px-4">
                  <h1 className="text-white font-bold text-lg sm:text-xl">Bem-vindo ao IPTV Premium</h1>
                  <p className="text-gray-500 text-sm max-w-sm">
                    {window.innerWidth < 768
                      ? 'Toca no ☰ para abrir o menu e carregar a tua lista M3U.'
                      : 'Carrega a tua lista M3U na barra lateral para começar a ver.'}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>HLS / M3U8 / TS</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5" />
                    <span>PWA Ready</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
