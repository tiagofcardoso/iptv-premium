import { useState, useEffect, useRef, useCallback } from 'react';
import { Tv, Settings } from 'lucide-react';
import HomeScreen from './components/HomeScreen.tsx';
import ContentBrowser from './components/ContentBrowser.tsx';
import VideoPlayer, { type VideoPlayerHandle } from './components/VideoPlayer.tsx';
import Sidebar from './components/Sidebar.tsx';
import { useIPTVStore, getPersistedFavoriteIds } from './store/useIPTVStore.ts';
import { fetchM3U } from './utils/m3uParser.ts';
import { PROXY_BASE } from './utils/proxy.ts';

// ── Navigation state stored in browser history ────────────────────────────────
// Each "page" in the stack is one of these states pushed via history.pushState
type NavScreen = 'home' | 'live' | 'movies' | 'series' | 'player';

interface NavState {
  screen: NavScreen;
}

function pushNav(screen: NavScreen) {
  const state: NavState = { screen };
  window.history.pushState(state, '', '');
}

function getInitialScreen(): NavScreen {
  const state = window.history.state as NavState | null;
  return state?.screen ?? 'home';
}

// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [screen, setScreen] = useState<NavScreen>(getInitialScreen);
  const [proxyStatus, setProxyStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const playerRef = useRef<VideoPlayerHandle>(null);

  const {
    currentChannel, setCurrentChannel, channels,
    playlistUrl, setChannels, setAutoLoading,
  } = useIPTVStore();

  // ── Replace initial history entry so the very first "back" stays in-app ──────
  useEffect(() => {
    // Replace the initial browser entry with our home state
    window.history.replaceState({ screen: 'home' } satisfies NavState, '');
  }, []);

  // ── Handle hardware/browser back button ──────────────────────────────────────
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const state = e.state as NavState | null;
      const target = state?.screen ?? 'home';
      setScreen(target);

      // If navigating away from player, stop channel but keep section
      if (target !== 'player') {
        setCurrentChannel(null as any);
      }

      // Close sidebar on any navigation
      setShowSidebar(false);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [setCurrentChannel]);

  // ── Navigation helpers ────────────────────────────────────────────────────────
  const navigateTo = useCallback((next: NavScreen) => {
    pushNav(next);
    setScreen(next);
  }, []);

  const navigateBack = useCallback(() => {
    window.history.back(); // triggers popstate → handled above
  }, []);

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

  // ── Section navigation ────────────────────────────────────────────────────────
  const handleSelectSection = (section: 'live' | 'movies' | 'series') => {
    if (channels.length === 0) { setShowSidebar(true); return; }
    navigateTo(section);
  };

  // ── Channel selection → opens player ─────────────────────────────────────────
  const handleSelectChannel = (channel: any) => {
    setCurrentChannel(channel);
    navigateTo('player');
  };

  // ── Content counts ────────────────────────────────────────────────────────────
  const moviesCount = channels.filter(c => c.contentType === 'movie').length;
  const seriesCount = channels.filter(c => c.contentType === 'series').length;


  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden font-sans">

      {/* ── Settings Sidebar ── */}
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

        {/* Floating settings button (only on home) */}
        {screen === 'home' && (
          <div className="absolute top-3 right-4 z-10">
            <button
              onClick={() => setShowSidebar(true)}
              className="p-2 rounded-xl bg-gray-800/80 backdrop-blur hover:bg-gray-700 transition-colors"
              title="Configurações / Lista M3U"
            >
              <Settings className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        )}

        {/* ── Home screen ── */}
        {screen === 'home' && (
          <HomeScreen
            channelsCount={channels.length}
            moviesCount={moviesCount}
            seriesCount={seriesCount}
            proxyStatus={proxyStatus}
            onSelectSection={handleSelectSection}
            onForceRefresh={handleForceRefresh}
            lastUpdated={lastUpdated}
            installPrompt={installPrompt}
            onInstall={handleInstall}
          />
        )}

        {/* ── Content Browser (Live / Movies / Series) ── */}
        {(screen === 'live' || screen === 'movies' || screen === 'series') && (
          <ContentBrowser
            section={screen}
            channels={channels}
            onBack={navigateBack}
            onSelectChannel={handleSelectChannel}
          />
        )}

        {/* ── Player screen ── */}
        {screen === 'player' && currentChannel && (
          <div className="fixed inset-0 z-30 bg-black flex flex-col">
            {/* Player header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-950/90 backdrop-blur shrink-0">
              <button
                onClick={navigateBack}
                className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 transition-colors"
                aria-label="Voltar"
              >
                {/* Chevron left */}
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {currentChannel.logo && (
                  <img
                    src={currentChannel.logo}
                    alt=""
                    className="w-8 h-8 rounded-lg object-contain bg-gray-800 shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{currentChannel.name}</p>
                  <p className="text-gray-500 text-xs truncate">{currentChannel.group}</p>
                </div>
              </div>

              <button
                onClick={() => setShowSidebar(true)}
                className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors shrink-0"
                aria-label="Menu"
              >
                <Settings className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Player — full height minus header */}
            <div className="flex-1 flex items-center justify-center bg-black p-2 sm:p-4">
              <div className="w-full max-w-6xl">
                <VideoPlayer ref={playerRef} url={currentChannel.url} />
              </div>
            </div>
          </div>
        )}

        {/* Hint when no playlist */}
        {channels.length === 0 && screen === 'home' && (
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
