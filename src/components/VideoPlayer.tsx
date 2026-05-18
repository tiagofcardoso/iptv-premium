import {
  useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback,
} from 'react';
import Hls from 'hls.js';
import {
  WifiOff, RefreshCw, Loader2, Play, Pause, Maximize2,
  Volume2, VolumeX, SkipBack, SkipForward,
} from 'lucide-react';
import type { PlayerStatus } from '../types/index.ts';
import { proxyUrl } from '../utils/proxy.ts';

interface VideoPlayerProps {
  url: string | null;
  /** Channel list for prev/next navigation */
  playlist?: { id: string; url: string; name: string }[];
  currentId?: string;
  onNavigate?: (id: string) => void;
  isLive?: boolean;
  onControlsVisibleChange?: (visible: boolean) => void;
}

export interface VideoPlayerHandle {
  /** Call synchronously inside a user-gesture handler to go fullscreen */
  requestFullscreen: () => void;
}

function detectStreamType(url: string): 'hls' | 'direct' {
  const lower = url.toLowerCase().split('?')[0];
  if (
    lower.endsWith('.mp4') ||
    lower.endsWith('.mkv') ||
    lower.endsWith('.avi') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.wmv') ||
    lower.endsWith('.flv') ||
    lower.endsWith('.ts')
  ) return 'direct';
  return 'hls';
}

