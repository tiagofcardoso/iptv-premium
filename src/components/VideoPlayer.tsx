import {
  useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback,
} from 'react';
import Hls from 'hls.js';
import { WifiOff, RefreshCw, Loader2, Play, Pause, Maximize2, Volume2, VolumeX } from 'lucide-react';
import type { PlayerStatus } from '../types/index.ts';
import { proxyUrl } from '../utils/proxy.ts';

interface VideoPlayerProps {
  url: string | null;
}

export interface VideoPlayerHandle {
  /** Call synchronously inside a user-gesture handler to go fullscreen */
  requestFullscreen: () => void;
}

function detectStreamType(url: string): 'hls' | 'direct' {
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.ts')) return 'direct';
  return 'hls';
}

const LOAD_TIMEOUT_MS = 20000;

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(({ url }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const retryCountRef = useRef(0);
  const currentUrlRef = useRef<string | null>(null);

  // Expose requestFullscreen to parent
  useImperativeHandle(ref, () => ({
    requestFullscreen: () => {
      containerRef.current?.requestFullscreen().catch(() => {});
    },
  }));

  // ── Controls auto-hide ────────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 3000);
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
              setErrorMsg('Stream unavailable. This channel may require a native player like VLC.');
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

  const goFullscreen = () => {
    containerRef.current?.requestFullscreen().catch(() => {});
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

  const initPlayer = (streamUrl: string) => {
    const video = videoRef.current;
    if (!video) return;

    destroyHls();
    clearLoadTimeout();
    currentUrlRef.current = streamUrl;
    setStatus('loading');
    setErrorMsg('');
    setPaused(false);
    retryCountRef.current = 0;

    const proxied = proxyUrl(streamUrl);
    const streamType = detectStreamType(streamUrl);

    // ── HLS.js ─────────────────────────────────────────────────────────────────
    if (streamType === 'hls' && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000,
        levelLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        abrEwmaDefaultEstimate: 5000000,
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
        clearLoadTimeout();
        if (hls.levels && hls.levels.length > 0) {
          hls.currentLevel = hls.levels.length - 1;
        }
        video.play().catch(console.warn);
        setStatus('playing');
        goFullscreen();
        showControls();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        const httpStatus = data.response?.code;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCountRef.current < 2) {
          retryCountRef.current++;
          setStatus('recovering');
          setTimeout(() => { if (hlsRef.current) hlsRef.current.startLoad(); }, 2000);
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
                ? 'Access denied (403). The stream may be geo-blocked.'
                : httpStatus === 404
                ? 'Stream not found (404). This channel may be offline.'
                : 'Signal unavailable. The stream could not be loaded.'
            )
          );
      });

    // ── Native HLS (Safari / iOS) ───────────────────────────────────────────────
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxied;
      startLoadTimeout();
      video.addEventListener('loadedmetadata', () => {
        clearLoadTimeout();
        video.play().catch(console.warn);
        setStatus('playing');
        goFullscreen();
        showControls();
      }, { once: true });
      video.addEventListener('error', () =>
        showError('Stream unavailable. The source may be offline or geo-blocked.')
      , { once: true });

    // ── Direct <video> fallback ─────────────────────────────────────────────────
    } else {
      video.src = proxied;
      video.load();
      startLoadTimeout();
      video.addEventListener('canplay', () => {
        clearLoadTimeout();
        video.play().catch(console.warn);
        setStatus('playing');
        goFullscreen();
        showControls();
      }, { once: true });
      video.addEventListener('error', () =>
        showError('Stream unavailable. This format may not be supported or the stream is offline.')
      , { once: true });
    }
  };

  useEffect(() => {
    if (!url) { destroyHls(); clearLoadTimeout(); setStatus('idle'); return; }
    initPlayer(url);
    return () => { destroyHls(); clearLoadTimeout(); };
  }, [url]);

  const handleRetry = () => { if (url) initPlayer(url); };

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black rounded-xl overflow-hidden aspect-video group"
      onMouseMove={showControls}
      onTouchStart={showControls}
      onClick={status === 'playing' ? togglePlayPause : undefined}
    >
      {/* The video element — NO native controls */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
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

      {/* ── Custom controls overlay (auto-hide after 3s) ── */}
      {status === 'playing' && (
        <div
          className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}
          style={{ pointerEvents: controlsVisible ? 'auto' : 'none' }}
        >
          {/* Top gradient + LIVE badge */}
          <div className="h-16 bg-gradient-to-b from-black/60 to-transparent flex items-start px-3 pt-2">
            <div className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm rounded-full px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-white text-xs font-bold tracking-wider">AO VIVO</span>
            </div>
          </div>

          {/* Bottom gradient + controls row */}
          <div className="h-16 bg-gradient-to-t from-black/70 to-transparent flex items-end px-3 pb-3">
            <div className="flex items-center gap-3 w-full" onClick={e => e.stopPropagation()}>

              {/* Play / Pause */}
              <button
                onClick={togglePlayPause}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur transition-colors"
              >
                {paused
                  ? <Play className="w-5 h-5 text-white ml-0.5" />
                  : <Pause className="w-5 h-5 text-white" />
                }
              </button>

              {/* Mute */}
              <button
                onClick={toggleMute}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur transition-colors"
              >
                {muted
                  ? <VolumeX className="w-5 h-5 text-white" />
                  : <Volume2 className="w-5 h-5 text-white" />
                }
              </button>

              <div className="flex-1" />

              {/* Fullscreen */}
              <button
                onClick={goFullscreen}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur transition-colors"
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
