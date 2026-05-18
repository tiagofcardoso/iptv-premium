import { useState, useEffect, useRef, useCallback } from 'react';
import { Tv, Settings } from 'lucide-react';
import HomeScreen from './components/HomeScreen.tsx';
import ContentBrowser from './components/ContentBrowser.tsx';
import VideoPlayer, { type VideoPlayerHandle } from './components/VideoPlayer.tsx';
import Sidebar from './components/Sidebar.tsx';
import { useIPTVStore, getPersistedFavoriteIds } from './store/useIPTVStore.ts';
import { fetchM3U } from './utils/m3uParser.ts';
import { PROXY_BASE } from './utils/proxy.ts';
import { App as CapacitorApp } from '@capacitor/app';

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
  const [playerControlsVisible, setPlayerControlsVisible] = useState(true);
  const playerRef = useRef<VideoPlayerHandle>(null);

  const {
    currentChannel, setCurrentChannel, channels,
    playlistUrl, setChannels, setAutoLoading,
  } = useIPTVStore();

  // ── Replace initial history entry so the very first "back" stays in-app ──────
  useEffect(() => {
    // Replace the initial browser entry with a sentinel "behind home" entry
    // so the very first back press goes to the sentinel and we can intercept it
    window.history.replaceState({ screen: '__sentinel__' }, '');
    window.history.pushState({ screen: 'home' } satisfies NavState, '');
  }, []);

  // ── Handle hardware/browser back button ──────────────────────────────────────
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const state = e.state as NavState | null;
      const target = state?.screen ?? 'home';

      // If we hit the sentinel (behind the first home entry), push home again
      // so the user can never accidentally exit the app via back
      if ((target as string) === '__sentinel__' || target === null) {
        window.history.pushState({ screen: 'home' } satisfies NavState, '');
        setScreen('home');
        return;
      }

      setScreen(target as NavScreen);
      if (target !== 'player') setCurrentChannel(null as any);
      setShowSidebar(false);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [setCurrentChannel]);

  // ── Capacitor Hardware Back Button ───────────────────────────────────────────
  useEffect(() => {
    let listener: any;
    CapacitorApp.addListener('backButton', () => {
      // 1. Dispatch custom event for components to intercept (like ContentBrowser closing a category)
      const event = new CustomEvent('app:hardwareBack', { cancelable: true });
      const handled = !window.dispatchEvent(event);
      
      // 2. If a component called e.preventDefault(), stop here
      if (handled) return;

      // 3. Otherwise, if sidebar is open, close it
      if (showSidebar) {
        setShowSidebar(false);
        return;
      }

      // 4. If playing video, go back to previous screen
      if (screen === 'player') {
        window.history.back();
        return;
      }

      // 5. If we are not on home, go back
      if (screen !== 'home') {
        window.history.back();
        return;
      }

      // 6. If we are on home and nothing else is open, exit app
      CapacitorApp.exitApp();
    }).then(l => { listener = l; });

    return () => {
      if (listener) listener.remove();
    };
  }, [screen, showSidebar]);

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

  // ── TV Spatial Navigation (D-Pad support) ────────────────────────────────────
  useEffect(() => {
    const handleTVNavigation = (e: KeyboardEvent) => {
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (!keys.includes(e.key)) return;

      const active = document.activeElement as HTMLElement | null;

      // Skip left/right navigation if user is actively typing in the search input
      if (active?.tagName === 'INPUT' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        return;
      }

      // Check if Sidebar or Favorite Context Menu is open
      const sidebar = document.querySelector('aside');
      const contextMenu = document.getElementById('fav-context-menu');

      // Find all focusable elements with .focusable-tv class
      let candidates = Array.from(document.querySelectorAll('.focusable-tv')) as HTMLElement[];

      if (contextMenu) {
        // If Context Menu is open, restrict focus navigation strictly inside the context menu
        candidates = candidates.filter(el => contextMenu.contains(el));
      } else if (sidebar) {
        // If Sidebar is open, restrict navigation strictly inside the sidebar
        candidates = candidates.filter(el => sidebar.contains(el));
      } else {
        // If both are closed, completely ignore any elements inside <aside> or the context menu
        candidates = candidates.filter(el => !el.closest('aside') && !el.closest('#fav-context-menu'));
      }

      if (candidates.length === 0) return;

      // If nothing is focused, or the active element isn't in our candidates, focus the first one
      if (!active || !candidates.includes(active)) {
        candidates[0].focus();
        e.preventDefault();
        return;
      }

      const activeRect = active.getBoundingClientRect();
      const activeCenter = {
        x: activeRect.left + activeRect.width / 2,
        y: activeRect.top + activeRect.height / 2
      };

      let bestCandidate: HTMLElement | null = null;
      let minDistance = Infinity;

      for (const candidate of candidates) {
        if (candidate === active) continue;

        const rect = candidate.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue; // Skip hidden/invisible elements

        const center = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };

        const dx = center.x - activeCenter.x;
        const dy = center.y - activeCenter.y;

        let isCorrectDirection = false;
        let distance = 0;

        // Threshold of 5px to account for slight misalignment or line offsets
        if (e.key === 'ArrowDown') {
          isCorrectDirection = rect.top >= activeRect.top + 5;
          // Heavily penalize horizontal drift to prefer exact columns below
          distance = dy * dy + 4 * dx * dx;
        } else if (e.key === 'ArrowUp') {
          isCorrectDirection = rect.bottom <= activeRect.bottom - 5;
          distance = dy * dy + 4 * dx * dx;
        } else if (e.key === 'ArrowLeft') {
          isCorrectDirection = rect.right <= activeRect.right - 5;
          // Heavily penalize vertical drift to prefer exact rows to the left
          distance = 4 * dy * dy + dx * dx;
        } else if (e.key === 'ArrowRight') {
          isCorrectDirection = rect.left >= activeRect.left + 5;
          distance = 4 * dy * dy + dx * dx;
        }

        if (isCorrectDirection && distance < minDistance) {
          minDistance = distance;
          bestCandidate = candidate;
        }
      }

      if (bestCandidate) {
        bestCandidate.focus();
        bestCandidate.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleTVNavigation);
    return () => window.removeEventListener('keydown', handleTVNavigation);
  }, []);

  // ── Auto-focus Sidebar when it opens ─────────────────────────────────────────
  useEffect(() => {
    if (showSidebar) {
      setTimeout(() => {
        // Try to focus the first input inside the Sidebar first (URL input), otherwise the first focusable element
        const sidebarInput = document.querySelector('aside input.focusable-tv') as HTMLElement | null;
        if (sidebarInput) {
          sidebarInput.focus();
        } else {
          const firstInSidebar = document.querySelector('aside .focusable-tv') as HTMLElement | null;
          if (firstInSidebar) firstInSidebar.focus();
        }
      }, 150);
    }
  }, [showSidebar]);

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
            // Debug: log content type breakdown
            const counts = withFavs.reduce((acc, c) => {
              acc[c.contentType ?? 'live'] = (acc[c.contentType ?? 'live'] ?? 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            console.log('[IPTV] Content types:', counts);
            setChannels(withFavs, playlistUrl);
            setLastUpdated(new Date().toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }));
          })
          .catch(err => {
            console.error('[IPTV] Auto-reload failed:', err);
            setAutoLoading(false);
          });
      } else if (playlistUrl && channels.length > 0) {
        // Migration: re-parse with updated content type logic
        const favIds = getPersistedFavoriteIds();
        fetchM3U(playlistUrl)
          .then(reparsed => {
            const withFavs = reparsed.map(c => ({ ...c, isFavorite: favIds.has(c.id) }));
            const counts = withFavs.reduce((acc, c) => {
              acc[c.contentType ?? 'live'] = (acc[c.contentType ?? 'live'] ?? 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            console.log('[IPTV] Re-parsed content types:', counts);
            setChannels(withFavs, playlistUrl);
            setLastUpdated(new Date().toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }));
          })
          .catch(() => { /* silently skip */ });
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
    
    // Request fullscreen immediately inside the user click gesture!
    setTimeout(() => {
      try {
        playerRef.current?.requestFullscreen();
      } catch (err) {
        console.warn('Auto-fullscreen on select blocked or failed:', err);
      }
    }, 80);
  };

  // ── Content counts ────────────────────────────────────────────────────────────
  const moviesCount = channels.filter(c => c.contentType === 'movie').length;
  const seriesCount = channels.filter(c => c.contentType === 'series').length;

  // ── Playlist context for prev/next in player ──────────────────────────────────
  const sectionChannels = screen === 'player' && currentChannel
    ? channels.filter(c => c.contentType === currentChannel.contentType)
    : [];
  const currentIsLive = currentChannel?.contentType === 'live' || currentChannel?.contentType == null;

  const handleNavigateChannel = useCallback((id: string) => {
    const ch = channels.find(c => c.id === id);
    if (ch) setCurrentChannel(ch);
  }, [channels, setCurrentChannel]);


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


        {screen === 'home' && (
          <HomeScreen
            channelsCount={channels.length}
            moviesCount={moviesCount}
            seriesCount={seriesCount}
            proxyStatus={proxyStatus}
            onSelectSection={handleSelectSection}
            onForceRefresh={handleForceRefresh}
            onOpenSettings={() => setShowSidebar(true)}
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
            <div className={`absolute top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/95 via-black/60 to-transparent px-4 py-4 flex items-center gap-3 transition-opacity duration-300 ${playerControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <button
                onClick={navigateBack}
                className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 active:bg-gray-600 transition-colors backdrop-blur-sm"
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
                    className="w-9 h-9 rounded-lg object-contain bg-gray-900/80 p-0.5 border border-white/10 shrink-0"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate drop-shadow">{currentChannel.name}</p>
                  <p className="text-gray-400 text-xs truncate drop-shadow">{currentChannel.group}</p>
                </div>
              </div>

              <button
                onClick={() => setShowSidebar(true)}
                className="p-2 rounded-xl bg-gray-800/80 hover:bg-gray-700 transition-colors shrink-0 backdrop-blur-sm"
                aria-label="Menu"
              >
                <Settings className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Player — immersive full screen layout */}
            <div className="flex-1 w-full h-full bg-black relative">
              <VideoPlayer
                ref={playerRef}
                url={currentChannel.url}
                playlist={sectionChannels}
                currentId={currentChannel.id}
                onNavigate={handleNavigateChannel}
                isLive={currentIsLive}
                onControlsVisibleChange={setPlayerControlsVisible}
              />
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