const LOAD_TIMEOUT_MS = 15000; // reduced from 20s for faster feedback

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  ({ url, playlist = [], currentId, onNavigate, isLive = false, onControlsVisibleChange }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fullscreenTriggered = useRef(false);
  const lastSaveTimeRef = useRef<number | null>(null);

  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const retryCountRef = useRef(0);
  const currentUrlRef = useRef<string | null>(null);

  // Prev / Next indices
  const currentIdx = playlist.findIndex(p => p.id === currentId);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < playlist.length - 1;

  useImperativeHandle(ref, () => ({
    requestFullscreen: () => {
      containerRef.current?.requestFullscreen().catch(() => {});
    },
  }));

  // ── Controls auto-hide ────────────────────────────────────────────────────────
  // On touch devices (mobile/TV): auto-hide after 3.5s
  // On desktop (mouse): always visible
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (!isTouchDevice) return; // desktop: always keep visible
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 3500);
  }, [isTouchDevice]);

  useEffect(() => {
    if (onControlsVisibleChange) {
      onControlsVisibleChange(controlsVisible);
    }
  }, [controlsVisible, onControlsVisibleChange]);

  const goFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (el.requestFullscreen) el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
    } catch { /* ignore */ }
  }, []);

  const destroyHls = () => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  };

  const clearLoadTimeout = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const startLoadTimeout = () => {
    clearLoadTimeout();
    timeoutRef.current = setTimeout(() => {
      if (currentUrlRef.current) {
        const video = videoRef.current;
        if (video) {
          destroyHls();
          setStatus('loading');
          video.src = proxyUrl(currentUrlRef.current);
          video.load();
          video.play()
            .then(() => setStatus('playing'))
            .catch(() => {
              setStatus('error');
              setErrorMsg('Stream indisponível. Tenta outro canal.');
            });
        }
      }
    }, LOAD_TIMEOUT_MS);
  };

  const showError = (msg: string) => {
    clearLoadTimeout();
    destroyHls();
    setStatus('error');
    setErrorMsg(msg);
  };

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play().catch(() => {}); setPaused(false); }
    else { video.pause(); setPaused(true); }
    showControls();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    showControls();
  };

  const goNext = useCallback(() => {
    if (hasNext && onNavigate) onNavigate(playlist[currentIdx + 1].id);
  }, [hasNext, currentIdx, playlist, onNavigate]);

  const goPrev = useCallback(() => {
    if (hasPrev && onNavigate) onNavigate(playlist[currentIdx - 1].id);
  }, [hasPrev, currentIdx, playlist, onNavigate]);

  // ── Keyboard / TV remote navigation ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Only intercept when player is active
      if (status !== 'playing' && status !== 'loading') return;
      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); goNext(); break;
        case 'ArrowLeft':  e.preventDefault(); goPrev(); break;
        case ' ':
        case 'Enter':      e.preventDefault(); togglePlayPause(); break;
        case 'm':
        case 'M':          toggleMute(); break;
        case 'f':
        case 'F':          goFullscreen(); break;
        default: break;
      }
      showControls();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [status, goNext, goPrev, goFullscreen, showControls]);

  const initPlayer = (streamUrl: string) => {
    const video = videoRef.current;
    if (!video) return;

    destroyHls();
    clearLoadTimeout();
    currentUrlRef.current = streamUrl;
    fullscreenTriggered.current = false;
    setStatus('loading');
    setErrorMsg('');
    setPaused(false);
    retryCountRef.current = 0;

    const streamType = detectStreamType(streamUrl);
    const proxied = proxyUrl(streamUrl);

    const onReady = () => {
      clearLoadTimeout();
      video.play().catch(console.warn);
      setStatus('playing');
      showControls();

      // Restore playback progress if not live
      if (!isLive && currentId) {
        const saved = localStorage.getItem(`iptv_progress_${currentId}`);
        if (saved) {
          const time = parseFloat(saved);
          if (time > 5) {
            const seek = () => {
              if (video.duration && time >= video.duration - 15) {
                // completed, start from beginning
                return;
              }
              video.currentTime = time;
              console.log(`[Player] Resumed playback to ${time}s`);
            };
            
            seek();
            // Robust multi-phase seek fallback to fully survive initial player state resets
            setTimeout(seek, 150);
            setTimeout(seek, 300);
            setTimeout(seek, 600);
            video.addEventListener('playing', seek, { once: true });
            video.addEventListener('canplay', seek, { once: true });
          }
        }
      }

      // Auto-fullscreen — deferred so it runs inside the play event (user gesture chain)
      setTimeout(() => { if (!fullscreenTriggered.current) { goFullscreen(); fullscreenTriggered.current = true; } }, 50);
    };

    // ── HLS.js ─────────────────────────────────────────────────────────────────
    if (streamType === 'hls' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        // Faster startup — start with lowest quality, switch up quickly
        startLevel: -1,            // auto
        abrEwmaDefaultEstimate: 8_000_000, // assume 8Mbps initially (faster first segment)
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferSize: 60 * 1024 * 1024,
        // Reduce retry delays for faster error recovery
        manifestLoadingMaxRetry: 3,
        manifestLoadingRetryDelay: 500,
        levelLoadingMaxRetry: 3,
        levelLoadingRetryDelay: 500,
        fragLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 500,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
          xhr.setRequestHeader('Accept', '*/*');
        },
      });

      hlsRef.current = hls;
      hls.loadSource(proxied);
      hls.attachMedia(video);
      startLoadTimeout();

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onReady();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        const httpStatus = data.response?.code;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCountRef.current < 2) {
          retryCountRef.current++;
          setStatus('recovering');
          setTimeout(() => { if (hlsRef.current) hlsRef.current.startLoad(); }, 1500);
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retryCountRef.current < 1) {
          retryCountRef.current++;
          setStatus('recovering');
          hls.recoverMediaError();
          return;
        }

        destroyHls();
        clearLoadTimeout();
        video.src = proxied;
        video.load();
        video.play()
          .then(() => { setStatus('playing'); goFullscreen(); })
          .catch(() =>
            showError(
              httpStatus === 403
                ? 'Acesso negado (403). O stream pode ser geo-bloqueado.'
                : httpStatus === 404
                ? 'Stream não encontrado (404). Canal offline.'
                : 'Sinal indisponível. Não foi possível carregar o stream.'
            )
          );
      });

    // ── Native HLS (Safari / iOS) ────────────────────────────────────────────
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      const handleLoadedMetadata = () => { onReady(); };
      
      video.addEventListener('error', () =>
        showError('Stream indisponível. A fonte pode estar offline ou bloqueada.')
      , { once: true });
      
      if (video.readyState >= 1) {
        handleLoadedMetadata();
      } else {
        video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      }
      
      video.src = proxied;
      startLoadTimeout();

    // ── Direct <video> fallback ──────────────────────────────────────────────
    } else {
      const handleCanPlay = () => { onReady(); };
      
      video.addEventListener('error', () =>
        showError('Stream indisponível. Formato não suportado ou canal offline.')
      , { once: true });
      
      if (video.readyState >= 3) {
        handleCanPlay();
      } else {
        video.addEventListener('canplay', handleCanPlay, { once: true });
      }
      
      video.src = proxied;
      video.load();
      startLoadTimeout();
    }
  };

  useEffect(() => {
    if (!url) { destroyHls(); clearLoadTimeout(); setStatus('idle'); return; }
    initPlayer(url);
    return () => { destroyHls(); clearLoadTimeout(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const handleRetry = () => { if (url) initPlayer(url); };

  // First user interaction → trigger fullscreen (needed for Android TV / Chrome)
  const handleFirstInteraction = () => {
    if (!fullscreenTriggered.current && status === 'playing') {
      goFullscreen();
      fullscreenTriggered.current = true;
    }
    showControls();
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || isLive || !currentId) return;

    const currentTime = video.currentTime;
    const duration = video.duration;

    if (duration && duration > 0) {
      if (currentTime >= duration - 15) {
        localStorage.removeItem(`iptv_progress_${currentId}`);
      } else if (currentTime > 5) {
        const now = Date.now();
        if (!lastSaveTimeRef.current || now - lastSaveTimeRef.current > 2000) {
          localStorage.setItem(`iptv_progress_${currentId}`, currentTime.toString());
          lastSaveTimeRef.current = now;
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full sm:h-auto sm:aspect-video bg-black sm:rounded-xl overflow-hidden group"
      onMouseMove={showControls}
      onTouchStart={handleFirstInteraction}
      onClick={status === 'playing' ? () => { handleFirstInteraction(); togglePlayPause(); } : undefined}
    >
      {/* The video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        onTimeUpdate={handleTimeUpdate}
      />

      {/* ── Loading / Recovering overlay ── */}
      {(status === 'loading' || status === 'recovering') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 pointer-events-none">
          <Loader2 className="w-12 h-12 text-violet-400 animate-spin" />
          <p className="text-gray-300 text-sm font-medium">
            {status === 'recovering' ? 'A reconectar…' : 'A carregar stream…'}
          </p>
        </div>
      )}

      {/* ── Idle state ── */}
      {status === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-violet-950/30">
          <div className="text-center space-y-3">
            <div className="w-20 h-20 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto">
              <Play className="w-9 h-9 text-violet-400 ml-1" />
            </div>
            <p className="text-gray-400 text-sm">Seleciona um canal para começar</p>
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-center space-y-1 px-6 max-w-sm">
            <p className="text-white font-semibold">Sinal indisponível</p>
            <p className="text-gray-400 text-xs leading-relaxed">{errorMsg}</p>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Custom controls overlay (auto-hide after 3.5s) ── */}
      {status === 'playing' && (
        <div
          className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{ pointerEvents: controlsVisible ? 'auto' : 'none' }}
        >
          {/* Top gradient + badge */}
          <div className="h-16 bg-gradient-to-b from-black/60 to-transparent flex items-start px-3 pt-2">
            {isLive && (
              <div className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm rounded-full px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-white text-xs font-bold tracking-wider">AO VIVO</span>
              </div>
            )}
          </div>

          {/* Bottom gradient + controls row */}
          <div className="h-20 bg-gradient-to-t from-black/80 to-transparent flex items-end px-3 pb-3">
            <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>

              {/* Prev */}
              <button
                onClick={goPrev}
                disabled={!hasPrev}
                className={`p-2.5 rounded-full backdrop-blur transition-colors ${hasPrev ? 'bg-white/10 hover:bg-white/25 active:scale-90' : 'opacity-30 cursor-not-allowed'}`}
                title="Anterior"
              >
                <SkipBack className="w-5 h-5 text-white" />
              </button>

              {/* Play / Pause */}
              <button
                onClick={togglePlayPause}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur transition-colors active:scale-90"
              >
                {paused
                  ? <Play className="w-5 h-5 text-white ml-0.5" />
                  : <Pause className="w-5 h-5 text-white" />
                }
              </button>

              {/* Next */}
              <button
                onClick={goNext}
                disabled={!hasNext}
                className={`p-2.5 rounded-full backdrop-blur transition-colors ${hasNext ? 'bg-white/10 hover:bg-white/25 active:scale-90' : 'opacity-30 cursor-not-allowed'}`}
                title="Seguinte"
              >
                <SkipForward className="w-5 h-5 text-white" />
              </button>

              {/* Mute */}
              <button
                onClick={toggleMute}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur transition-colors active:scale-90"
              >
                {muted
                  ? <VolumeX className="w-5 h-5 text-white" />
                  : <Volume2 className="w-5 h-5 text-white" />
                }
              </button>

              <div className="flex-1" />

              {/* Fullscreen */}
              <button
                onClick={() => { goFullscreen(); fullscreenTriggered.current = true; }}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/25 backdrop-blur transition-colors active:scale-90"
                title="Ecrã inteiro"
              >
                <Maximize2 className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paused overlay */}
      {status === 'playing' && paused && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <Play className="w-8 h-8 text-white ml-1" />
          </div>
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
export default VideoPlayer;
